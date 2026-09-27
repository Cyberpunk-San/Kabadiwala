# apps/backend/services/assistant_service.py
"""
"Kabadi Sahayak" — an agentic assistant for collectors.

The assistant doesn't just chat: it calls TOOLS on live platform data
(rates, best offers, open demands, the collector's own lots, fair-price
valuation) and returns ACTIONS the app renders as buttons
("Open Market: Copper 35 kg").

Agent protocol (works with any chat LLM — no native function-calling needed):
  the model replies with ONE JSON object per turn, either
     {"tool": "<name>", "args": {...}}                 → we run it, feed result back
     {"final": "<answer>", "actions": [{...}, ...]}    → done
  up to MAX_STEPS tool calls.

Provider order: Hugging Face → Gemini → offline agent (rule-based planner that
uses the very same tools, so the feature always works, even with no keys).
"""

from __future__ import annotations

import json
import re
from typing import Any, Callable, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from db import CollectorRow, DemandRow, LotRow
from models.domain import (
    AssistantAction,
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantStep,
)
from services import ml_service, recycler_service
from services.ai_providers import AIProviderError, gemini_available, gemini_chat, hf_available, hf_chat
from services.ml_classifier import MATERIAL_HAZARDS
from services import market_price_service
from services.price_forecaster import BASE_PRICES

MAX_STEPS = 4
DEFAULT_LAT, DEFAULT_LON = 18.6279, 73.8488  # Pune Bhosari cluster

LANGUAGE_NAMES = {"en": "English", "hi": "Hindi (Devanagari script)", "mr": "Marathi (Devanagari script)"}
MATERIALS = list(BASE_PRICES.keys())

# Names people actually say, mapped to the platform's material keys.
MATERIAL_ALIASES: Dict[str, List[str]] = {
    "Copper cable": ["copper", "tamba", "tanba", "तांबा", "तांबे", "तांब्या", "wire", "तार", "cable"],
    "Server boards": ["server", "सर्वर", "सर्व्हर"],
    "Aluminium": ["aluminium", "aluminum", "एल्युमिनियम", "ॲल्युमिनियम", "एल्यूमीनियम"],
    "Mixed e-waste": ["mixed", "e-waste", "ewaste", "मिश्रित", "मिश्र", "ई-कचरा"],
    "Lithium-ion batteries": ["lithium", "li-ion", "लिथियम", "mobile battery", "laptop battery", "फूली बैटरी", "फुगलेली"],
    "Brass fittings": ["brass", "pital", "पीतल", "पितळ"],
    "Printed Circuit Boards (PCB)": ["pcb", "circuit", "motherboard", "सर्किट"],
    "Electric motors": ["motor", "मोटर"],
    "Iron & steel scrap": ["iron", "steel", "loha", "लोहा", "लोखंड", "स्टील"],
    "CRT & monitor glass": ["crt", "monitor", " tv", "टीवी", "मॉनिटर"],
    "Lead acid batteries": ["lead", "car battery", "inverter", "सीसा", "शिसे"],
    "Compressors & cooling units": ["compressor", "fridge", " ac ", "कंप्रेसर", "फ्रिज"],
    "Newspaper": ["newspaper", "raddi", "akhbar", "रद्दी", "अखबार", "पेपर", "वर्तमानपत्र"],
    "Books & notebooks": ["book", "notebook", "copy", "किताब", "कॉपी", "वही", "पुस्तक"],
    "Cardboard": ["cardboard", "carton", "box", "गत्ता", "कार्टन", "पुठ्ठा"],
    "Mixed plastic": ["plastic", "bucket", "balti", "प्लास्टिक", "बाल्टी", "डबा"],
    "PET bottles": ["bottle", "pet", "बोतल", "बाटली"],
    "Stainless steel": ["stainless", "utensil", "bartan", "बर्तन", "भांडी", "स्टेनलेस"],
}


def find_material(text: str) -> Optional[str]:
    lower = f" {text.lower()} "
    for material, aliases in MATERIAL_ALIASES.items():
        if material.lower() in lower or any(a.lower() in lower for a in aliases):
            return material
    return None


