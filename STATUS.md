# Project Status — Mai Hu Kabadiwala

**Last updated:** 2026-09-27 · **Backend:** 3.0.0 · **Mobile:** Expo SDK 53
**State:** every role works end-to-end and is demo-ready. Payments, KYC, OTP, CPCB numbers and the price
history are simulated and labelled as such.

Run and demo instructions: [README.md](README.md) · Architecture: [architect.md](architect.md)

---

## 1. Capability scorecard

| # | Area | Status | Notes |
|---|---|---|---|
| 1 | Accounts & roles | ✅ | One phone login for kabadiwala / household / company; OTP simulated |
| 2 | KYC | 🟡 simulated | Aadhaar last 4, PAN, bank last 4 captured; verification not wired to UIDAI/NSDL |
| 3 | Doorstep pickups | ✅ | Book with date + slot, accept, reschedule, cancel, PIN-verified completion → lot |
| 4 | Location & distance | ✅ | Live GPS → saved address → default; all open requests nearest first, any city; accepted jobs ordered into a day's route |
| 5 | Camera & AI vision | ✅ | 1–4 photos, consensus, HF zero-shot → local CLIP → on-device fallback; hazards + safety |
| 6 | Valuation | ✅ | Fair price from live buyer prices × quality × volume, vs middleman price |
| 7 | Marketplace & smart matching | ✅ | Buyers ranked by net take-home after pickup, handling and fees |
| 8 | Reverse marketplace | ✅ | Buyers post demand; lots matched; demand shown in app |
| 9 | Recycler console | ✅ | QR scan (camera / photo), settle, offers, demands, prices, history, analytics, approval gate |
| 10 | Handover & traceability | ✅ | Server PINs, QR payload verify, audited weight, receipt, EPR certificate + hash, carbon offset |
| 11 | Payments | 🟡 simulated | UTR generated; no payment gateway |
| 12 | Earnings & insights | ✅ | Lifetime totals, tiers, underpriced sales, unsold stock, material/buyer breakdown |
| 13 | Price intelligence | ✅ / 🟡 | Metals from live exchange quotes (Yahoo Finance COMEX/NYMEX + USD/INR, refreshed every 6 h, cached for offline); household scrap from 15 Indian city rate cards; nearby-industry premium; 7-day forecast curve still simulated |
| 14 | Opportunity engine | ✅ | What to collect next from prices, demand and supply |
| 15 | Regional intelligence | ✅ | Hotspots, industry clusters (approximate public dataset), supply/demand, price heatmap |
| 16 | Aggregation | ✅ | Pool lots for bulk sale with negotiated rate |
| 17 | Fraud & anomaly | ✅ | 8 detectors, alerts in admin dashboard and app |
| 18 | Admin dashboard | ✅ | Overview, material flow, companies (approve), households, pickups, regional, risk |
| 19 | Assistant | ✅ | LLM agent with 6 tools when keys are set; deterministic offline answers otherwise |
| 20 | Voice | ✅ | TTS, speech recognition (native + web), voice commands, narration |
| 21 | Offline & sync | ✅ | On-device store, queue with idempotency, auto-sync, offline fallbacks, stays signed in |
| 22 | Languages & accessibility | ✅ | Hindi, Marathi, English; simple mode; voice navigation |
| 23 | Compliance reporting | 🟡 | CPCB Form-2 format real, figures simulated; national context configurable JSON |
| 24 | UI | ✅ | Dark cinematic design system plus a light theme (Settings → Appearance: Dark / Light / Match phone); fixed phone-width frame on large screens |

---

## 2. Real vs simulated

`GET /health` reports this per component.

