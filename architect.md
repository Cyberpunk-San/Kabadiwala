# Architecture — Mai Hu Kabadiwala

This document describes the system **as built** (backend 3.0.0). The original 25-category product blueprint that
guided it is kept in [docs/archive/architect-v1-blueprint.md](docs/archive/architect-v1-blueprint.md).
For what is real vs simulated and how it was tested, see [STATUS.md](STATUS.md).

---

## 1. System overview

```text
 ┌──────────────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
 │ Mobile app (Expo / RN)       │   │ Recycler console     │   │ Authority dashboard  │
 │ kabadiwala · household ·     │   │ recycler-web/        │   │ admin-web/           │
 │ company   — hi / mr / en     │   │ QR scan, pay, demand │   │ approvals, risk, map │
 │ on-device SQLite + sync queue│   └──────────┬───────────┘   └──────────┬───────────┘
 └──────────────┬───────────────┘              │                          │
                │ HTTPS/JSON  /api/v1/*        │                          │
                ▼                              ▼                          ▼
 ┌─────────────────────────────────────────────────────────────────────────────────────┐
 │ Backend — FastAPI (apps/backend)                                                    │
 │ 20 routers → 20 services → SQLAlchemy → SQLite (data/mhk.db, 13 tables)             │
 │ AI: Hugging Face / Gemini (optional keys) → local CLIP → offline rules              │
 │ Seed data: recyclers_seed.json · regional_context_seed.json · national_context_seed │
 └─────────────────────────────────────────────────────────────────────────────────────┘
```

**Principles**
- **Backend is the source of truth** for money, PINs and status. Clients never decide whether a handover is valid.
- **Offline-first mobile.** Users work where signal is weak: every screen has an on-device fallback or a clear retry,
  and writes made offline are queued with idempotency keys.
- **Zero-cost stack.** SQLite, free-tier AI, no paid gateways. Anything that needs a paid/government integration is
  **simulated and labelled** (`GET /health` reports real vs simulated per component).
- **Data, not code.** Recyclers, regional industry clusters and national context live in JSON seed files.

---

## 2. Roles and journeys

| Role | Client | Core journey |
| Kabadiwala | Mobile app | Sign up → KYC → accept nearby pickups / scan own scrap → value → pick best buyer → QR handover → paid |
| Household | Mobile app | Sign up → book pickup (material, kg, date, slot) → share doorstep PIN → track |
| Company (seller) | Mobile app | Same as household, for bulk pickups |
| Company (buyer / recycler) | Recycler console | Approved by admin → set prices, post demand, send offers → scan QR → weigh → pay |
| Admin / authority | Admin dashboard | Approve companies, monitor pickups, material flow, regions, run risk scan |

One phone-number login (`POST /auth/login`) resolves the role; the app routes to the kabadiwala tabs or the
customer tabs accordingly.

### Lifecycles

```text
Pickup request   OPEN ──accept──▶ ACCEPTED ──complete(PIN, actual kg)──▶ COMPLETED ──▶ creates a Lot
                   └──────────────── cancel (requester) ────────────────▶ CANCELLED
                 (reschedule allowed while OPEN/ACCEPTED; date within 14 days; slot morning/afternoon/evening/anytime)

Lot              DRAFT/IDENTIFIED ─▶ AVAILABLE ─▶ MATCHED / PICKUP_SCHEDULED / SOLD ─▶ PAID
                                              └─▶ AGGREGATED (pooled with other lots)

Handover         verify(lot + PIN, or scanned QR {"lotId","pin"}) ─▶ confirm(audited kg, payout)
                 ─▶ Lot PAID · UTR · EPR certificate · collector totals + tier credited · double-pay refused (409)

Company          registered (approved=false: read-only) ──admin approve──▶ can post demand, set prices, offer, pay
```

---

## 3. Backend (`apps/backend`)

### 3.1 Layout
```text
main.py              FastAPI app, CORS, router registration, /health (real vs simulated)
settings.py          env config (MHK_DB_PATH, AI keys, CORS)
db.py                SQLAlchemy models, seeders, additive column migration (_add_missing_columns)
models/domain.py     Pydantic request/response schemas (materials, qualities, statuses as Literals)
routers/             HTTP layer — validation and status codes only
services/            business logic (one module per domain)
data/                SQLite DB + JSON seed datasets
test_backend.py      18 test suites on a fresh temp DB
demo_check.py        35-step role-by-role walkthrough against a running server
```