def find_weight(text: str) -> Optional[float]:
    m = re.search(r"(\d+(?:\.\d+)?)\s*(kg|kilo|किलो|केजी)?", text.lower())
    if m and m.group(2):
        return float(m.group(1))
    return None


def _normalise_material(value: Any) -> Optional[str]:
    if not isinstance(value, str) or not value.strip():
        return None
    if value in BASE_PRICES:
        return value
    return find_material(value)


# ─── Tools ───────────────────────────────────────────────────────────────────

class AgentContext:
    def __init__(self, db: Session, req: AssistantChatRequest):
        self.db = db
        self.req = req
        self.collector: Optional[CollectorRow] = (
            db.query(CollectorRow).filter(CollectorRow.id == req.collector_id).first()
            if req.collector_id else None
        )
        if req.location:
            self.lat, self.lon = req.location.latitude, req.location.longitude
        elif self.collector and self.collector.latitude and self.collector.longitude:
            self.lat, self.lon = self.collector.latitude, self.collector.longitude
        else:
            self.lat, self.lon = DEFAULT_LAT, DEFAULT_LON


def tool_get_rates(ctx: AgentContext, material: Optional[str] = None) -> Dict[str, Any]:
    mat = _normalise_material(material)
    if mat:
        return {"material": mat, "rate_per_kg": market_price_service.local_price(ctx.db, mat, ctx.lat, ctx.lon),
                "source": market_price_service.price_source(mat, ctx.lat, ctx.lon), "hazardous": MATERIAL_HAZARDS[mat]["hazard"]}
    local = {m: market_price_service.local_price(ctx.db, m, ctx.lat, ctx.lon) for m in BASE_PRICES}
    return {"rates_per_kg": dict(sorted(local.items(), key=lambda kv: kv[1], reverse=True))}


def tool_get_best_offers(ctx: AgentContext, material: Any = None, weight_kg: Any = 35) -> Dict[str, Any]:
    mat = _normalise_material(material)
    if not mat:
        return {"error": f"Unknown material. Choose one of: {', '.join(MATERIALS)}"}
    try:
        weight = max(0.1, min(5000.0, float(weight_kg or 35)))
    except (TypeError, ValueError):
        weight = 35.0
    offers = recycler_service.match_recyclers_spatially(ctx.db, ctx.lat, ctx.lon, mat, weight)[:3]
    return {
        "material": mat,
        "weight_kg": weight,
        "offers": [
            {
                "recycler": o.recycler_name,
                "price_per_kg": o.listed_price_per_kg,
                "distance_km": o.distance_km,
                "take_home_inr": o.net_earnings,
                "on_time_payment_pct": o.payment_reliability,
            }
            for o in offers
        ],
    }


def tool_get_open_demands(ctx: AgentContext, material: Any = None) -> Dict[str, Any]:
    q = ctx.db.query(DemandRow).filter(DemandRow.status.in_(["OPEN", "PARTIAL"]))
    mat = _normalise_material(material)
    if mat:
        q = q.filter(DemandRow.material == mat)
    rows = q.order_by(DemandRow.offered_price_per_kg.desc()).limit(5).all()
    return {
        "demands": [
            {
                "buyer": d.recycler_name,
                "material": d.material,
                "kg_needed": round(max(0.0, d.quantity_kg - d.filled_kg), 1),
                "price_per_kg": d.offered_price_per_kg,
                "hub": d.hub,
                "deadline": d.deadline.date().isoformat(),
            }
            for d in rows
        ]
    }


def tool_get_my_lots(ctx: AgentContext) -> Dict[str, Any]:
    if not ctx.collector:
        return {"error": "Collector not logged in"}
    lots = (
        ctx.db.query(LotRow)
        .filter(LotRow.collector_id == ctx.collector.id)
        .order_by(LotRow.created_at.desc())
        .limit(8)
        .all()
    )
    return {
        "lifetime": {
            "lots": ctx.collector.total_lots,
            "kg": ctx.collector.total_weight_kg,
            "earned_inr": ctx.collector.total_earnings,
            "tier": ctx.collector.tier,
        },
        "recent_lots": [
            {"material": l.material, "kg": l.weight_kg, "status": l.status, "expected_inr": l.expected_net_earnings}
            for l in lots
        ],
    }


