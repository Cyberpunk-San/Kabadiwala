# apps/backend/bot/brain.py
"""
What the bot does with each Telegram update. It talks to the backend over its public HTTP API
(the same one the app uses), so the bot can run anywhere that can reach the server.

Linking: /start → "share my phone number" button → Telegram sends a verified contact → /auth/login.
Kabadiwala: nearby open pickups (nearest first) → accept → complete with the customer's PIN; rates; photo valuation.
Household/company: book a pickup (material or photo → kg → location → slot → confirm) → PIN; my pickups; rates.
Any other text goes to the assistant. A background poll sends alerts: new pickups near a kabadiwala,
and "accepted" / "completed" to the household that booked.
"""

from __future__ import annotations

import base64
import re
import time
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

import httpx

from .store import Chat, Store, fresh_location
from .telegram_api import Telegram, inline_keyboard, reply_keyboard
from .texts import labels, material_name, t

API = "/api/v1"
ALERT_RADIUS_KM = 25
BOOK_MATERIALS = [
    "Newspaper", "Books & notebooks", "Cardboard", "Mixed plastic", "PET bottles", "Stainless steel",
    "Iron & steel scrap", "Aluminium", "Copper cable", "Brass fittings", "Mixed e-waste", "Lead acid batteries",
]
RATE_MATERIALS = [
    "Copper cable", "Brass fittings", "Aluminium", "Stainless steel", "Iron & steel scrap", "Printed Circuit Boards (PCB)",
    "Newspaper", "Books & notebooks", "Cardboard", "PET bottles", "Mixed plastic", "Mixed e-waste",
]
HOUSEHOLD_FIRST = RATE_MATERIALS[6:] + RATE_MATERIALS[:6]


class ServerDown(Exception):
    pass


def money(x: float) -> str:
    return f"{round(x):,}"


def per_kg(x: float) -> str:
    return f"{x:g}" if x < 100 else f"{round(x):,}"


def parse_kg(text: str) -> Optional[float]:
    m = re.search(r"\d+(?:[.,]\d+)?", text or "")
    if not m:
        return None
    v = float(m.group(0).replace(",", "."))
    return v if 0 < v <= 100000 else None


def _reset(chat: Chat) -> None:
    """Leave the current flow but keep what we know about the user (saved address)."""
    chat.step = ""
    chat.draft = {k: v for k, v in (chat.draft or {}).items() if k in ("home", "address")}