| Simulated | Why | Where |
|---|---|---|
| OTP | No SMS gateway — code is always **1234** | `OnboardingScreen.tsx` |
| KYC verification | No UIDAI/NSDL contract | `collector_service.py`, `KycScreen.tsx` |
| Payment / UTR | No merchant account | `routers/payment.py`, `handover` |
| CPCB Form-2 numbers | No CPCB portal credentials | `routers/reports.py` |
| Price forecast | No historical daily scrap-price feed (starts from today's real market price) | `price_forecaster.py` |
| Official Indian price feed | MCX blocks automated access; official data needs a paid licensed vendor (e.g. TrueData). Exchange prices come from COMEX/NYMEX via Yahoo Finance (delayed, unofficial redistributor) | `market_price_service.py` |
| Household scrap rates | No official market exists; rates are The Kabadiwala's published city rate cards (retrieved 2026-09-27, undated, cleaned: 87 inconsistent values dropped) | `data/india_rate_cards.json` |
| Metal content / payable shares | Approximate industry ranges, tunable in JSON | `data/material_markets.json` |
| Regional clusters | Approximate public-profile dataset, flagged `approximate: true` | `data/regional_context_seed.json` |

Everything else — persistence, PINs, matching, pickups, demand, offers, settlement, EPR hashing, risk detectors,
sync, regional scoring, assistant tools — runs on real data in the database.

---

## 3. Testing (2026-09-27)

| Suite | Result | What it covers |
|---|---|---|
| Backend `test_backend.py` | **19/19 suites** (adds market pricing) | lots, spatial offers, ML, forecaster, handover + EPR, settlement credits, sync retry, assistant (offline + agent loop), roles & pickups, buyer console, scheduling, **every-area nearest-first pickups**, insights, regional, pooling, CPCB |
| `demo_check.py` (API walkthrough) | **35/35 steps** | all roles in sequence: households in 5 cities → nearest-first lists from Pune/Mumbai/Delhi/Bengaluru/Nagpur → accept → wrong/right PIN → company approval → prices + demand → match → offer → **QR verify** → pay → console, sync replay, pooling, CPCB, risk, admin tabs, new-collector KYC |
| UI checks (headless Chrome, phone-sized) | **17/17** | GPS sorting (Mumbai, Delhi, GPS off), QR on the handover pass **decoded by the recycler console from a photo**, offline Market + queued lot → auto-sync after reconnect (~22 s), server down at start (stays signed in, Retry recovers), slow network (800 ms / 32 KB/s), household screens; no JS errors |
| Layout | ✅ | laptop 1366, tablet 768, phones 412 / 360 / 320 — no horizontal scroll |
| Pricing `test_pricing.py` | **38 pass** (+1 opt-in live-feed test, passing) | recipes & rate-card data integrity, rate-card cleaning rules, unit conversions, Yahoo parsing, live → snapshot → reference fallback, offline back-off, metal maths, nearest-city cards + 150 km boundary, premium parts/caps/reasons add up, buyers-of-that-material, demand, cache, market-linked vs fixed buyer prices, legacy migration, `/prices/daily` consistency, valuation, offers maths, pickup quotes, forecast, assistant, health |
| Price UI (headless Chrome) | **18/18** | Bazar Bhav = server at Bhosari and Mumbai, Paper filter, source/premium/doorstep line, Market fair price ±1% and best offer, no false warning, offline restart keeps last prices labelled "last known", never-fetched shows labelled reference rates, household estimate = doorstep × kg |
| Mobile jest + TypeScript + ESLint | **18/18**, clean | lot calculator, photo consensus, price mapping, live/saved/reference fallback, fair-price formula |

Fixed during this round of testing:
- pickups hidden beyond 25 km
- GPS not used
- fake Bhosari location on GPS failure
- QR drawn white-on-white
- recycler console had no QR scanning
- portals only reachable from `localhost`
- React Query pausing requests offline (blank Market)
- collected-but-unsold kg missing from Home total and graph
- pricing: offline server retried the exchange on every request (now backs off 5 min); premium reasons didn't add up
  to the premium; console demands had no location so never counted; partly-filled demand ignored; buyers counted
  even if they don't buy that material; saved prices shown as "live" after an offline restart

---

## 4. Known limitations
- **Same network required** for phone ↔ PC in development; different networks need a tunnel (see architect.md §7).
- **Live camera QR scanning** in the recycler console needs https or `localhost`; on LAN http use *Scan from photo*.
- **No auth tokens**: a phone number identifies the account; no rate limiting. Fine for demos, not for production.
- **SQLite single node**; additive migrations only.
- **Expo SDK 53**: current Expo Go targets SDK 57, so phones need a matching Expo Go or a dev build (upgrade pending).
- Vision without an HF token uses local CLIP (≈600 MB first download) or the on-device fallback.

---

## 5. Next steps (priority order)
1. Official price feeds: MCX via a licensed vendor for metals (drop-in for the exchange adapter); monthly WPI
   (eaindustry.nic.in / data.gov.in) to move paper & plastic rate cards; a rate-card data partnership; and, as
   deals accumulate, the median price actually paid nearby as the local market value.
2. Upgrade Expo SDK 53 → 57 (Expo Go compatibility).
2. Token-based auth (OTP via SMS provider) and per-role authorization on every route.
3. Real payment rail (UPI collect / payouts) behind the existing settlement flow.
4. Replace simulated price series with a scraped/official daily feed; retrain the forecaster.
5. Postgres + Alembic migrations; deploy backend and portals with https (enables live camera scanning everywhere).
6. Done in the app: Home "do this next" and My jobs order accepted pickups into a route (nearest neighbour, fuel, time, Maps). Hold / sell / collect-more advice uses the week's price move. A licensed price history would make that advice sharper.