def tool_estimate_fair_price(ctx: AgentContext, material: Any = None, weight_kg: Any = 35, quality: Any = "medium") -> Dict[str, Any]:
    mat = _normalise_material(material)
    if not mat:
        return {"error": "Unknown material"}
    q = quality if quality in ("low", "medium", "high") else "medium"
    try:
        weight = max(0.1, float(weight_kg or 35))
    except (TypeError, ValueError):
        weight = 35.0
    v = ml_service.valuate(ctx.db, mat, q, weight)  # type: ignore[arg-type]
    return {"material": mat, "fair_price_per_kg": v.fair_price_per_kg, "fair_payout_inr": v.fair_payout, "quality": q}


def tool_get_safety(ctx: AgentContext, material: Any = None) -> Dict[str, Any]:
    mat = _normalise_material(material)
    if not mat:
        return {"general": "Wear gloves, never burn cables, never break batteries or CRT tubes, keep batteries dry in sand."}
    meta = MATERIAL_HAZARDS[mat]
    return {"material": mat, "hazardous": meta["hazard"], "advice": meta["safety_message"]}


TOOLS: Dict[str, Tuple[Callable[..., Dict[str, Any]], str]] = {
    "get_rates": (tool_get_rates, 'Today\'s mandi rate. args: {"material"?: str}'),
    "get_best_offers": (tool_get_best_offers, 'Top 3 nearby buyers ranked by take-home money. args: {"material": str, "weight_kg": number}'),
    "get_open_demands": (tool_get_open_demands, 'Open buyer demands. args: {"material"?: str}'),
    "get_my_lots": (tool_get_my_lots, "The user's lifetime stats and recent lots. args: {}"),
    "estimate_fair_price": (tool_estimate_fair_price, 'AI fair price. args: {"material": str, "weight_kg": number, "quality"?: "low"|"medium"|"high"}'),
    "get_safety": (tool_get_safety, 'Safety advice. args: {"material"?: str}'),
}

TOOL_LABELS = {
    "get_rates": "Checked today's rates",
    "get_best_offers": "Compared nearby buyers",
    "get_open_demands": "Looked up buyer demands",
    "get_my_lots": "Read your lots",
    "estimate_fair_price": "Estimated fair price",
    "get_safety": "Checked safety rules",
}


def run_tool(ctx: AgentContext, name: str, args: Dict[str, Any]) -> Dict[str, Any]:
    entry = TOOLS.get(name)
    if not entry:
        return {"error": f"Unknown tool '{name}'. Available: {', '.join(TOOLS)}"}
    fn, _ = entry
    try:
        return fn(ctx, **{k: v for k, v in (args or {}).items() if isinstance(k, str)})
    except TypeError as exc:
        return {"error": f"Bad arguments: {exc}"}


def _summarise(name: str, args: Dict[str, Any]) -> AssistantStep:
    mat = _normalise_material(args.get("material")) if isinstance(args, dict) else None
    label = TOOL_LABELS.get(name, name)
    return AssistantStep(tool=name, summary=f"{label}{f' · {mat}' if mat else ''}")


def _parse_actions(raw: Any) -> List[AssistantAction]:
    actions: List[AssistantAction] = []
    for a in raw if isinstance(raw, list) else []:
        if not isinstance(a, dict):
            continue
        try:
            actions.append(AssistantAction(
                type=a.get("type"),
                material=_normalise_material(a.get("material")),  # type: ignore[arg-type]
                weight_kg=float(a["weight_kg"]) if a.get("weight_kg") is not None else None,
            ))
        except (ValueError, TypeError):
            continue
    return actions[:3]


