# Mai Hu Kabadiwala (मैं हूँ कबाड़ीवाला)


A platform that turns informal scrap collectors (kabadiwalas) into data-driven micro-entrepreneurs.
Households and companies book doorstep pickups, kabadiwalas identify and price scrap with AI, sell it
to verified recyclers at the best take-home price, and every kilo is traced from doorstep to recycler
with a QR/PIN handover, payment receipt and EPR certificate.

- **Mobile app** (Expo / React Native, Hindi · Marathi · English): kabadiwalas, households, companies
- **Recycler console** (web): buyers verify lots by QR, pay, post demand, set prices
- **Authority dashboard** (web): admins approve companies, watch pickups, regions and risk
- **Backend** (FastAPI + SQLite): the source of truth for all three

How it is built: [architect.md](architect.md) · What is real, simulated and tested: [STATUS.md](STATUS.md)

---

## Features

### Kabadiwala (collector) app
| Area | What it does |
|---|---|
| Sign-up & KYC | Phone + OTP, name, language; KYC (Aadhaar last 4, PAN, bank) before accepting jobs |
| Home | Total collected (sold + not yet sold), 8-week graph with weekly kg, trending prices, pickup requests waiting |
| Pickup requests | **Every** open request from homes and companies, **nearest first** from the phone's live GPS (falls back to saved address); distance on each card; accept, navigate, complete with the customer's PIN |
| Today's plan | Home opens with the next useful move: accepted jobs in the shortest riding order (km, time, fuel, open in Maps), a pickup that sits on that route, or whether to sell, hold, or collect more of what's already in hand |
| Scan & identify | 1–4 photos per lot, AI material recognition with multi-photo consensus, hazard + safety warnings, weight and quality |
| Valuation | Fair price for the lot (AI valuation), compared with what a local middleman would pay |
| Market | Verified buyers ranked by **take-home money** after pickup and fees; works offline with on-device estimates |
| Handover pass | QR code + 4-digit PIN the recycler scans; status flips to PAID after settlement |
| Earnings | Lifetime earnings, material breakdown, business insights (underpriced sales, unsold stock value, best materials and buyers); tier (Bronze → Platinum) on Profile |
| Bazar bhav | Today's price for 18 materials **at your location**: metals from the live exchange market, household scrap (newspaper, books, cardboard, plastic, PET bottles, steel) from Indian city rate cards, plus a premium for nearby industry, buyers and demand — each price shows where it comes from and the doorstep rate; read aloud |
| Buyer demands | Open demand from recyclers (material, quantity, price, deadline) matched to your lots |
| Opportunities | What to collect next and where, scored from prices, demand and supply |
| Regional map | Hotspots, industry clusters, supply vs demand and a price heatmap around you — works in any city |
| Assistant | "Kabadi Sahayak" chat in Hindi/Marathi/English that looks up rates, buyers, demands and safety, and opens the right screen |
| Voice | Floating mic for voice commands, voice input for weight/material, screen narration |
| Notifications | New nearby pickups, buyer demand, payments and risk alerts |
| Offline | Everything is saved on the phone; lots listed without signal sync automatically when it returns |
| Accessibility | Simple mode (large text), voice navigation, three languages |
| Appearance | Dark (default), Light or Match phone — Settings → Appearance; the app restarts for a moment to apply it |

### Household & company app
| Area | What it does |
|---|---|
| Book a pickup | Material, estimated weight, date + time slot (up to 14 days ahead), GPS or saved address |
| Track | See who accepted, their phone, reschedule or cancel |
| Doorstep PIN | A 4-digit PIN the kabadiwala must enter to complete the pickup — proof the scrap was handed over |
| Company accounts | Seller companies book bulk pickups; buyer companies get the recycler console after admin approval |