### 3.2 Data model (SQLite, 13 tables)
| Table | Holds |
|---|---|
| `collectors` | kabadiwala profile, KYC status, location, collection radius, lifetime lots/kg/earnings, tier |
| `households`, `companies` | customer accounts; companies have `company_type` (seller/buyer/both), CPCB licence, `approved` |
| `pickup_requests` | requester, address + lat/lon, material, est./actual kg, date + slot, status, collector, PIN, lot link |
| `lots` | material, quality, weight, photos, location, status, server-owned 4-digit PIN, expected earnings |
| `handovers` | settlement records: audited weight, payout, UTR, EPR certificate id + hash, carbon offset |
| `recyclers` | buyer directory: seeded from JSON, plus a row for each buyer company (active once approved); fixed prices, `price_spread_json` (materials that follow the market), location, rating, reliability |
| `recycler_offers` | offers a buyer makes on a specific lot (price, costs, expiry, status) |
| `demands`, `demand_matches` | reverse marketplace: buyer demand (material, qty, price, deadline, hub) and lots matched to it |
| `aggregator_pools` | lots pooled for bulk sale with negotiated rate |
| `risk_alerts` | output of the risk engine |
| `sync_outbox` | idempotency ledger for offline writes |

### 3.3 API surface (`/api/v1`, 73 routes — full schema at `/docs`)
| Domain | Routes |
|---|---|
| Accounts | `POST /auth/login` · `POST /households/register` · `GET /households/{id}` · `POST /companies/register` · `GET /companies/{id}` |
| Collectors | `POST /collectors/register` · `login` · `GET/PATCH /collectors/{id}` · `kyc/start` · `kyc/verify` · `stats` · `insights` |
| Pickups | `POST /pickups` · `GET /pickups?latitude&longitude[&radius_km]` (all open, nearest first) · `?requester_id` · `?collector_id` · `GET /{id}` · `accept` · `complete` · `schedule` · `cancel` |
| Lots | `POST/GET /lots` · `GET /lots/{id}` · `GET /lots/{id}/pin` · `PATCH status` · `PATCH offer` |
| Marketplace | `GET /marketplace/offers` (buyers ranked by net take-home) · `spatial/audit-query` |
| Handover & payment | `POST /handover/verify` (lot+PIN or QR payload) · `POST /handover/confirm` · `POST /payment/settle` |
| Reverse marketplace | `POST/GET /demands` · `GET /demands/{id}` · `matches` · `POST match/{lot_id}` |
| Recycler console | `POST /recycler/offers` · `GET /recycler/{id}/offers` · accept/reject · `incoming-lots` · `transactions` · `GET/PUT prices` · `analytics` |
| Intelligence | `GET /prices/daily` · `prices/forecast` · `POST /ml/valuation` · `GET /ml/demand-prediction` · `GET /opportunities/feed` · `GET /regional/overview` · `regional/price-heatmap` |
| AI | `POST /vision/analyze` · `GET /vision/status` · `POST /assistant/chat` · `GET /assistant/status` |
| Operations | `POST /aggregator/pool` · `GET /aggregator/pools` · `GET /reports/cpcb` · `reports/national-context` · `POST /sync/batch` |
| Risk & admin | `POST /risk/scan` · `GET /risk/alerts` · resolve · `GET /admin/{overview, collectors, recyclers, material-flow, anomalies, households, companies, pickups}` · `POST /admin/companies/{id}/approve` |