def _extract_json(text: str) -> Optional[Dict[str, Any]]:
    """Pull the first {...} object out of a model reply (models love code fences)."""
    start = text.find("{")
    while start != -1:
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        obj = json.loads(text[start:i + 1])
                        return obj if isinstance(obj, dict) else None
                    except json.JSONDecodeError:
                        break
        start = text.find("{", start + 1)
    return None


# ─── LLM agent loop ──────────────────────────────────────────────────────────

def _system_prompt(ctx: AgentContext) -> str:
    who = ""
    if ctx.collector:
        c = ctx.collector
        who = f"The user is {c.name}, a {c.tier}-tier collector in {c.operating_area or 'Pune'}.\n"
    tools = "\n".join(f"- {n}: {desc}" for n, (_, desc) in TOOLS.items())
    return (
        "You are Kabadi Sahayak, an assistant AGENT inside the 'Mai Hu Kabadiwala' app for informal "
        "scrap and e-waste collectors in India.\n" + who +
        f"Materials the platform knows: {', '.join(MATERIALS)}.\n\n"
        "You can call tools to get LIVE data. Never invent prices, buyers or numbers — call a tool.\n"
        f"TOOLS:\n{tools}\n\n"
        "Reply with EXACTLY ONE JSON object and nothing else:\n"
        '  to use a tool: {"tool": "get_best_offers", "args": {"material": "Copper cable", "weight_kg": 35}}\n'
        '  to answer:     {"final": "<answer>", "actions": [{"type": "open_market", "material": "Copper cable", "weight_kg": 35}]}\n'
        "Action types: open_market (needs material, weight_kg), open_scan, open_rates, open_demands, "
        "open_earnings, open_opportunity. Add 1-2 actions that help the user do the next step.\n\n"
        f"The final answer MUST be in {LANGUAGE_NAMES.get(ctx.req.language, 'Hindi')}. Many users have little "
        "formal education: use very simple words, at most 5 short lines, and use ₹. Safety first: never advise "
        "burning cables, breaking batteries or CRTs, or acid baths."
    )


def _llm_agent(ctx: AgentContext, complete: Callable[[str, List[Dict[str, str]]], str]) -> Tuple[str, List[AssistantAction], List[AssistantStep]]:
    system = _system_prompt(ctx)
    convo: List[Dict[str, str]] = [m.model_dump() for m in ctx.req.messages][-8:]
    steps: List[AssistantStep] = []

    for _ in range(MAX_STEPS + 1):
        raw = complete(system, convo)
        obj = _extract_json(raw)
        if obj is None:
            # Model ignored the protocol — its text is still a usable answer.
            return raw.strip(), [], steps
        if "final" in obj:
            return str(obj["final"]).strip(), _parse_actions(obj.get("actions")), steps
        if "tool" in obj and len(steps) < MAX_STEPS:
            name = str(obj["tool"])
            args = obj.get("args") if isinstance(obj.get("args"), dict) else {}
            result = run_tool(ctx, name, args)
            steps.append(_summarise(name, args))
            convo.append({"role": "assistant", "content": json.dumps({"tool": name, "args": args}, ensure_ascii=False)})
            convo.append({"role": "user", "content": f"TOOL RESULT ({name}): {json.dumps(result, ensure_ascii=False)}\nNow continue — another tool or the final JSON answer."})
            continue
        break

    # Out of steps: ask once more for a final answer with what we have.
    convo.append({"role": "user", "content": 'Give the final JSON answer now: {"final": "...", "actions": [...]}'})
    obj = _extract_json(complete(system, convo)) or {}
    return str(obj.get("final") or "").strip(), _parse_actions(obj.get("actions")), steps


# ─── Offline agent (same tools, rule-based planning) ─────────────────────────

