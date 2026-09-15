# Mai Hu Kabadiwala (मैं हूँ कबाड़ीवाला)

AI-Powered E-Waste Collection, Marketplace, Intelligence & Traceability Platform transforming informal scrap pickers (kabadiwalas) into data-driven micro-entrepreneurs.

---

## Architecture Specification
The complete 25-category functional and system architecture blueprint is detailed in [architect.md](architect.md).

---

## Quick Start & How to Run

### 1. Prerequisites
- **Node.js**: v20+ (v23.5.0 recommended)
- **npm**: v10+ (v11.11.0 recommended)
- **Expo Go App**: Install on your Android/iOS phone from Google Play Store or Apple App Store (optional, for running on a physical device)
- **Android Studio / Emulator**: (optional, for Android native testing)

---

### 2. Environment Configuration (`.env`)

All static API URLs, AI endpoints, API keys, and feature flags have been made **100% dynamic** via environment variables.

Copy the environment template in the mobile app directory:
```bash
cd apps/collector-mobile
cp .env.example .env
```

Key dynamic settings in `apps/collector-mobile/.env`:
| Variable | Description | Default |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Backend REST API endpoint | `http://localhost:8000/api` |
| `EXPO_PUBLIC_AI_VISION_API_URL` | Dedicated Vision Inference endpoint | `http://localhost:8000/api/v1/vision/analyze` |
| `EXPO_PUBLIC_AI_VISION_API_KEY` | API Key for Vision Service | `mhk_vision_dev_key_sample_123` |
| `EXPO_PUBLIC_MAPS_API_KEY` | Google Maps / MapLibre API Key | `AIzaSyDevSample...` |
| `EXPO_PUBLIC_DEFAULT_LOCALE` | Default UI & voice language (`hi` / `mr` / `en`) | `hi` |
| `EXPO_PUBLIC_CURRENCY_SYMBOL` | Display currency | `₹` |
| `EXPO_PUBLIC_USE_MOCK_FALLBACKS` | Fallback to demo data when backend is offline | `true` |
| `EXPO_PUBLIC_ENABLE_OFFLINE_MODE` | Local SQLite caching & sync queue | `true` |
| `EXPO_PUBLIC_SYNC_INTERVAL_MS` | Sync worker polling frequency | `30000` |
| `EXPO_PUBLIC_PAYMENT_GATEWAY_KEY` | UPI / Razorpay test key | `rzp_test_...` |

---

### 3. Install Dependencies

```bash
cd apps/collector-mobile
npm install
```

---

### 4. Run the Mobile App

Run the development server:
```bash
npm start
```
or
```bash
npx expo start
```

Once the terminal displays the QR code:
- **On a Physical Android Phone**:
  1. Open the **Expo Go** app.
  2. Tap **Scan QR code** and scan the barcode in your terminal.
  3. The app will bundle and run natively on your device.
- **On Android Emulator**:
  - Press `a` in the terminal (or run `npm run android`).
- **In Web Browser (Preview Mode)**:
  - Press `w` in the terminal (or run `npm run web`).

---

### 5. Run Verification Tests & Type Checking

To verify the test suite:
```bash
npm test
```

To run TypeScript type check:
```bash
npm run typecheck
```

---

## Core Features & Workflow

```text
  Capture E-Waste Photo
          │
          ▼
   AI Vision Detection  ── (YOLOv8 + OCR + Hazard Classifier)
          │
          ▼
   Confirm/Correct Weight & Material
          │
          ▼
   Smart Matching Engine  ── (Finds optimal buyer maximizing NET take-home)
          │
          ▼
   Digital Handover & Instant UPI Settlement
```

---

## Repository Structure

```text
mai-hu-kabadiwala/
├── .env.example             # Global full-stack environment template
├── .env                     # Global development environment variables
├── architect.md             # Complete 44-section system & functional architecture
├── README.md                # Run instructions and project overview
└── apps/
    └── collector-mobile/    # React Native (Expo) Collector Mobile App
        ├── .env.example     # Client environment template
        ├── .env             # Active client environment variables
        ├── src/
        │   ├── components/  # Accessible visual UI components (LotCard, PriceCard)
        │   ├── constants/   # Theme & Dynamic config (config.ts)
        │   ├── database/    # Local SQLite offline database (sqlite.ts)
        │   ├── features/    # Business logic (lotCalculator.ts)
        │   ├── hooks/       # Translation & UI hooks
        │   ├── i18n/        # Hindi, Marathi, and English catalogues
        │   ├── navigation/  # Bottom tab navigation definitions
        │   ├── screens/     # Home, Collect, Market, Earnings, Profile
        │   ├── services/    # Dynamic API client, GPS, Sync, TTS Voice
        │   ├── store/       # Zustand state management
        │   └── types/       # Domain interfaces & models
```