### 3.4 Key services
| Service | Responsibility |
|---|---|
| `pickup_service` | Create (estimated value = mandi rate × 0.70 doorstep factor), list **all open requests sorted by haversine distance** (optional radius), accept (KYC-verified collectors only, 409 if taken), complete (PIN check → creates lot), reschedule, cancel |
| `lot_service` | Lot CRUD, server-generated PINs, `credit_collector` on settlement (lots, kg, earnings, tier) |
| `recycler_service` | Buyer directory + offer scoring: listed price − pickup (distance) − handling − platform fee = **net take-home** |
| `demand_service` | Buyer demand posting (approved buyers only), matching lots by material/quality/quantity |
| `recycler_console_service` | Offers, incoming lots, transactions, price table (validated, used live by the marketplace), analytics |
| `epr_service` | EPR certificate id + SHA-256 hash, carbon offset estimate |
| `ml_classifier` | Photo → material: HF zero-shot API → local CLIP ViT-B/32 → off; hazard + safety table |
| `ml_service` | Valuation: average active-buyer price × quality multiplier × volume multiplier, with a confidence score; demand prediction (moving average) |
| `market_price_service` | Prices: live exchange quotes (6 h cache + `data/market_snapshot.json` for offline) × metal content × payable for metals/e-waste; nearest-city rate card ÷ 0.70 for household scrap; local premium (industry clusters, buyers of that material, open demand; cap 15%); effective buyer prices (market-linked spreads vs fixed console prices); `/prices/daily` and `/prices/market` |
| `price_forecaster` | 7-day ARIMA-shaped outlook starting from today's market price (curve simulated); reference rates used as fallback |
| `insights_service` | Per-collector: underpriced sales vs best available buyer, unsold stock value, material/buyer breakdown |
| `opportunity_service` | Ranks materials to collect next from price, open demand and supply |
| `regional_service` | Grid cells scoring supply (lots, pickups), demand, recyclers and industry clusters → hotspots with reasons, cluster opportunity scores, supply/demand balance, price heatmap; works for any lat/lon |
| `risk_service` | 8 detectors: duplicate lots, duplicate photos, weight mismatch, price outliers, suspicious patterns, unverified activity, abnormal recycler, transaction risk |
| `assistant_service` | LLM agent loop (HF or Gemini) with 6 tools — rates, best offers, open demands, my lots, fair price, safety — returns reply + app actions; deterministic offline fallback |
| `sync_service` | Batch apply of offline writes with idempotency keys → APPLIED / DUPLICATE / CONFLICT / REJECTED |
| `account_service`, `collector_service`, `admin_service` | Accounts, unified login, KYC (simulated), tiers, admin aggregates, company approval |

---

## 4. Mobile app (`apps/collector-mobile`)

Expo SDK 57 · React Native 0.86 · React 19.2 · React Navigation 7 · TanStack Query · Zustand · Reanimated 4 ·
react-native-svg · expo-location / camera / speech / speech-recognition · SQLite (web fallback).

### 4.1 Structure
```text
App.tsx                     providers, splash, AppFrame, role-based navigator (Onboarding → KYC → Tabs / CustomerTabs)
src/navigation/             stack + tab param types, navigationRef helpers (go, goTab, goBack)
src/screens/                22 screens (below)
src/ui/                     design system: theme primitives, Screen/TopBar, cards, controls, feedback, TabBar,
                            cinematic backdrop, AppFrame, Text (Inter + Mukta for Devanagari)
src/components/             domain components (PickupCard, LotCard, PriceCard, ValuationCard, InsightsCard, RiskBanner, voice)
src/services/api/client.ts  every backend call, typed; snake_case ↔ camelCase
src/services/sync/          persistent offline queue + flush loop
src/services/location/      GPS permission + fix (returns nothing rather than a fake location)
src/services/voice/         TTS, speech recognition (native + Web Speech API), command parser, narration
src/services/ai/            on-device classifier, offline offers, opportunity scorer
src/features/               lot calculator, multi-photo consensus, valuation engine, notifications
src/hooks/                  useTranslation, useCollectorLocation, useResponsive, useScreenNarration
src/store/                  authStore (session + cached profile), appStore (lots, language, connectivity, sync)
src/database/sqlite.ts      on-device lot store
src/i18n/                   Hindi, Marathi, English catalogues
```

### 4.2 Screens
| Kabadiwala tabs | Home · Market · **+** Collect · Earnings · Profile |
|---|---|
| Kabadiwala stack | Pickups · PickupDetail · Handover · BazarBhav · MaterialDetail · Demands · Opportunity · Regional · Search · Notifications · Assistant · Settings · Accessibility · KYC |
| Customer tabs | CustomerHome · Request (book pickup) · Profile; PickupDetail for tracking |
| Entry | Onboarding (language → role → phone + OTP → name/area) |