TEXT = {
    "offers": {
        "en": "Best buyer for {kg:g} kg {m}: {r} — ₹{p:.0f}/kg, {d} km away. You take home about ₹{net:,.0f}.",
        "hi": "{kg:g} किलो {m} का सबसे अच्छा खरीदार: {r} — ₹{p:.0f}/किलो, {d} किमी दूर। आपके हाथ में लगभग ₹{net:,.0f}।",
        "mr": "{kg:g} किलो {m} साठी सर्वोत्तम खरेदीदार: {r} — ₹{p:.0f}/किलो, {d} किमी दूर. तुमच्या हातात सुमारे ₹{net:,.0f}.",
    },
    "rate": {
        "en": "{m}: about ₹{p:.0f}/kg today.",
        "hi": "{m}: आज लगभग ₹{p:.0f}/किलो।",
        "mr": "{m}: आज सुमारे ₹{p:.0f}/किलो.",
    },
    "demand": {
        "en": "{b} needs {kg:.0f} kg {m} at ₹{p:.0f}/kg (by {dl}).",
        "hi": "{b} को {kg:.0f} किलो {m} चाहिए, ₹{p:.0f}/किलो ({dl} तक)।",
        "mr": "{b} ला {kg:.0f} किलो {m} हवे, ₹{p:.0f}/किलो ({dl} पर्यंत).",
    },
    "best": {
        "en": "Highest rates today: {list}. Scan your scrap to get exact offers.",
        "hi": "आज सबसे ऊँचे भाव: {list}। सही ऑफ़र के लिए अपना कबाड़ स्कैन करें।",
        "mr": "आज सर्वाधिक दर: {list}. अचूक ऑफरसाठी भंगार स्कॅन करा.",
    },
    "mine": {
        "en": "You've sold {lots} lots, {kg:.0f} kg, earning ₹{inr:,.0f}. Tier: {tier}.",
        "hi": "आपने {lots} लॉट, {kg:.0f} किलो बेचा और ₹{inr:,.0f} कमाए। स्तर: {tier}।",
        "mr": "तुम्ही {lots} लॉट, {kg:.0f} किलो विकले आणि ₹{inr:,.0f} कमावले. स्तर: {tier}.",
    },
    "safety": {
        "en": "Safety: wear gloves, never burn cables, never break batteries or TV tubes. Keep batteries dry, in sand.",
        "hi": "सुरक्षा: दस्ताने पहनें, तार कभी न जलाएँ, बैटरी या टीवी ट्यूब न तोड़ें। बैटरी सूखी जगह, रेत में रखें।",
        "mr": "सुरक्षा: हातमोजे घाला, तार कधीही जाळू नका, बॅटरी किंवा टीव्ही ट्यूब फोडू नका. बॅटरी कोरड्या जागी, वाळूत ठेवा.",
    },
    "help": {
        "en": "I can compare buyers, tell today's rates, find buyer demands and give safety tips. Try: 'best price for 40 kg copper'.",
        "hi": "मैं खरीदारों की तुलना, आज के भाव, खरीदार की मांग और सुरक्षा बता सकता हूँ। पूछें: '40 किलो तांबे का सबसे अच्छा दाम'।",
        "mr": "मी खरेदीदारांची तुलना, आजचे दर, मागणी आणि सुरक्षा सांगू शकतो. विचारा: '40 किलो तांब्याचा सर्वोत्तम दर'.",
    },
}

SAFETY_WORDS = ("safe", "safety", "danger", "hazard", "सुरक्षा", "खतरा", "सुरक्षित", "धोका", "swollen", "फूली", "फुगलेली")
DEMAND_WORDS = ("demand", "buyer need", "मांग", "मागणी", "who needs", "किसे चाहिए")
MINE_WORDS = ("my ", "मेरे", "मेरी", "माझे", "माझी", "earned", "कमाई", "कमाए", "कमावले")
BEST_WORDS = ("what should", "which", "best", "most", "collect", "क्या", "कौन", "सबसे", "काय", "कोणते", "सर्वात")