### Recycler console (`apps/recycler-web`)
Verify (scan QR with camera, scan from a photo, or type Lot ID + PIN) · weigh and pay (UTR receipt + EPR certificate) ·
incoming lots · offers to kabadiwalas · post demand · set per-material prices (used live by the app's Market) ·
history · analytics. New buyer companies are locked until an admin approves them.

### Authority dashboard (`apps/admin-web`)
Overview totals and material flow · company approvals · households · all pickups with status filters ·
regional intelligence map · risk scan with 8 fraud/anomaly detectors.

---

## Telegram bot

Same features on Telegram, in Hindi, Marathi or English — no app install needed. It uses long polling, so it runs from
the same laptop as the backend with **no public URL or tunnel**.

1. In Telegram open **@BotFather** → `/newbot` → pick a name → copy the token.
2. Add it to `apps/backend/.env`: `TELEGRAM_BOT_TOKEN=123456:ABC…`
3. With the backend running on :8000: `cd apps/backend && python -m bot.run`

| Who | What they can do |
|---|---|
| Anyone | `/start` → share phone number (verified by Telegram) → linked to their existing account, or registered as a household |
| Household / company | 🛺 book a pickup (pick material or send a photo → kg → location → time slot → confirm with price estimate) → PIN; 📦 my pickups; 💰 doorstep rates; alerts when a kabadiwala accepts and when it's done |
| Kabadiwala | 📍 open pickups nearest first → accept (customer phone + map link) → 🏁 complete with the PIN; 💰 today's rates; 📷 value scrap from a photo; 🔔 alerts for new pickups within 25 km |
| Everyone | any other message goes to the assistant; `/lang` switches language |

Voice notes are not supported yet. Tests: `python -m pytest test_telegram_bot.py -q`.

---

## How prices are calculated

```text
metals & e-waste   market value = Σ metal content × live exchange price (COMEX copper/aluminium/gold/silver/palladium,
                                  NYMEX steel, via Yahoo Finance, × live USD/INR) × share scrap buyers pay
household scrap    market value = nearest city's doorstep rate card ÷ 0.70  (15 cities; India median beyond 150 km)
local price        = market value × (1 + premium)   premium 0–15% = nearby industry clusters that use the material (≤8%)
                                                                    + verified buyers of it within 25 km (≤4%)
                                                                    + open buyer demand within 50 km (≤3%)
doorstep price     = local price × 0.70   (what a household is paid; the kabadiwala's margin covers transport and sorting)
fair price (AI)    = local price × quality (0.72 / 1.00 / 1.28) × volume (0.90 at 1 kg … 1.10 at 1,000 kg)
buyer offer        = buyer's price × kg − pickup (₹ base + ₹15/km beyond 2 km) − handling − platform fee
```
Demo buyers' prices follow the market (their seed spread × local price) until a buyer types its own price in the console.
Recipes and rate cards are data files: `apps/backend/data/material_markets.json`, `data/india_rate_cards.json`
(rebuilt from `tools/raw_rate_cards_*.txt` by `tools/build_rate_cards.py`). Official Indian feeds (MCX via a licensed
vendor, the government WPI for paper/plastic) are the planned upgrade — see STATUS.md.

---

## Run it

**Prerequisites:** Python 3.11+, Node.js 20+, Expo Go on your phone (optional).

```bash
cp apps/backend/.env.example apps/backend/.env                  # all optional — no keys = offline AI
cp apps/collector-mobile/.env.example apps/collector-mobile/.env

# 1. Backend  → http://<your-PC-IP>:8000   (API docs at /docs)
cd apps/backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000

# 2. Mobile app  → press w for web, or scan the QR with Expo Go
cd apps/collector-mobile
npm install
npx expo start --lan            # add REACT_NATIVE_PACKAGER_HOSTNAME=<PC Wi-Fi IP> if the phone can't connect

# 3. Web portals (serve the folders)
cd apps
python -m http.server 3000 --directory recycler-web     # recycler console
python -m http.server 3001 --directory admin-web        # authority dashboard
```

- Phone and PC must be on the **same Wi-Fi or hotspot**. The app swaps `localhost` for the PC's address automatically.
- The portals talk to port 8000 on whichever machine served them, so they also work from another laptop or a phone
  on the same network (`http://<PC-IP>:3000`). Add `?api=http://host:port` to point them elsewhere.
- On a laptop browser the app shows as a fixed phone-width column.

### Environment
| Backend (`apps/backend/.env`) | Default |
|---|---|
| `HF_API_TOKEN` — Hugging Face token for photo recognition + assistant | empty (offline fallbacks) |
| `GEMINI_API_KEY` — optional second assistant provider | empty |
| `VISION_BACKEND` — `auto` / `hf` / `local` / `off` | `auto` |
| `ENABLE_LOCAL_CLIP` — allow the ~600 MB offline vision model | `true` |
| `MHK_DB_PATH` — SQLite file | `data/mhk.db` |
| `MHK_ALLOWED_ORIGINS` — CORS | `*` |

| Mobile (`apps/collector-mobile/.env`, bundled into the app — **never put keys here**) | Default |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` (ends in `/api`) | `http://localhost:8000/api` |
| `EXPO_PUBLIC_DEFAULT_LATITUDE` / `_LONGITUDE` — used only when GPS and saved address are both missing | Pune |
| `EXPO_PUBLIC_DEFAULT_LOCALE` — `hi` / `mr` / `en` | `hi` |
| `EXPO_PUBLIC_API_TIMEOUT_MS`, `EXPO_PUBLIC_TTS_SPEECH_RATE`, `EXPO_PUBLIC_SYNC_INTERVAL_MS` | 15000, 0.92, 30000 |

### Tests
```bash
cd apps/backend && python -m pytest test_backend.py test_pricing.py -q   # 57 tests, fresh temp DB, offline
# add MHK_LIVE_TESTS=1 to also check the real exchange feed
cd apps/collector-mobile && npm test && npm run typecheck    # jest + TypeScript
```
**Before a demo**, run the full role-by-role walkthrough (35 steps) against a throwaway server — see the top of
[`apps/backend/demo_check.py`](apps/backend/demo_check.py). It refuses to write into the demo server on :8000.

---

## Demo script (≈12 minutes)

Demo accounts: kabadiwala **+91 98765 43210** (Ramesh Kumar, KYC verified) · recycler console: any of the four
demo buyers on the sign-in page (e.g. `eco-cycle`) · OTP in the app is always **1234**.
Keep a second browser tab or phone ready for the household.

**1. The problem, in one screen (1 min).** Open the app as Ramesh → Home: total collected, the 8-week graph
("This week: X kg"), trending prices, pickups waiting. Tap the location/search/bell to show it's a full app, in Hindi.

**2. A household books a pickup (2 min).** On a second device: Onboarding → choose *Household* → new phone, OTP 1234
→ name + area → *Book a pickup*: Brass fittings, 5 kg, tomorrow morning. Show the **doorstep PIN** on their home screen.

**3. The kabadiwala finds it — nearest first (1 min).** Ramesh → *Pickup requests*: every open request is listed,
nearest on top, with distance and "sorted from your current location". Mention: a kabadiwala in Delhi would see the
same list with Delhi on top. Tap *Accept* → success screen → the household now sees who is coming.

**4. Doorstep proof (1 min).** Open the job → enter a wrong PIN (refused) → enter the household's PIN + actual weight
→ completed. Back on Home: total collected and "This week" go up by the weight, marked "not sold yet".

**5. Scan and value scrap (2 min).** Tap **+** → take 1–4 photos of any e-waste → AI names the material, shows hazards
and safety steps → set weight → valuation vs middleman price → *Market*: buyers ranked by take-home money, not
headline price.

**6. Sell and hand over with QR (2 min).** Choose the best buyer → *Handover pass* with QR + PIN. On the laptop open
the recycler console → sign in as that buyer → *Scan QR with camera* (or *Scan from photo* on a phone) → lot verified →
enter audited weight → pay → UTR receipt + EPR certificate. The app's pass flips to **PAID** and earnings update.

**7. Buyers drive demand (1 min).** Recycler console → *Demands* → post "Aluminium, 400 kg, ₹170/kg" and *Prices* →
change a price. In the app: *Buyer demands* shows it; Market uses the new price immediately.

**8. Works with bad network (1 min).** Turn on airplane mode → Market still shows buyers ("offline — estimated offers")
→ choose one → "Saved on phone, will sync". Turn network back on → it syncs by itself within ~30 s.

**9. Intelligence for the city (1 min).** *Regional map* (hotspots, industry clusters, price heatmap) →
*Opportunities* → ask the assistant "आज तांबे का भाव क्या है?" or use the mic.

**10. The authority's view (1 min).** Admin dashboard (`:3001`): overview and material flow, approve a new buyer
company, all pickups, regional map, *Risk* → run scan (duplicate lots, weight mismatches, price outliers…).

**If something goes wrong on stage:** no pickups listed → create one from the household app (step 2); phone can't
reach the server → same Wi-Fi/hotspot and `REACT_NATIVE_PACKAGER_HOSTNAME`; web app looks stale → Ctrl+Shift+R.

---

## Repository

```text
mai-hu-kabadiwala/
├── README.md              ← you are here
├── STATUS.md              ← real vs simulated, tests, known limits, next steps
├── architect.md           ← system architecture
├── docs/archive/          ← original v1 product blueprint (vision document)
└── apps/
    ├── backend/           ← FastAPI + SQLite (routers/, services/, models/, data/, test_backend.py, demo_check.py)
    ├── collector-mobile/  ← Expo app (src/screens, src/ui design system, src/services, src/store, src/i18n)
    ├── recycler-web/      ← recycler console (single HTML file + vendored QR decoder)
    └── admin-web/         ← authority dashboard (single HTML file)
```