### 4.3 Location
`useCollectorLocation()` supplies one shared fix to Home, Pickups and notifications: **live GPS** (8 s timeout,
refreshed every 5 min) → **saved profile location** → **configured default city**, and reports which one it used
(shown above the pickup list). Pickups are requested without a radius so a kabadiwala anywhere sees every open
request, nearest first; "near you" notifications keep a 25 km radius.

Home leads with **do this next**: accepted jobs ordered into a day's route (nearest neighbour from the current
fix, with distance, time, fuel and a Maps link), an open pickup that sits beside that route, or one call on
unsold stock — sell if the week is down or the lot has sat 7 days, hold if the rise beats a small holding cost,
collect more if the pile is too small to justify the trip to the yard. My jobs uses the same order.

### 4.4 Offline and weak networks
- Queries run with `networkMode: "always"`: without signal they fail fast, so screens show cached data, an on-device
  fallback (e.g. Market's estimated offers, labelled offline) or a Retry — never an endless spinner.
- Session start offline uses the cached profile; the user stays signed in.
- Lots created offline get a local id and are queued (`@mhk_sync_queue`) with an idempotency key; a 30 s loop checks
  connectivity and flushes via `POST /sync/batch`. Replays are harmless (DUPLICATE).
- API base: `localhost` is replaced by the Metro host's LAN address on phones (10.0.2.2 on the Android emulator).

### 4.5 Design system
Themes: every colour is written in its dark value and passed through `P()` (`src/constants/palette.ts`), which returns
the light counterpart when light mode is on. The choice (`src/constants/themeMode.ts`) is read synchronously at startup
(web localStorage / expo-sqlite kv-store) because styles are created when modules load; changing it reloads the app.

Dark "cinematic" theme: near-black green backdrop with slowly drifting glass forms, translucent glass cards with a lit
top edge, icons on black discs, emerald/mint accents, low glow. Inter for Latin text and Mukta for Devanagari
(so Hindi/Marathi vowel signs render cleanly). On screens wider than 460 px the app renders in a fixed, centred
phone-width column (`AppFrame`); layout code measures that column via `useAppSize()`. Motion respects reduced-motion.

---

## 5. Web portals

Both are single static HTML files served from any machine. The API base defaults to port 8000 on the host that
served the page (`127.0.0.1` when local), overridable with `?api=`.

- **Recycler console** (`recycler-web/index.html`): company sign-in/registration, Verify (live camera QR scan on
  https/localhost; "Scan from photo" everywhere, decoded with the vendored `vendor/jsQR.js`; manual Lot ID + PIN),
  settle with audited weight → receipt, Incoming, Offers, Demands, Prices, History, Analytics. Writes are blocked
  until the company is approved.
- **Authority dashboard** (`admin-web/index.html`): Overview, Companies (approve), Households, Pickups, Regional map,
  Risk.

---

## 6. Security and trust
- PINs are generated and stored server-side; requesters see their pickup PIN, kabadiwalas never receive it in lists.
- Wrong PIN → 401; paying a lot twice → 409; accepting a taken pickup → 409; unverified KYC cannot accept jobs (403);
  unapproved companies cannot write (403).
- AI keys live only in `apps/backend/.env` (git-ignored). `EXPO_PUBLIC_*` values ship inside the app and hold no secrets.
- CORS defaults to `*` for local demos; set `MHK_ALLOWED_ORIGINS` for a deployment.
- Not production-hardened: no auth tokens (phone number identifies the account), no rate limiting, SQLite single-node.
  See STATUS.md → *Known limitations*.

---

## 7. Deployment notes
- Development: one PC runs the backend (`0.0.0.0:8000`), Expo (`--lan`) and the two static portals; devices join the
  same Wi-Fi/hotspot.
- For devices on different networks, expose the backend and Metro through a tunnel and start the app with
  `EXPO_PUBLIC_API_BASE_URL=<tunnel>/api`; open the portals with `?api=<tunnel>`.
- Moving to Postgres: models are plain SQLAlchemy; replace the SQLite URL and the additive migration helper with
  Alembic.