def _offline_agent(ctx: AgentContext) -> Tuple[str, List[AssistantAction], List[AssistantStep]]:
    lang = ctx.req.language if ctx.req.language in ("en", "hi", "mr") else "hi"
    question = next((m.content for m in reversed(ctx.req.messages) if m.role == "user"), "")
    q = f" {question.lower()} "
    material = find_material(question)
    weight = find_weight(question) or 35.0
    steps: List[AssistantStep] = []

    def call(name: str, **args: Any) -> Dict[str, Any]:
        steps.append(_summarise(name, args))
        return run_tool(ctx, name, args)

    if any(w in q for w in SAFETY_WORDS):
        res = call("get_safety", material=material)
        return res.get("advice") or TEXT["safety"][lang], [AssistantAction(type="open_scan")], steps

    if any(w in q for w in DEMAND_WORDS):
        res = call("get_open_demands", material=material)
        lines = [
            TEXT["demand"][lang].format(b=d["buyer"], kg=d["kg_needed"], m=d["material"], p=d["price_per_kg"], dl=d["deadline"])
            for d in res["demands"][:3]
        ]
        return "\n".join(lines) or TEXT["help"][lang], [AssistantAction(type="open_demands")], steps

    if any(w in q for w in MINE_WORDS) and ctx.collector:
        res = call("get_my_lots")
        life = res["lifetime"]
        return (
            TEXT["mine"][lang].format(lots=life["lots"], kg=life["kg"], inr=life["earned_inr"], tier=life["tier"]),
            [AssistantAction(type="open_earnings")],
            steps,
        )

    if material:
        res = call("get_best_offers", material=material, weight_kg=weight)
        offers = res.get("offers") or []
        if offers:
            o = offers[0]
            reply = TEXT["offers"][lang].format(kg=weight, m=material, r=o["recycler"], p=o["price_per_kg"], d=o["distance_km"], net=o["take_home_inr"])
        else:
            rate = call("get_rates", material=material)
            reply = TEXT["rate"][lang].format(m=material, p=rate["rate_per_kg"])
        return reply, [AssistantAction(type="open_market", material=material, weight_kg=weight)], steps  # type: ignore[arg-type]

    if any(w in q for w in BEST_WORDS):
        res = call("get_rates")
        top = list(res["rates_per_kg"].items())[:3]
        return (
            TEXT["best"][lang].format(list=", ".join(f"{m} ₹{p:.0f}" for m, p in top)),
            [AssistantAction(type="open_opportunity"), AssistantAction(type="open_scan")],
            steps,
        )

    return TEXT["help"][lang], [AssistantAction(type="open_rates")], steps


# ─── Public API ──────────────────────────────────────────────────────────────

SUGGESTIONS = {
    "en": ["Best price for 40 kg copper?", "What should I collect today?", "Is a swollen battery safe?", "Which buyers need scrap?"],
    "hi": ["40 किलो तांबे का सबसे अच्छा दाम?", "आज क्या इकट्ठा करूँ?", "फूली बैटरी सुरक्षित है?", "किस खरीदार को कबाड़ चाहिए? (मांग)"],
    "mr": ["40 किलो तांब्याचा सर्वोत्तम दर?", "आज काय गोळा करू?", "फुगलेली बॅटरी सुरक्षित आहे?", "कोणत्या खरेदीदारांची मागणी आहे?"],
}


def chat(db: Session, req: AssistantChatRequest) -> AssistantChatResponse:
    ctx = AgentContext(db, req)
    suggestions = SUGGESTIONS.get(req.language, SUGGESTIONS["hi"])

    providers: List[Tuple[str, Callable[[str, List[Dict[str, str]]], str]]] = []
    if hf_available():
        providers.append(("huggingface", lambda system, msgs: hf_chat([{"role": "system", "content": system}, *msgs])))
    if gemini_available():
        providers.append(("gemini", lambda system, msgs: gemini_chat(system, msgs)))

    for name, complete in providers:
        try:
            reply, actions, steps = _llm_agent(ctx, complete)
            if reply:
                return AssistantChatResponse(reply=reply, provider=name, suggestions=suggestions, actions=actions, steps=steps)
        except AIProviderError as exc:
            print(f"[MHK assistant] {name} failed: {exc}")

    reply, actions, steps = _offline_agent(ctx)
    return AssistantChatResponse(reply=reply, provider="offline", suggestions=suggestions, actions=actions, steps=steps)