class Bot:
    def __init__(self, tg: Telegram, api: httpx.Client, store: Store):
        self.tg, self.api, self.store = tg, api, store

    # ── backend calls ────────────────────────────────────────────────────────
    def _call(self, method: str, path: str, **kw) -> httpx.Response:
        try:
            return self.api.request(method, API + path, **kw)
        except httpx.HTTPError as e:
            raise ServerDown(str(e)) from e

    def _json(self, method: str, path: str, ok=(200, 201), **kw) -> Any:
        res = self._call(method, path, **kw)
        if res.status_code not in ok:
            raise ServerDown(f"{method} {path} → {res.status_code}")
        return res.json()

    # ── entry points ─────────────────────────────────────────────────────────
    def handle(self, update: Dict[str, Any]) -> None:
        chat_id = (update.get("message") or update.get("callback_query", {}).get("message") or {}).get("chat", {}).get("id")
        if chat_id is None:
            return
        chat = self.store.get(chat_id)
        try:
            if "callback_query" in update:
                self._on_callback(chat, update["callback_query"])
            else:
                self._on_message(chat, update["message"])
        except ServerDown:
            self.tg.send(chat_id, t("server_down", chat.language))
        finally:
            self.store.save(chat)

    # ── messages ─────────────────────────────────────────────────────────────
    def _on_message(self, chat: Chat, msg: Dict[str, Any]) -> None:
        if not chat.phone and not chat.step:
            code = (msg.get("from", {}).get("language_code") or "").split("-")[0]
            chat.language = code if code in ("hi", "mr", "en") else "en"
        text = (msg.get("text") or "").strip()

        if text.startswith("/"):
            return self._command(chat, text.split()[0].split("@")[0].lower())
        if "contact" in msg:
            return self._on_contact(chat, msg)
        if not chat.linked:
            if chat.step == "register_name" and text:
                return self._register(chat, text)
            return self._welcome(chat)
        if "location" in msg:
            chat.lat, chat.lon = msg["location"]["latitude"], msg["location"]["longitude"]
            chat.located_at = time.time()
            return self._after_location(chat)
        if "photo" in msg:
            return self._on_photo(chat, msg["photo"][-1]["file_id"])
        if "voice" in msg or "audio" in msg:
            return self.tg.send(chat.chat_id, t("voice_later", chat.language))
        if not text:
            return

        # Steps waiting for a typed answer
        if chat.step in ("book_kg", "value_kg", "complete_kg"):
            kg = parse_kg(text)
            if kg is None:
                return self.tg.send(chat.chat_id, t("bad_number", chat.language))
            return {"book_kg": self._book_kg, "value_kg": self._value_kg, "complete_kg": self._complete_kg}[chat.step](chat, kg)
        if chat.step == "complete_pin":
            return self._complete_pin(chat, text)

        # Menu buttons (recognised in any language)
        for key, action in (("m_nearby", self._nearby), ("m_rates", self._rates), ("m_jobs", self._jobs), ("m_value", self._value_start),
                            ("m_book", self._book_start), ("m_mine", self._mine), ("m_help", self._help)):
            if text in labels(key):
                _reset(chat)
                return action(chat)
        return self._ask_assistant(chat, text)

    def _command(self, chat: Chat, cmd: str) -> None:
        _reset(chat)
        if cmd == "/start":
            if chat.linked:
                return self._send_menu(chat, t("linked", chat.language, name=chat.name, role=t(f"role_{chat.role}", chat.language)))
            return self._welcome(chat)
        if cmd == "/lang":
            return self.tg.send(chat.chat_id, t("lang_pick", chat.language),
                                inline_keyboard([[("English", "lang:en"), ("हिंदी", "lang:hi"), ("मराठी", "lang:mr")]]))
        if cmd in ("/help", "/menu"):
            return self._help(chat) if chat.linked else self._welcome(chat)
        return self._help(chat) if chat.linked else self._welcome(chat)

    # ── linking an account ───────────────────────────────────────────────────
    def _welcome(self, chat: Chat) -> None:
        self.tg.send(chat.chat_id, t("welcome", chat.language),
                     reply_keyboard([[{"text": t("share_phone_btn", chat.language), "request_contact": True}]], one_time=True))

    def _on_contact(self, chat: Chat, msg: Dict[str, Any]) -> None:
        contact = msg["contact"]
        if contact.get("user_id") != msg.get("from", {}).get("id"):
            return self.tg.send(chat.chat_id, t("own_contact_only", chat.language))
        phone = re.sub(r"\D", "", contact["phone_number"])[-10:]
        chat.phone = phone
        res = self._call("POST", "/auth/login", json={"phone": phone})
        if res.status_code == 404:
            chat.step = "register_name"
            return self.tg.send(chat.chat_id, t("not_registered", chat.language), {"remove_keyboard": True})
        if res.status_code != 200:
            raise ServerDown(str(res.status_code))
        self._link(chat, res.json())

    def _register(self, chat: Chat, name: str) -> None:
        if len(name) < 2:
            return self.tg.send(chat.chat_id, t("name_too_short", chat.language))
        body = {"phone": chat.phone, "name": name[:80], "language": chat.language}
        if chat.lat is not None:
            body.update(latitude=chat.lat, longitude=chat.lon)
        profile = self._json("POST", "/households/register", json=body)
        self._link(chat, {"role": "household", "household": profile})

    def _link(self, chat: Chat, login: Dict[str, Any]) -> None:
        role = login["role"]
        profile = login.get("collector") or login.get("household") or login.get("company") or {}
        chat.role, chat.account_id, chat.name = role, profile.get("id"), (profile.get("name") or "").split(" ")[0]
        if profile.get("language") in ("en", "hi", "mr"):
            chat.language = profile["language"]
        chat.draft = {"home": [profile.get("latitude"), profile.get("longitude")], "address": profile.get("address") or profile.get("operating_area")}
        chat.step = ""
        self._send_menu(chat, t("linked", chat.language, name=chat.name or "", role=t(f"role_{role}", chat.language)))

    def _send_menu(self, chat: Chat, text: str) -> None:
        L = chat.language
        rows = ([[t("m_nearby", L), t("m_rates", L)], [t("m_jobs", L), t("m_value", L)], [t("m_help", L)]]
                if chat.role == "kabadiwala" else
                [[t("m_book", L), t("m_mine", L)], [t("m_rates", L), t("m_help", L)]])
        self.tg.send(chat.chat_id, text, reply_keyboard(rows))

    def _help(self, chat: Chat) -> None:
        self._send_menu(chat, t("help_k" if chat.role == "kabadiwala" else "help_h", chat.language))

    # ── location ─────────────────────────────────────────────────────────────
    def _where(self, chat: Chat, max_age_s: int = 1800) -> Optional[tuple]:
        if fresh_location(chat, max_age_s):
            return chat.lat, chat.lon
        home = (chat.draft or {}).get("home") or [None, None]
        return (home[0], home[1]) if home[0] is not None else None

    def _ask_location(self, chat: Chat, step: str, text_key: str = "ask_location", saved: bool = False) -> None:
        chat.step = step
        L = chat.language
        rows = [[{"text": t("send_location_btn", L), "request_location": True}]]
        self.tg.send(chat.chat_id, t(text_key, L), reply_keyboard(rows, one_time=True))
        if saved:
            self.tg.send(chat.chat_id, "⬇", inline_keyboard([[(t("use_saved_btn", L), "loc:saved")]]))

    def _after_location(self, chat: Chat) -> None:
        step, chat.step = chat.step, ""
        if step == "rates_loc":
            return self._rates(chat)
        if step == "nearby_loc":
            return self._nearby(chat)
        if step == "book_where":
            chat.draft["where"] = [chat.lat, chat.lon]
            return self._book_when(chat)
        if step == "value_loc" and chat.draft.get("kg"):
            return self._value_kg(chat, chat.draft["kg"])
        self._send_menu(chat, "📍 ✔")

    # ── rates ────────────────────────────────────────────────────────────────
    def _rates(self, chat: Chat) -> None:
        where = self._where(chat, 24 * 3600)
        if not where:
            return self._ask_location(chat, "rates_loc")
        data = self._json("GET", f"/prices/daily?latitude={where[0]}&longitude={where[1]}")
        by = {p["material"]: p for p in data["prices"]}
        L = chat.language
        kab = chat.role == "kabadiwala"
        lines = [t("rates_title", L)]
        for m in (RATE_MATERIALS if kab else HOUSEHOLD_FIRST):
            p = by.get(m)
            if not p:
                continue
            if kab:
                lines.append(t("rates_line_k", L, name=material_name(m, L), price=per_kg(p["current_price"])))
            else:
                lines.append(t("rates_line_h", L, name=material_name(m, L), door=per_kg(p["doorstep_price"])))
        lines.append("\n<i>" + t("rates_live" if data["market"]["mode"] != "reference" else "rates_reference", L) + "</i>")
        self._send_menu(chat, "\n".join(lines))

    # ── kabadiwala: nearby pickups, accept, complete ────────────────────────
    def _nearby(self, chat: Chat) -> None:
        where = self._where(chat)
        if not where:
            return self._ask_location(chat, "nearby_loc")
        rows = self._json("GET", f"/pickups?latitude={where[0]}&longitude={where[1]}")[:5]
        L = chat.language
        if not rows:
            return self._send_menu(chat, t("nearby_none", L))
        lines = [t("nearby_title", L)]
        buttons = []
        for i, p in enumerate(rows, 1):
            lines.append(t("nearby_line", L, i=i, material=material_name(p["material"], L), kg=f"{p['estimated_weight_kg']:g}",
                           km=p["distance_km"] if p["distance_km"] is not None else "?", value=money(p["estimated_value"]),
                           area=p.get("address") or p.get("requester_name") or ""))
            buttons.append((t("accept_btn", L, i=i), f"acc:{p['id']}"))
        self.tg.send(chat.chat_id, "\n".join(lines), inline_keyboard([buttons[i:i + 3] for i in range(0, len(buttons), 3)]))

    def _accept(self, chat: Chat, pickup_id: str) -> None:
        L = chat.language
        res = self._call("POST", f"/pickups/{pickup_id}/accept", json={"collector_id": chat.account_id})
        if res.status_code == 409:
            return self.tg.send(chat.chat_id, t("accept_taken", L))
        if res.status_code == 403:
            return self.tg.send(chat.chat_id, t("accept_kyc", L))
        if res.status_code != 200:
            raise ServerDown(str(res.status_code))
        p = res.json()
        maps = f"https://maps.google.com/?q={p['latitude']},{p['longitude']}" if p.get("latitude") is not None else "—"
        self.tg.send(chat.chat_id,
                     t("accepted", L, material=material_name(p["material"], L), kg=f"{p['estimated_weight_kg']:g}",
                       name=p.get("requester_name") or "", phone=p.get("requester_phone") or "—", address=p.get("address") or "—", map=maps),
                     inline_keyboard([[(t("complete_btn", L, material=material_name(p["material"], L)), f"comp:{p['id']}")]]))

    def _jobs(self, chat: Chat) -> None:
        L = chat.language
        jobs = [p for p in self._json("GET", f"/pickups?collector_id={chat.account_id}") if p["status"] == "ACCEPTED"]
        if not jobs:
            return self._send_menu(chat, t("jobs_none", L))
        lines = [t("jobs_title", L)] + [f"• {material_name(p['material'], L)} · {p['estimated_weight_kg']:g} kg · {p.get('requester_name') or ''} · 📞 {p.get('requester_phone') or '—'}" for p in jobs]
        self.tg.send(chat.chat_id, "\n".join(lines),
                     inline_keyboard([[(t("complete_btn", L, material=material_name(p["material"], L)), f"comp:{p['id']}")] for p in jobs]))

    def _complete_pin(self, chat: Chat, text: str) -> None:
        pin = re.sub(r"\D", "", text)
        if len(pin) != 4:
            return self.tg.send(chat.chat_id, t("ask_pin", chat.language))
        chat.draft["pin"] = pin
        chat.step = "complete_kg"
        self.tg.send(chat.chat_id, t("ask_actual_kg", chat.language))

    def _complete_kg(self, chat: Chat, kg: float) -> None:
        L = chat.language
        pid, pin = chat.draft.get("pickup"), chat.draft.get("pin")
        res = self._call("POST", f"/pickups/{pid}/complete", json={"collector_id": chat.account_id, "pickup_pin": pin, "actual_weight_kg": kg})
        if res.status_code == 401:
            chat.step = "complete_pin"
            return self.tg.send(chat.chat_id, t("wrong_pin", L))
        if res.status_code != 200:
            chat.step = ""
            raise ServerDown(str(res.status_code))
        p = res.json()
        _reset(chat)
        self._send_menu(chat, t("completed", L, paid=money(p["amount_paid"]), kg=f"{kg:g}", lot=p["lot_id"]))

    # ── kabadiwala: value scrap from a photo ────────────────────────────────
    def _value_start(self, chat: Chat) -> None:
        chat.step = "value_photo"
        self.tg.send(chat.chat_id, t("value_ask_photo", chat.language))

    def _classify(self, chat: Chat, file_id: str) -> Optional[Dict[str, Any]]:
        try:
            img = self.tg.download_file(file_id)
        except Exception:  # noqa: BLE001 — Telegram hiccup: let the user retry
            return None
        res = self._call("POST", "/vision/analyze", json={"image_base64": base64.b64encode(img).decode()})
        return res.json() if res.status_code == 200 else None

    def _on_photo(self, chat: Chat, file_id: str) -> None:
        L = chat.language
        if chat.role != "kabadiwala" and chat.step not in ("book_material",):
            self._book_start(chat, silent=True)
        if chat.role == "kabadiwala" and chat.step != "value_photo":
            chat.step = "value_photo"
        pred = self._classify(chat, file_id)
        if not pred:
            return self.tg.send(chat.chat_id, t("photo_failed", L))
        safety = f"\n⚠ {pred['safety_message']}" if pred.get("hazard") and pred.get("safety_message") else ""
        chat.draft["material"] = pred["material"]
        if chat.step == "value_photo":
            chat.step = "value_kg"
            return self.tg.send(chat.chat_id, t("value_seen", L, material=material_name(pred["material"], L), conf=round(pred["confidence"] * 100), safety=safety))
        chat.step = "book_kg"
        self.tg.send(chat.chat_id, t("value_seen", L, material=material_name(pred["material"], L), conf=round(pred["confidence"] * 100), safety=safety))

    def _value_kg(self, chat: Chat, kg: float) -> None:
        L = chat.language
        where = self._where(chat, 24 * 3600)
        if not where:
            chat.draft["kg"] = kg
            return self._ask_location(chat, "value_loc")
        m = chat.draft.get("material", "Mixed e-waste")
        v = self._json("POST", "/ml/valuation", json={"material": m, "quality": "medium", "weight_kg": kg, "latitude": where[0], "longitude": where[1]})
        offers = self._json("GET", "/marketplace/offers", params={"material": m, "weight_kg": kg, "latitude": where[0], "longitude": where[1]})
        chat.step = ""
        if offers:
            o = offers[0]
            text = t("value_result", L, fair=per_kg(v["fair_price_per_kg"]), payout=money(v["fair_payout"]), kg=f"{kg:g}",
                     buyer=o["recycler_name"], best=per_kg(o["listed_price_per_kg"]), net=money(o["net_earnings"]), why=v["reasoning"])
        else:
            text = t("value_no_buyer", L, fair=per_kg(v["fair_price_per_kg"]), payout=money(v["fair_payout"]), kg=f"{kg:g}")
        self._send_menu(chat, text)

    # ── household: book a pickup ─────────────────────────────────────────────
    def _book_start(self, chat: Chat, silent: bool = False) -> None:
        L = chat.language
        _reset(chat)
        chat.step = "book_material"
        if silent:
            return
        rows = [[(material_name(m, L), f"mat:{i}") for i, m in enumerate(BOOK_MATERIALS)][j:j + 2] for j in range(0, len(BOOK_MATERIALS), 2)]
        self.tg.send(chat.chat_id, t("book_material", L), inline_keyboard(rows))

    def _book_kg(self, chat: Chat, kg: float) -> None:
        chat.draft["kg"] = kg
        home = chat.draft.get("home") or [None, None]
        self._ask_location(chat, "book_where", "book_where", saved=home[0] is not None)

    def _book_when(self, chat: Chat) -> None:
        L = chat.language
        chat.step = "book_when"
        rows = [[(f"{t(d, L)} {t('slot_' + s, L)}", f"slot:{d[5:]}:{s}") for s in ("morning", "afternoon", "evening")] for d in ("slot_today", "slot_tomorrow")]
        rows.append([(t("slot_anytime", L), "slot:none:anytime")])
        self.tg.send(chat.chat_id, t("book_when", L), inline_keyboard(rows))

    def _book_confirm(self, chat: Chat) -> None:
        L = chat.language
        d = chat.draft
        lat, lon = d["where"]
        prices = {p["material"]: p for p in self._json("GET", f"/prices/daily?latitude={lat}&longitude={lon}")["prices"]}
        p = prices.get(d["material"])
        door = p["doorstep_price"] if p else 0
        when = t("slot_anytime", L) if d.get("day") == "none" else f"{t('slot_' + d['day'], L)} {t('slot_' + d['slot'], L)}"
        chat.step = "book_confirm"
        self.tg.send(chat.chat_id,
                     t("book_confirm", L, material=material_name(d["material"], L), kg=f"{d['kg']:g}", when=when,
                       estimate=money(door * d["kg"]), door=per_kg(door), source=p["source"] if p else "—"),
                     inline_keyboard([[(t("confirm_btn", L), "book:yes"), (t("cancel_btn", L), "book:no")]]))

    def _book_create(self, chat: Chat) -> None:
        d = chat.draft
        body = {"requester_type": "company" if chat.role == "company" else "household", "requester_id": chat.account_id,
                "material": d["material"], "estimated_weight_kg": d["kg"], "latitude": d["where"][0], "longitude": d["where"][1],
                "preferred_slot": d.get("slot", "anytime")}
        if d.get("day") in ("today", "tomorrow"):
            body["preferred_date"] = (date.today() + timedelta(days=1 if d["day"] == "tomorrow" else 0)).isoformat()
        pk = self._json("POST", "/pickups", json=body)
        self.store.kv_set(f"status:{pk['id']}", "OPEN")
        _reset(chat)
        self._send_menu(chat, t("booked", chat.language, pin=pk["pickup_pin"]))

    def _mine(self, chat: Chat) -> None:
        L = chat.language
        rows = self._json("GET", f"/pickups?requester_id={chat.account_id}")[:6]
        if not rows:
            return self._send_menu(chat, t("mine_none", L))
        lines = [t("mine_title", L)]
        for p in rows:
            status = t(f"status_{p['status']}", L, pin=p.get("pickup_pin") or "—", collector=p.get("collector_name") or "",
                       phone=p.get("collector_phone") or "—", paid=money(p.get("amount_paid") or 0))
            lines.append(f"• {material_name(p['material'], L)} · {p['estimated_weight_kg']:g} kg — {status}")
        self._send_menu(chat, "\n".join(lines))

    # ── buttons attached to messages ─────────────────────────────────────────
    def _on_callback(self, chat: Chat, cb: Dict[str, Any]) -> None:
        data = cb.get("data") or ""
        self.tg.answer_callback(cb["id"])
        if data.startswith("lang:"):
            chat.language = data[5:]
            return self._send_menu(chat, t("lang_set", chat.language)) if chat.linked else self._welcome(chat)
        if not chat.linked:
            return self._welcome(chat)
        kind, _, rest = data.partition(":")
        if kind == "acc" and chat.role == "kabadiwala":
            return self._accept(chat, rest)
        if kind == "comp" and chat.role == "kabadiwala":
            chat.step, chat.draft["pickup"] = "complete_pin", rest
            return self.tg.send(chat.chat_id, t("ask_pin", chat.language))
        if kind == "mat" and chat.step == "book_material":
            chat.draft["material"] = BOOK_MATERIALS[int(rest)]
            chat.step = "book_kg"
            return self.tg.send(chat.chat_id, t("book_kg", chat.language, material=material_name(chat.draft["material"], chat.language)))
        if kind == "loc" and chat.step == "book_where":
            chat.draft["where"] = chat.draft["home"]
            return self._book_when(chat)
        if kind == "slot" and chat.step == "book_when":
            chat.draft["day"], chat.draft["slot"] = rest.split(":")
            return self._book_confirm(chat)
        if kind == "book" and chat.step == "book_confirm":
            if rest == "yes":
                return self._book_create(chat)
            chat.step = ""
            return self._send_menu(chat, t("cancelled", chat.language))

    # ── free text → assistant ────────────────────────────────────────────────
    def _ask_assistant(self, chat: Chat, text: str) -> None:
        body: Dict[str, Any] = {"messages": [{"role": "user", "content": text[:1500]}], "language": chat.language}
        if chat.role == "kabadiwala":
            body["collector_id"] = chat.account_id
        where = self._where(chat, 24 * 3600)
        if where:
            body["location"] = {"latitude": where[0], "longitude": where[1]}
        reply = self._json("POST", "/assistant/chat", json=body)
        self._send_menu(chat, reply["reply"])

    # ── alerts (called every minute by run.py) ───────────────────────────────
    def poll_alerts(self) -> int:
        """New pickups near linked kabadiwalas; accepted/completed updates to linked households. Returns messages sent."""
        sent = 0
        chats = [c for c in self.store.all() if c.linked]
        seen = set(self.store.kv_get("seen_pickups", []))
        first_run = not self.store.kv_get("alerts_initialised", False)
        for c in chats:
            if c.role != "kabadiwala":
                continue
            where = self._where(c, 24 * 3600)
            if not where:
                continue
            try:
                near = self._json("GET", f"/pickups?latitude={where[0]}&longitude={where[1]}&radius_km={ALERT_RADIUS_KM}")
            except ServerDown:
                return sent
            for p in near:
                key = f"{c.chat_id}:{p['id']}"
                if key in seen:
                    continue
                seen.add(key)
                if first_run:
                    continue
                L = c.language
                self.tg.send(c.chat_id, t("n_new_pickup", L, km=p["distance_km"], material=material_name(p["material"], L),
                                          kg=f"{p['estimated_weight_kg']:g}", value=money(p["estimated_value"]), area=p.get("address") or ""),
                             inline_keyboard([[(t("accept_btn", L, i=""), f"acc:{p['id']}")]]))
                sent += 1
        for c in chats:
            if c.role not in ("household", "company"):
                continue
            try:
                mine = self._json("GET", f"/pickups?requester_id={c.account_id}")
            except ServerDown:
                return sent
            for p in mine:
                key = f"status:{p['id']}"
                before = self.store.kv_get(key)
                if before == p["status"]:
                    continue
                self.store.kv_set(key, p["status"])
                if before is None and first_run:
                    continue
                L = c.language
                if p["status"] == "ACCEPTED":
                    self.tg.send(c.chat_id, t("n_accepted", L, collector=p.get("collector_name") or "", material=material_name(p["material"], L),
                                              phone=p.get("collector_phone") or "—", pin=p.get("pickup_pin") or "—"))
                    sent += 1
                elif p["status"] == "COMPLETED":
                    self.tg.send(c.chat_id, t("n_completed", L, paid=money(p.get("amount_paid") or 0), kg=f"{p.get('actual_weight_kg') or 0:g}",
                                              material=material_name(p["material"], L)))
                    sent += 1
        self.store.kv_set("seen_pickups", sorted(seen)[-5000:])
        self.store.kv_set("alerts_initialised", True)
        return sent
