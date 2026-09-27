"""
Build data/india_rate_cards.json from the raw city rate cards in tools/raw_rate_cards_*.txt.

Cleaning rules (the raw extraction has obvious slips, e.g. "Iron | 1000 | pcs"):
  1. an item's unit is the unit most cities report; values in another unit are dropped
  2. zero rates are dropped (item not bought in that city)
  3. values more than 3× away from the item's median across cities are dropped
Every drop is listed under "dropped" so the cleaning can be audited.

Usage (from apps/backend):  python tools/build_rate_cards.py tools/raw_rate_cards_2026-09-27.txt
"""

import json
import os
import re
import statistics
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "india_rate_cards.json")

# Approximate city-centre coordinates (used to pick the nearest city's card).
CITIES = {
    "mumbai": ("Mumbai", "Maharashtra", 19.0760, 72.8777),
    "pune": ("Pune", "Maharashtra", 18.5204, 73.8567),
    "nagpur": ("Nagpur", "Maharashtra", 21.1458, 79.0882),
    "delhi": ("Delhi", "Delhi", 28.6139, 77.2090),
    "noida": ("Noida", "Uttar Pradesh", 28.5355, 77.3910),
    "ghaziabad": ("Ghaziabad", "Uttar Pradesh", 28.6692, 77.4538),
    "gurgaon": ("Gurugram", "Haryana", 28.4595, 77.0266),
    "lucknow": ("Lucknow", "Uttar Pradesh", 26.8467, 80.9462),
    "jaipur": ("Jaipur", "Rajasthan", 26.9124, 75.7873),
    "ahmedabad": ("Ahmedabad", "Gujarat", 23.0225, 72.5714),
    "bhopal": ("Bhopal", "Madhya Pradesh", 23.2599, 77.4126),
    "indore": ("Indore", "Madhya Pradesh", 22.7196, 75.8577),
    "raipur": ("Raipur", "Chhattisgarh", 21.2514, 81.6296),
    "bangalore": ("Bengaluru", "Karnataka", 12.9716, 77.5946),
    "hyderabad": ("Hyderabad", "Telangana", 17.3850, 78.4867),
}


def parse(path):
    cards, city = defaultdict(dict), None
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("# "):
            continue
        if line.startswith("## "):
            city = line[3:].strip()
            continue
        item, rate, unit = [p.strip() for p in line.split("|")]
        cards[city][item] = (float(rate), unit)
    return cards


def build(path):
    raw = parse(path)
    retrieved = re.search(r"(\d{4}-\d{2}-\d{2})", os.path.basename(path)).group(1)
    items = sorted({i for c in raw.values() for i in c})
    out_items, dropped = {}, []
    for item in items:
        obs = {c: raw[c][item] for c in raw if item in raw[c]}
        unit = Counter(u for _, u in obs.values()).most_common(1)[0][0]
        vals = {}
        for c, (v, u) in obs.items():
            if u != unit:
                dropped.append({"item": item, "city": c, "value": v, "unit": u, "reason": f"unit is {unit} in most cities"})
            elif v <= 0:
                dropped.append({"item": item, "city": c, "value": v, "unit": u, "reason": "zero (not bought)"})
            else:
                vals[c] = v
        if not vals:
            continue
        med = statistics.median(vals.values())
        for c, v in list(vals.items()):
            if v > med * 3 or v < med / 3:
                dropped.append({"item": item, "city": c, "value": v, "unit": unit, "reason": f"outlier vs national median {med:g}"})
                del vals[c]
        if not vals:
            continue
        v = list(vals.values())
        out_items[item] = {
            "unit": unit,
            "national": {"median": statistics.median(v), "min": min(v), "max": max(v), "cities": len(v)},
            "cities": dict(sorted(vals.items())),
        }
    return {
        "_comment": "Doorstep scrap rates (what a household is paid, INR) per city. Built by tools/build_rate_cards.py "
                    "from public rate cards; see 'dropped' for values removed during cleaning.",
        "source": {"name": "The Kabadiwala — published city rate cards", "url": "https://www.thekabadiwala.com/scrap-rates",
                   "retrieved_on": retrieved, "official": False, "rate_level": "doorstep"},
        "cities": {k: {"name": n, "state": s, "latitude": la, "longitude": lo} for k, (n, s, la, lo) in CITIES.items() if k in raw},
        "items": out_items,
        "dropped": dropped,
    }


if __name__ == "__main__":
    data = build(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "raw_rate_cards_2026-09-27.txt"))
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
    print(f"{len(data['cities'])} cities, {len(data['items'])} items, {len(data['dropped'])} values dropped -> {os.path.normpath(OUT)}")
