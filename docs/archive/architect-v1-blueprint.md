# Kabadiwala → Entrepreneur

## AI-Powered E-Waste Collection, Marketplace, Intelligence & Traceability Platform

**Document:** `architect.md`  
**Version:** 1.0  
**Status:** Architecture Blueprint  
**Primary Goal:** Transform informal e-waste collectors (kabadiwalas) into data-driven micro-entrepreneurs by connecting collection, AI identification, market intelligence, recycler demand, logistics, traceability, payments, and business analytics in one mobile-first platform.

---

# 1. Executive Summary

The platform is a mobile-first e-waste operating system for collectors, recyclers, aggregators, and authorities.

Instead of treating a kabadiwala as only a person who collects scrap, the system treats the collector as a **micro-entrepreneur** with:

- a digital identity,
- an operating territory,
- an inventory of e-waste,
- market-price awareness,
- access to recycler demand,
- AI-assisted material identification,
- profitability intelligence,
- logistics support,
- traceable transactions,
- digital payments,
- and business-growth analytics.

The central product loop is:

> **Regional Intelligence → Opportunity Prediction → Collection → Camera Identification → Valuation → Price Intelligence → Recycler Demand → Smart Matching → Aggregation → Sale → Traceable Handover → Payment → Earnings Analytics → Better Future Collection Decisions**

The architecture is designed around four principles:

1. **Mobile-first:** the collector primarily uses a smartphone.
2. **Low-literacy-first:** visual, icon-based and voice-driven workflows.
3. **Offline-first:** core collection operations work without continuous internet.
4. **Entrepreneur-first:** recommendations optimise for expected **net earnings**, not simply the highest listed price.

---

# 2. Product Vision

## 2.1 Problem

Informal e-waste collection is fragmented. Collectors often lack:

- reliable material identification,
- transparent pricing,
- knowledge of recycler demand,
- information about high-value materials,
- regional opportunity intelligence,
- transaction traceability,
- formal-recycling connections,
- reliable payment tracking,
- and business-level analytics.

The result is information asymmetry.

A collector may collect a valuable material but sell it to the wrong buyer, at the wrong time, at an inaccurate price, with unnecessary transportation cost.

## 2.2 Proposed Solution

The platform creates an intelligent bridge:

```text
COLLECTOR
   │
   ├── Camera
   ├── Voice
   ├── Weight
   ├── Location
   └── Lot creation
          │
          ▼
    AI IDENTIFICATION
          │
          ▼
   MATERIAL VALUATION
          │
          ▼
   MARKET INTELLIGENCE
          │
          ├── Prices
          ├── Demand
          ├── Quality
          └── Region
          │
          ▼
   OPPORTUNITY ENGINE
          │
          ▼
    RECYCLER MARKETPLACE
          │
          ▼
     SMART MATCHING
          │
          ▼
       LOGISTICS
          │
          ▼
    TRACEABLE HANDOVER
          │
          ▼
        PAYMENT
          │
          ▼
   ENTREPRENEUR ANALYTICS
          │
          └──────► Better future decisions
```

---

# 3. Target Users

## 3.1 Collector

The primary user.

Capabilities:

- collect material,
- identify material,
- create lots,
- see estimated value,
- discover demand,
- compare recycler offers,
- choose profitable sales,
- track payments,
- analyse earnings.

## 3.2 Recycler

Capabilities:

- register and verify,
- publish material requirements,
- publish price/offers,
- request quantities,
- manage pickups,
- verify received weight,
- confirm handover,
- manage payments,
- analyse procurement.

## 3.3 Aggregator

Optional intermediary role.

Capabilities:

- combine collector lots,
- manage bulk quantities,
- fulfil recycler demand,
- distribute proceeds,
- coordinate logistics.

## 3.4 Admin / Authority

Capabilities:

- verify ecosystem participants,
- monitor material flows,
- analyse regions,
- monitor anomalies,
- generate reports,
- monitor formal-recycling participation.

---

# 4. Functional Architecture

The system is divided into the following domains.

```text
01 Collector & Profile
02 Mobile & Accessibility
03 Camera & AI Vision
04 Voice
05 Material & Lot Management
06 Regional Intelligence
07 Market & Price Intelligence
08 Entrepreneur / Opportunity Engine
09 Recycler Marketplace
10 Reverse Marketplace
11 Aggregation & Bulk Selling
12 Smart Matching
13 Logistics
14 Traceability & Handover
15 Payments
16 Safety
17 Entrepreneur Dashboard
18 Business Intelligence
19 Fraud & Anomaly Detection
20 AI/ML
21 Offline & Data Synchronisation
22 Recycler Interface
23 Admin / Authority Dashboard
24 Data Platform
25 Core Entrepreneurial Loop
```

---

# 5. Category-Wise Functional Specification

This section defines the rigorous technical specifications, data models, typed function signatures, and algorithmic workflows for all 25 core feature categories.

---

## 5.1 👤 Collector & Profile

### Core Features:
- Collector registration/login
- Collector profile
- Operating area
- Collection radius
- Material expertise
- Collection history
- Earnings history
- Collector reputation/verification

### Architecture & Service Blueprint:
The Collector Profile Service (`backend/collectors`) manages the digital persona of informal waste pickers and scrap dealers, elevating them to micro-entrepreneurs. It interfaces with PostgreSQL + PostGIS for spatial geometries (operating polygons and collection radius) and Kafka for emitting onboarding and state-change events.

### Typed Function Specifications:

```python
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from uuid import UUID
from pydantic import BaseModel, Field

# --- Data Transfer Objects ---
class CollectorRegistrationDTO(BaseModel):
    phone_number: str = Field(..., regex=r"^\+91[6-9]\d{9}$")
    full_name: str
    primary_language: str = Field(default="hi", regex="^(hi|mr|en)$")
    initial_city: str
    referral_code: Optional[str] = None

class CollectorProfileDTO(BaseModel):
    collector_id: UUID
    user_id: UUID
    full_name: str
    phone_number: str
    kyc_verified: bool
    reputation_score: float = Field(ge=0.0, le=100.0)
    operating_polygon_geojson: Optional[Dict[str, Any]]
    collection_radius_km: float
    material_expertise: List[str]
    total_lots_collected: int
    total_weight_kg: float
    total_lifetime_earnings: float
    created_at: datetime

class ReputationScorecard(BaseModel):
    collector_id: UUID
    overall_score: float
    punctuality_rate: float
    grading_accuracy_rate: float
    transaction_completion_rate: float
    safety_compliance_score: float
    verified_reviews_count: int

# --- Service Functions ---

def register_collector(
    registration_data: CollectorRegistrationDTO,
    device_metadata: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Registers a new informal collector, initiates OTP challenge, and provisions 
    the collector profile record with default collection boundaries.
    
    Steps:
    1. Validate phone number format (+91 E.164).
    2. Check for duplicate active user accounts.
    3. Generate 6-digit cryptographically secure TOTP; publish SMS dispatch event.
    4. Persist unverified User and Collector records with status 'PENDING_OTP'.
    5. Return registration tracking token and expiration timestamp.
    """
    pass

def verify_collector_otp(
    phone_number: str,
    otp_code: str,
    device_fingerprint: str
) -> Dict[str, Any]:
    """
    Validates OTP, completes collector authentication, issues JWT bearer tokens,
    and returns initial bootstrap config including UI language preferences.
    """
    pass

def get_collector_profile(collector_id: UUID) -> CollectorProfileDTO:
    """
    Retrieves the complete collector profile, aggregation metrics, operating boundaries,
    and current reputation tier.
    """
    pass

def update_collector_profile(
    collector_id: UUID,
    updates: Dict[str, Any]
) -> CollectorProfileDTO:
    """
    Updates collector profile details (name, bank UPI ID, preferred language).
    Emits UserProfileUpdatedEvent to Kafka.
    """
    pass

def set_operating_boundary(
    collector_id: UUID,
    polygon_geojson: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Sets the geographic polygon defining the collector's daily territory.
    Converts GeoJSON to PostGIS ST_Polygon, calculates surface area in sq km,
    and validates intersection with supported municipal ward zones.
    """
    pass

def update_collection_radius(
    collector_id: UUID,
    center_lat: float,
    center_lng: float,
    radius_km: float
) -> Dict[str, Any]:
    """
    Updates radial collection boundaries from a central hub/home location.
    Updates spatial buffer: ST_Buffer(ST_SetSRID(ST_Point(lng, lat), 4326)::geography, radius_km * 1000).
    """
    pass

def update_material_expertise(
    collector_id: UUID,
    expertise_tags: List[str]
) -> List[str]:
    """
    Updates self-reported and AI-validated material specialties (e.g. ['pcb_motherboard', 'smps', 'copper_transformers']).
    Triggers recalculation of opportunity recommendation weights.
    """
    pass

def get_collection_history(
    collector_id: UUID,
    page: int = 1,
    limit: int = 20,
    status_filter: Optional[str] = None
) -> Dict[str, Any]:
    """
    Fetches paginated historical collection lots with material categories, verified weights,
    selling prices, and traceable timestamps.
    """
    pass

def get_earnings_history(
    collector_id: UUID,
    start_date: date,
    end_date: date,
    group_by: str = "day"  # 'day', 'week', 'month'
) -> Dict[str, Any]:
    """
    Aggregates gross revenue, transport expenses, and net profit payouts across
    specified timeframes for the collector's ledger.
    """
    pass

def calculate_reputation_score(collector_id: UUID) -> ReputationScorecard:
    """
    Computes real-time multi-factor Bayesian reputation score based on:
    - Weight accuracy (camera estimate vs recycler certified scale): 35% weight
    - Handover fulfillment rate (accepted offers without cancellation): 25% weight
    - Material purity & absence of hazardous contamination: 20% weight
    - KYC & platform tenure: 20% weight
    """
    pass

def verify_collector_kyc(
    collector_id: UUID,
    id_type: str,  # 'aadhaar', 'voter_id', 'pan'
    id_document_urls: List[str]
) -> Dict[str, Any]:
    """
    Submits identity documents for automated OCR masking and verification
    against government registries or admin review workflow.
    """
    pass
```

### Associated API Routes

- `POST /api/v1/auth/register` - Register collector
- `POST /api/v1/auth/verify-otp` - Verify OTP and login
- `GET /api/v1/collector/profile` - Fetch current collector profile
- `PUT /api/v1/collector/profile` - Update profile attributes
- `POST /api/v1/collector/territory/boundary` - Set GeoJSON polygon
- `POST /api/v1/collector/territory/radius` - Set radial boundary
- `PUT /api/v1/collector/expertise` - Update material expertise
- `GET /api/v1/collector/history/lots` - Query collection history
- `GET /api/v1/collector/history/earnings` - Query earnings breakdown
- `GET /api/v1/collector/reputation` - Fetch reputation scorecard
- `POST /api/v1/collector/kyc` - Submit KYC verification

### Database Entities

`users`, `collectors`, `collector_territories`, `collector_expertise`, `collector_kyc_records`, `collector_reputation_history`.

---
## 5.2 📱 Mobile & Accessibility

### Core Features

- Android mobile app
- Hindi / Marathi / English
- Icon-based low-literacy UI
- Large buttons and visual workflows
- Voice-guided navigation
- Text-to-speech
- Voice commands
- Offline-first operation
- Lightweight/basic-phone compatibility

### Architecture & Service Blueprint

The mobile tier is built as an Android-first React Native + TypeScript application with a native Kotlin bridge for audio DSP and on-device SQLite (WatermelonDB). Designed for low-literacy scrap collectors, UI elements feature high-contrast pictorial icons (min 64x64 dp tap targets), zero-text wizard workflows, on-demand Hindi/Marathi Text-to-Speech (TTS), and SMS/USSD fallbacks for 2G feature phones.

### Typed Function Specifications

```typescript
// --- Mobile Client & Edge Interfaces ---

export interface DeviceCapability {
  hasNfc: boolean;
  hasCamera: boolean;
  ramMb: number;
  osVersion: string;
  networkType: 'WIFI' | '4G' | '3G' | '2G' | 'OFFLINE';
  supportsOnDeviceTts: boolean;
}

export interface LocalizedVoicePrompt {
  promptId: string;
  locale: 'hi-IN' | 'mr-IN' | 'en-IN';
  textFallback: string;
  audioAssetUri: string;
  hapticFeedbackPattern: number[];
}

// --- Mobile Functions & Services ---

/**
 * Initializes mobile application environment, validates local SQLite schema,
 * checks available device memory, and configures background sync workers.
 */
export function initMobileEnvironment(): Promise<DeviceCapability>;

/**
 * Dynamically switches application localization bundle between Hindi, Marathi, and English.
 * Re-indexes visual icon alt-keys and loads local audio caches for offline TTS.
 */
export function setAppLocale(localeCode: 'hi-IN' | 'mr-IN' | 'en-IN'): Promise<boolean>;

/**
 * Returns icon-driven visual navigation state tree tailored for zero-text/low-literacy users.
 * Maps application actions to recognized physical visual metaphors (camera, scales, currency, truck).
 */
export function getVisualNavigationState(userState: string): {
  currentStageIcon: string;
  primaryActionIcon: string;
  voicePromptAsset: string;
  allowedGestures: string[];
};

/**
 * Renders large high-contrast visual buttons and step-by-step pictorial guides.
 * Enforces accessibility standards: minimum contrast ratio 7:1, minimum touch target 72x72 dp.
 */
export function configureTouchTargetLayout(stepId: string): {
  targetWidth: number;
  targetHeight: number;
  colorScheme: 'high-contrast-emerald' | 'amber-warning' | 'crimson-alert';
  hapticOnPress: boolean;
};

/**
 * Triggers voice-guided audio prompts for the active screen.
 * Resolves local synthesized WAV/MP3 asset and plays through Android AudioManager with screen-ducking.
 */
export function promptVoiceGuidance(stepId: string, locale: string): Promise<void>;

/**
 * Synthesizes dynamic text (such as variable price or weight amounts) into spoken Hindi/Marathi
 * utilizing on-device Android TTS or pre-cached phoneme samples when offline.
 */
export function speakText(text: string, locale: string, speedMultiplier?: number): Promise<void>;

/**
 * Captures microphone stream, performs client-side voice activity detection (VAD),
 * and routes speech token to the Voice Command Engine.
 */
export function processVoiceCommandIntent(audioBlobUri: string): Promise<{
  action: 'CREATE_LOT' | 'QUERY_PRICE' | 'FIND_RECYCLER' | 'CONFIRM_SALE' | 'HELP';
  payload: Record<string, any>;
  confidence: number;
}>;

/**
 * Monitors device connectivity events and toggles synchronization engines.
 * Manages atomic transition between local SQLite storage and upstream FastAPI endpoints.
 */
export function handleNetworkTransition(isOnline: boolean): void;

/**
 * Backend fallback service: Generates interactive USSD string / SMS interactive prompts
 * for basic-phone (2G) users to record lots or check prices without an Android device.
 */
export function generateUssdFallbackMenu(sessionId: string, inputCode: string): {
  responseString: string;
  actionType: 'CONTINUE' | 'END';
};
```

### Associated API & Edge Routes

- `GET /api/v1/mobile/locale-bundle/{locale}` - Fetch updated translation and audio phoneme mappings
- `POST /api/v1/mobile/telemetry` - Batch upload low-bandwidth crash and battery telemetry
- `POST /api/v1/ussd/callback` - Telecom gateway callback for feature phone USSD commands
- `POST /api/v1/sms/inbound` - Inbound SMS parser for lightweight basic-phone interactions

### Local Database Tables (Client-Side SQLite)

`cached_locales`, `offline_lots`, `sync_mutation_queue`, `audio_guidance_cache`, `device_settings`.

---
## 5.3 📷 Camera & AI Vision

### Core Features

- E-waste image capture
- Material identification
- Multi-item detection
- Mixed e-waste detection
- Category classification
- Condition/quality estimation
- Hazard detection
- OCR/model-number recognition
- Manual correction of AI classification
- Multiple photos per lot

### Architecture & Service Blueprint

The Camera & Computer Vision Pipeline (`backend/ai/vision`) performs real-time edge and cloud inference on scrap lot photographs. It incorporates a YOLOv8-based object detection model fine-tuned on 150,000+ Indian e-waste samples, a MobileNetV4 classifier for fine-grained PCB grading, PaddleOCR for equipment serial number recognition, and a multi-label hazard classifier (detecting puffed lithium batteries, cracked CRT glass, and leaking capacitors).

### Typed Function Specifications

```python
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from pydantic import BaseModel, Field

# --- Computer Vision DTOs ---
class BoundingBox(BaseModel):
    x_min: float
    y_min: float
    x_max: float
    y_max: float
    confidence: float
    label: str

class VisualItemDetection(BaseModel):
    item_id: str
    category_id: UUID
    category_name: str
    grade_prediction: str  # 'Grade-A', 'Grade-B', 'Grade-C', 'Scrap-Shell'
    confidence: float
    box: BoundingBox
    estimated_weight_range_kg: Tuple[float, float]
    hazards_detected: List[str]

class LotVisionAnalysisResult(BaseModel):
    lot_id: Optional[UUID]
    is_mixed_lot: bool
    detected_items: List[VisualItemDetection]
    composite_grade: str
    ocr_model_numbers: List[str]
    ocr_serial_numbers: List[str]
    critical_hazards: List[str]
    processing_time_ms: int

# --- Vision Service Functions ---

def capture_lot_image(
    raw_image_bytes: bytes,
    collector_id: UUID,
    gps_lat: float,
    gps_lng: float,
    device_orientation: Dict[str, float]
) -> Dict[str, Any]:
    """
    Validates, compresses (WebP @ 85% quality), extracts EXIF GPS metadata,
    and stores original lot photograph in S3/MinIO bucket.
    """
    pass

def identify_material(image_bytes: bytes) -> LotVisionAnalysisResult:
    """
    Primary vision entry point. Runs image through object detection, category classification,
    and condition scoring pipelines. Returns structured material inventory.
    """
    pass

def detect_multiple_items(image_bytes: bytes) -> List[BoundingBox]:
    """
    Executes YOLOv8 object detection model to identify individual e-waste items
    present in a heap or container (e.g. 3 mobile motherboards, 1 SMPS, 2 hard drives).
    """
    pass

def analyze_mixed_ewaste_composition(image_bytes: bytes) -> Dict[str, float]:
    """
    Performs semantic segmentation to estimate proportional volume/weight mix of
    heterogeneous e-waste (e.g. 45% ferrous casing, 30% printed circuit boards, 15% plastic, 10% cabling).
    """
    pass

def classify_ewaste_category(item_crop_bytes: bytes) -> Dict[str, Any]:
    """
    Classifies a single cropped item into the 28 Indian CPCB Schedule-I e-waste categories
    with hierarchical classification (ITEW1-28 and CEEW1-12).
    """
    pass

def estimate_quality_condition(
    image_bytes: bytes,
    category_id: UUID
) -> Dict[str, Any]:
    """
    Analyzes physical integrity: component completeness (missing copper chokes, stripped ICs),
    water damage/oxidation, corrosion, and structural breakage.
    Output: condition grade multiplier (0.50x to 1.15x of base price).
    """
    pass

def detect_visual_hazards(image_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Scans image for critical safety hazards:
    1. Swollen/punctured Li-ion pouch batteries (fire/explosion hazard)
    2. Broken CRT funnel glass (lead toxicity & vacuum implosion risk)
    3. Leaking PCB/oil capacitors (toxic dielectric fluid)
    4. Charred/burned components (unregulated toxic burning).
    """
    pass

def extract_model_and_serial_ocr(image_bytes: bytes) -> Dict[str, List[str]]:
    """
    Applies PaddleOCR + heuristic regex matching to extract OEM brand names,
    model numbers, energy star ratings, and serial barcode from equipment nameplates.
    """
    pass

def submit_classification_correction(
    lot_id: UUID,
    image_id: UUID,
    ai_predicted_category_id: UUID,
    collector_selected_category_id: UUID,
    collector_notes: Optional[str]
) -> Dict[str, Any]:
    """
    Records human-in-the-loop correction from the collector.
    Stores triplet (image, prediction, ground_truth) in active learning retraining pool.
    """
    pass

def attach_multiple_photos_to_lot(
    lot_id: UUID,
    image_file_list: List[bytes]
) -> List[UUID]:
    """
    Associates multiple perspective angles (top view, PCB close-up, nameplate, scale reading)
    with a single digital lot manifest.
    """
    pass
```

### Associated API Routes

- `POST /api/v1/vision/analyze` - Perform full vision identification on uploaded image
- `POST /api/v1/vision/detect-hazards` - Fast-track hazard scan endpoint (< 200ms)
- `POST /api/v1/vision/ocr` - Extract model/serial numbers from device label photo
- `POST /api/v1/lots/{lot_id}/images` - Upload and attach multiple images to lot
- `POST /api/v1/vision/corrections` - Submit collector correction for AI prediction

### Database Entities

`lot_images`, `vision_detections`, `vision_hazard_alerts`, `ai_classification_corrections`, `model_inference_logs`.

---
## 5.4 🎤 Voice

### Core Features

- Voice-based material entry
- Voice-based weight entry
- Voice search
- Voice price queries
- Voice recycler search
- Voice transaction confirmation
- Spoken price information
- Spoken recommendations
- Spoken safety warnings

### Architecture & Service Blueprint

The Voice Engine (`backend/voice`) empowers low-literacy collectors to interact conversationally in Hindi, Marathi, or English. Built on OpenAI Whisper / IndicConformer for Automated Speech Recognition (ASR), spaCy + custom Indian scrap terminology NER (Named Entity Recognition) models (recognizing colloquial terms like "patti", "motherboard", "taamba", "kanta"), and edge-optimized TTS.

### Typed Function Specifications

```python
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel

# --- Voice DTOs ---
class VoiceEntityExtraction(BaseModel):
    intent: str
    material_name: Optional[str]
    material_id: Optional[UUID]
    weight_value: Optional[float]
    weight_unit: Optional[str]  # 'kg', 'quintal', 'piece'
    confidence: float
    raw_transcript: str

class SpokenBulletinResponse(BaseModel):
    audio_stream_url: str
    duration_seconds: float
    transcript_text: str
    locale: str

# --- Voice Functions ---

def parse_voice_material_input(
    audio_bytes: bytes,
    locale: str
) -> VoiceEntityExtraction:
    """
    Transcribes spoken material descriptions in Hindi/Marathi (e.g., 'Do kilo computer ke motherboard')
    and extracts structured entities: category_id='PCB_MOTHERBOARD', quantity=2.0, unit='KG'.
    """
    pass

def parse_voice_weight_input(
    audio_bytes: bytes,
    locale: str
) -> Dict[str, Any]:
    """
    Extracts numeric weight readings spoken by the collector or assistant
    (e.g., 'Saadhe char kilo' -> 4.5 kg, 'Bees piece' -> 20 units).
    """
    pass

def execute_voice_search(
    audio_bytes: bytes,
    collector_id: UUID,
    search_context: str
) -> Dict[str, Any]:
    """
    Converts spoken search query to vector embedding and queries PostgreSQL pgvector
    for materials, buyers, or past transactions.
    """
    pass

def query_price_by_voice(
    audio_bytes: bytes,
    collector_lat: float,
    collector_lng: float
) -> SpokenBulletinResponse:
    """
    Identifies material from spoken query, queries market pricing engine,
    and returns a synthesized audio response in the collector's language:
    (e.g., 'Aaj Pune me Motherboard Grade A ka rate 340 rupaye prati kilo hai').
    """
    pass

def search_recyclers_by_voice(
    audio_bytes: bytes,
    collector_lat: float,
    collector_lng: float
) -> Dict[str, Any]:
    """
    Interprets queries like 'Mere paas ka authorised e-waste recycler kaunsa hai?'
    and returns the nearest authorized recycler details with spoken audio overview.
    """
    pass

def confirm_transaction_by_voice(
    audio_bytes: bytes,
    transaction_id: UUID,
    collector_id: UUID
) -> Dict[str, Any]:
    """
    Records collector's verbal agreement ('Haan, mujhe 500 rupaye me bechna manzoor hai'),
    runs biometric voiceprint verification if configured, and stores audio snippet
    as an immutable tamper-evident proof of verbal contract.
    """
    pass

def synthesize_spoken_price_bulletin(
    material_id: UUID,
    unit_price: float,
    trend_direction: str,
    locale: str
) -> SpokenBulletinResponse:
    """
    Generates natural-sounding spoken market price audio in the requested dialect.
    """
    pass

def synthesize_spoken_opportunity_advice(
    opportunity_id: UUID,
    collector_id: UUID,
    locale: str
) -> SpokenBulletinResponse:
    """
    Generates actionable spoken prompt: 'MIDC Bhosari me telecom scrap ka accha daam mil raha hai.
    Kya aap collection shuru karna chahte hain?'
    """
    pass

def synthesize_spoken_safety_warning(
    hazard_code: str,
    locale: str
) -> SpokenBulletinResponse:
    """
    Generates immediate high-priority spoken audio safety warning:
    'Chetavani! Is battery me aag lagne ka khatra hai. Isko alag rakhein aur mat todhein.'
    """
    pass
```

### Associated API Routes

- `POST /api/v1/voice/transcribe-material` - Transcribe audio to material entity
- `POST /api/v1/voice/transcribe-weight` - Transcribe audio to weight entity
- `POST /api/v1/voice/query-price` - Voice price inquiry endpoint
- `POST /api/v1/voice/confirm-transaction` - Voice consent registration
- `GET /api/v1/voice/bulletin/{material_id}` - Stream spoken price audio

### Database Entities

`voice_interaction_logs`, `voice_transaction_consents`, `audio_prompt_assets`.

---
## 5.5 ♻️ Material & Lot Management

### Core Features

- E-waste categorisation
- Material separation guidance
- Digital lot creation
- Unique Lot ID
- Lot photographs
- Approximate weight
- Location
- Timestamp
- Lot status tracking
- Lot history

### Architecture & Service Blueprint

The Material & Lot Management Service (`backend/lots`) is the system of record for physical scrap inventory. Every lot created receives a cryptographically verifiable Unique Lot ID (ULID + QR code), associates vision metadata and GPS coordinates, tracks the full state lifecycle (CREATED -> AI_IDENTIFIED -> OFFERED -> MATCHED -> IN_TRANSIT -> WEIGHED -> SETTLED), and provides step-by-step disassembly/separation guidance.

### Typed Function Specifications

```python
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID
from enum import Enum
from pydantic import BaseModel, Field

class LotStatusEnum(str, Enum):
    DRAFT = "DRAFT"
    CREATED = "CREATED"
    AI_IDENTIFIED = "AI_IDENTIFIED"
    OFFER_PENDING = "OFFER_PENDING"
    MATCHED = "MATCHED"
    LOGISTICS_DISPATCHED = "LOGISTICS_DISPATCHED"
    RECEIVED_AT_RECYCLER = "RECEIVED_AT_RECYCLER"
    WEIGHED_AND_VERIFIED = "WEIGHED_AND_VERIFIED"
    SETTLED = "SETTLED"
    DISPUTED = "DISPUTED"
    CANCELLED = "CANCELLED"

class CreateLotDTO(BaseModel):
    collector_id: UUID
    material_category_id: UUID
    estimated_weight_kg: float = Field(..., gt=0.0)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    gps_accuracy_meters: float
    notes: Optional[str] = None
    offline_created_at: Optional[datetime] = None

class DigitalLotResponse(BaseModel):
    lot_id: UUID
    unique_lot_code: str
    collector_id: UUID
    material_category_id: UUID
    material_name: str
    status: LotStatusEnum
    estimated_weight_kg: float
    verified_weight_kg: Optional[float]
    location_geojson: Dict[str, Any]
    image_urls: List[str]
    created_at: datetime
    updated_at: datetime

# --- Service Functions ---

def get_material_taxonomy() -> List[Dict[str, Any]]:
    """
    Returns hierarchical taxonomy of recognized e-waste classes according to CPCB guidelines:
    Large Household Appliances, IT & Telecom, Consumer Electronics, Batteries, Solar PV Panels, etc.
    """
    pass

def get_separation_guidance(
    category_id: UUID,
    detected_components: List[str]
) -> Dict[str, Any]:
    """
    Provides illustrated, step-by-step manual separation instructions:
    e.g. Dismantling a PC tower into: copper heat sinks, RAM sticks, power supply transformer,
    and steel casing to maximize cumulative salvage value.
    """
    pass

def create_digital_lot(
    lot_data: CreateLotDTO,
    image_ids: List[UUID]
) -> DigitalLotResponse:
    """
    Creates persistent digital lot record, generates unique verifiable lot code,
    attaches photographs, locks geo-coordinates, and publishes LotCreatedEvent.
    """
    pass

def generate_unique_lot_id(
    location_code: str,
    timestamp: datetime,
    category_code: str
) -> str:
    """
    Generates deterministic, URL-safe, human-readable Unique Lot ID
    Format: KBD-PNQ-202609-PCB-98X2A (incorporating city, year-month, category, and CRC16 checksum).
    """
    pass

def link_photographs_to_lot(
    lot_id: UUID,
    image_ids: List[UUID]
) -> bool:
    """
    Associates uploaded image entities with the lot and recalculates image hash signatures.
    """
    pass

def record_approximate_weight(
    lot_id: UUID,
    weight_kg: float,
    source: str = "COLLECTOR_MANUAL"  # 'COLLECTOR_MANUAL', 'VOICE_ENTRY', 'BLUETOOTH_SCALE'
) -> DigitalLotResponse:
    """
    Updates initial estimated weight on the lot with provenance metadata.
    """
    pass

def record_lot_geo_coordinates(
    lot_id: UUID,
    lat: float,
    lng: float,
    accuracy: float
) -> Dict[str, Any]:
    """
    Binds verifiable spatial coordinates to the lot using PostGIS ST_SetSRID(ST_MakePoint(lng, lat), 4326).
    """
    pass

def attach_cryptographic_timestamp(
    lot_id: UUID,
    event_type: str
) -> str:
    """
    Generates SHA-256 hash linking previous lot state hash, event timestamp,
    and current state to provide tamper-evident lot ledger integrity.
    """
    pass

def update_lot_status(
    lot_id: UUID,
    new_status: LotStatusEnum,
    actor_id: UUID,
    notes: Optional[str] = None
) -> DigitalLotResponse:
    """
    Enforces valid state transition diagram for lots. Disallows illegal jumps
    (e.g., from DRAFT straight to SETTLED without WEIGHED_AND_VERIFIED).
    """
    pass

def get_lot_audit_trail(lot_id: UUID) -> List[Dict[str, Any]]:
    """
    Returns chronological immutable lifecycle event history for a lot,
    including who altered each field, timestamp, and location verification.
    """
    pass
```

### Associated API Routes

- `GET /api/v1/materials/taxonomy` - Retrieve master e-waste taxonomy
- `GET /api/v1/materials/{id}/separation-guidance` - Get manual disassembly guide
- `POST /api/v1/lots` - Create new digital lot
- `GET /api/v1/lots` - List lots with filtering and pagination
- `GET /api/v1/lots/{lot_id}` - Retrieve lot details
- `PATCH /api/v1/lots/{lot_id}/weight` - Update approximate lot weight
- `POST /api/v1/lots/{lot_id}/status` - Advance lot lifecycle status
- `GET /api/v1/lots/{lot_id}/audit-trail` - Fetch complete lot history

### Database Entities

`materials`, `lots`, `lot_status_history`, `lot_images`, `lot_disassembly_guides`.

---
## 5.6 🗺️ Regional Intelligence

### Core Features

- Regional e-waste mapping
- Nearby industry mapping
- IT/automobile/manufacturing/telecom cluster identification
- Industry → potential e-waste mapping
- Regional material availability
- E-waste hotspot detection
- Recycler-demand heatmap
- Price heatmap
- Collection opportunity map

### Architecture & Service Blueprint

The Regional Intelligence Service (`backend/regional`) leverages PostGIS, Uber H3 hexagonal spatial indexes (resolution 7 to 9), and OpenStreetMap / industrial registry datasets. It calculates spatial scrap densities, cross-references industrial firmographics (e.g. telecom data centers vs auto parts fabrication) to forecast expected e-waste yields, and builds dynamic GeoJSON heatmaps for demand, pricing, and collection opportunities.

### Typed Function Specifications

```python
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel

class H3CellMetric(BaseModel):
    h3_index: str
    latitude: float
    longitude: float
    intensity_score: float  # 0.0 to 1.0
    material_category_id: Optional[UUID]
    metric_type: str  # 'DENSITY', 'DEMAND', 'PRICE', 'OPPORTUNITY'

class IndustrialClusterRecord(BaseModel):
    cluster_id: UUID
    cluster_name: str
    industry_type: str  # 'IT_PARK', 'AUTOMOTIVE', 'TELECOM', 'ELECTRONICS_MFG'
    estimated_monthly_scrap_mt: float
    primary_waste_materials: List[str]
    geo_polygon: Dict[str, Any]

# --- Regional Service Functions ---

def get_regional_ewaste_density_map(
    h3_resolution: int,
    bounding_box: Tuple[float, float, float, float]  # min_lat, min_lng, max_lat, max_lng
) -> List[H3CellMetric]:
    """
    Aggregates historical collection points and active supply signals into Uber H3 spatial cells.
    Returns density metrics for map visualization.
    """
    pass

def query_nearby_industrial_clusters(
    center_lat: float,
    center_lng: float,
    radius_km: float,
    industry_types: Optional[List[str]] = None
) -> List[IndustrialClusterRecord]:
    """
    Queries industrial parks, SEZs, and manufacturing corridors within the collector's radius.
    Spatial query: ST_DWithin(cluster_geom, ST_MakePoint(lng, lat)::geography, radius_km * 1000).
    """
    pass

def classify_industrial_zones(
    zone_polygon: Dict[str, Any]
) -> IndustrialClusterRecord:
    """
    Classifies an industrial zone based on municipal registration data, enterprise codes,
    and power consumption profiles to categorize its dominant e-waste output.
    """
    pass

def predict_ewaste_by_industry_profile(
    industry_type: str,
    facility_scale: str,  # 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE'
    employee_headcount: Optional[int]
) -> Dict[str, Any]:
    """
    Applies empirical waste generation coefficients:
    e.g. IT Park generates 12 kg server/PC scrap per employee/year;
    Telecom Tower cluster generates 45 kg lead-acid battery and copper cable scrap quarterly.
    """
    pass

def estimate_regional_material_availability(
    h3_index: str,
    material_id: UUID
) -> Dict[str, Any]:
    """
    Calculates estimated uncollected scrap volume in a given hexagonal cell
    using resident demographics, commercial density, and replacement cycle models.
    """
    pass

def detect_ewaste_hotspots(
    bounding_box: Tuple[float, float, float, float],
    lookback_days: int = 30
) -> List[Dict[str, Any]]:
    """
    Runs DBSCAN spatial clustering on recent collection requests, industrial scrap auctions,
    and scrap dealer reports to identify high-density collection hubs.
    """
    pass

def generate_recycler_demand_heatmap(
    material_id: UUID,
    geo_bounds: Tuple[float, float, float, float]
) -> Dict[str, Any]:
    """
    Produces GeoJSON FeatureCollection of H3 hexagons where color represents active authorized
    recycler procurement demand intensity and offered premium.
    """
    pass

def generate_price_heatmap(
    material_id: UUID,
    geo_bounds: Tuple[float, float, float, float]
) -> Dict[str, Any]:
    """
    Generates spatial price gradient map showing geographic pricing arbitrage
    (e.g., recycler A paying ₹30/kg higher 15 km away).
    """
    pass

def generate_collection_opportunity_map(
    collector_id: UUID,
    current_lat: float,
    current_lng: float,
    travel_budget_km: float = 10.0
) -> Dict[str, Any]:
    """
    Synthesizes supply density, buyer demand, travel cost, and local competition into
    a unified composite opportunity score per accessible zone for the collector.
    """
    pass
```

### Associated API Routes:
- `GET /api/v1/regional/map/density` - Get H3 scrap density cells
- `GET /api/v1/regional/industrial-clusters` - Find nearby industrial clusters
- `GET /api/v1/regional/hotspots` - Identify active scrap generation hotspots
- `GET /api/v1/regional/heatmaps/demand` - Recycler demand heatmap
- `GET /api/v1/regional/heatmaps/price` - Regional price disparity heatmap
- `GET /api/v1/regional/opportunities/map` - Collector personalized collection route map

### Database Entities:
`industrial_clusters`, `regional_scrap_estimates`, `h3_spatial_metrics`, `hotspot_detections`.

---
## 5.7 📈 Market & Price Intelligence

### Core Features

- Location-wise prices
- Material-wise prices
- Recycler-wise offers
- Historical prices
- Price trends
- Dynamic price estimation
- Demand estimation
- Supply estimation
- Quality-based pricing
- Quantity-based pricing
- Regional price variation
- Price anomaly detection
- Short-term price prediction

### Architecture & Service Blueprint

The Market & Price Intelligence Service (`backend/pricing`) tracks spot prices, global London Metal Exchange (LME) commodities (copper, aluminum, gold, tin, lithium), domestic scrap market bulletins, and registered recycler rate sheets. Using time-series forecasting (ARIMA / Prophet / LightGBM), it provides collectors with fair market valuation, transparency, and predictive pricing.

### Typed Function Specifications

```python
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from datetime import datetime, date
from pydantic import BaseModel, Field

class MaterialPriceQuote(BaseModel):
    material_id: UUID
    material_name: str
    grade: str
    base_price_per_kg: float
    effective_date: date
    trend_7d_pct: float
    min_expected_price: float
    max_expected_price: float

class DynamicValuationResult(BaseModel):
    lot_id: Optional[UUID]
    base_unit_rate: float
    quality_multiplier: float
    bulk_quantity_bonus: float
    transport_adjustment: float
    final_recommended_rate_per_kg: float
    total_valuation_inr: float
    confidence_interval: Tuple[float, float]

# --- Pricing Functions ---

def get_location_prices(
    material_id: UUID,
    h3_index: str
) -> List[MaterialPriceQuote]:
    """
    Fetches real-time market benchmark prices for a material within the specified spatial cell.
    """
    pass

def get_material_price_card(
    category_id: UUID
) -> Dict[str, Any]:
    """
    Returns detailed pricing breakdown across grades: Grade-A (clean, intact, unburned),
    Grade-B (partially disassembled), Grade-C (broken/low-yield scrap).
    """
    pass

def get_recycler_bids(
    material_id: UUID,
    collector_lat: float,
    collector_lng: float,
    max_distance_km: float = 50.0
) -> List[Dict[str, Any]]:
    """
    Retrieves real-time bids and rate cards from verified formal recyclers within travel distance.
    """
    pass

def get_price_history(
    material_id: UUID,
    start_date: date,
    end_date: date,
    resolution: str = "daily"  # 'daily', 'weekly', 'monthly'
) -> List[Dict[str, Any]]:
    """
    Returns historical price time-series to visualize market price movements.
    """
    pass

def calculate_price_trend(
    material_id: UUID,
    window_days: int = 30
) -> Dict[str, Any]:
    """
    Computes rolling slope, standard deviation, and direction indicator:
    'RISING_RAPIDLY', 'STABLE', 'FALLING'.
    """
    pass

def estimate_dynamic_price(
    material_id: UUID,
    grade: str,
    location_h3: str,
    quantity_kg: float
) -> DynamicValuationResult:
    """
    Core dynamic pricing formula:
    Price = (BaseRate * GradeFactor + BulkBonus(quantity)) - RegionalTransportDiscount.
    """
    pass

def estimate_material_demand_volume(
    material_id: UUID,
    region_id: str
) -> float:
    """
    Estimates unfulfilled procurement volume requested by recyclers in metric tons.
    """
    pass

def estimate_material_supply_volume(
    material_id: UUID,
    region_id: str
) -> float:
    """
    Estimates circulating inventory held across informal scrap yards.
    """
    pass

def calculate_quality_adjusted_price(
    base_price: float,
    quality_score: float,
    contamination_pct: float
) -> float:
    """
    Adjusts unit price downward for contamination (e.g. solder, dirt, plastic shells)
    and upward for virgin/unstripped high-grade boards.
    """
    pass

def apply_bulk_quantity_tier_pricing(
    base_price: float,
    weight_kg: float,
    tier_thresholds: Optional[Dict[float, float]] = None
) -> float:
    """
    Applies volume incentives: e.g. < 50kg: base; 50-200kg: +₹5/kg; > 500kg: +₹15/kg.
    """
    pass

def compute_regional_price_spread(
    material_id: UUID
) -> Dict[str, Any]:
    """
    Calculates price spread between local kabadiwala street buy rates and formal smelter factory-gate rates.
    """
    pass

def detect_price_anomalies(
    reported_price: float,
    material_id: UUID,
    region_id: str
) -> Dict[str, Any]:
    """
    Evaluates reported transaction prices using 3-sigma statistical threshold to detect
    predatory underpricing or money laundering overpricing.
    """
    pass

def predict_short_term_price(
    material_id: UUID,
    forecast_days: int = 7
) -> Dict[str, Any]:
    """
    Runs time-series model incorporating global metal commodity prices (LME copper/gold)
    to predict spot prices 7 to 14 days ahead.
    """
    pass
```

### Associated API Routes

- `GET /api/v1/pricing/spot` - Get spot price for material at location
- `GET /api/v1/pricing/materials/{id}/history` - Historical pricing time series
- `GET /api/v1/pricing/materials/{id}/forecast` - 7-day predictive price trajectory
- `POST /api/v1/pricing/valuate-lot` - Dynamic valuation calculation for lot
- `GET /api/v1/pricing/anomalies/check` - Check price quote anomaly

### Database Entities

`material_prices`, `price_history_ticks`, `recycler_rate_sheets`, `metal_commodity_benchmarks`, `price_anomaly_flags`.

---
## 5.8 💡 Entrepreneur / Opportunity Engine

### Core Features

- “What should I collect?” recommendation
- Material opportunity score
- Region opportunity score
- Demand-based collection recommendation
- Industry-based opportunity identification
- High-value material recommendations
- Best time-to-sell recommendation
- Hold/sell recommendation
- Expected earning estimation
- Net-profit opportunity calculation

### Architecture & Service Blueprint

The Opportunity Engine (`backend/opportunities`) is the brain that transforms the collector into a strategic businessman. Rather than merely maximizing the gross sale price, it optimizes for **Net Profit Opportunity** (Gross Expected Revenue minus Transport Expenses, Time Expenditure, and Holding Costs). It advises collectors on high-yield materials, optimal timing to liquidate inventory, and high-demand commercial procurement routes.

### Typed Function Specifications:

```python
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field

class CollectionTargetRecommendation(BaseModel):
    opportunity_id: UUID
    material_id: UUID
    material_name: str
    target_area_name: str
    target_h3_index: str
    expected_daily_yield_kg: float
    expected_gross_revenue: float
    estimated_transport_cost: float
    expected_net_profit: float
    opportunity_score: float = Field(ge=0.0, le=100.0)
    urgency_level: str  # 'HIGH', 'MEDIUM', 'ROUTINE'
    reasoning_summary: str

class HoldSellAdvice(BaseModel):
    lot_id: UUID
    recommendation: str  # 'SELL_NOW', 'HOLD', 'AGGREGATE'
    current_net_value: float
    projected_net_value_7d: float
    holding_cost_7d: float
    price_forecast_trend: str
    rationale: str

# --- Opportunity Engine Functions ---

def recommend_top_collection_targets(
    collector_id: UUID,
    current_lat: float,
    current_lng: float,
    limit: int = 5
) -> List[CollectionTargetRecommendation]:
    """
    Generates personalized daily recommendation answering 'What should I collect today?'
    Balances collector expertise, nearby industrial supply, high-margin materials, and buyer demand.
    """
    pass

def compute_material_opportunity_score(
    material_id: UUID,
    location_h3: str,
    collector_id: UUID
) -> float:
    """
    Computes composite score:
    Score = w1 * (DemandVolume) + w2 * (PriceMargin) + w3 * (CollectorSkill) - w4 * (LocalSupplyCompetition).
    """
    pass

def compute_region_opportunity_score(
    geo_cell_h3: str,
    collector_id: UUID
) -> float:
    """
    Evaluates an entire spatial zone for unharvested commercial e-waste potential.
    """
    pass

def match_demands_to_collection_route(
    collector_id: UUID,
    route_waypoints: List[Tuple[float, float]]
) -> List[Dict[str, Any]]:
    """
    Correlates high-urgency recycler purchase orders along the collector's planned movement corridor.
    """
    pass

def identify_industrial_scrap_opportunities(
    cluster_id: UUID,
    collector_id: UUID
) -> List[Dict[str, Any]]:
    """
    Identifies industrial decommissioning surplus (e.g. data center server upgrades, factory SMPS replacements)
    open for informal collector bidding or direct aggregation.
    """
    pass

def identify_high_margin_materials(
    collector_id: UUID,
    max_travel_km: float = 15.0
) -> List[Dict[str, Any]]:
    """
    Filters and ranks materials offering the highest profit margin per kilogram or per hour of labor
    (e.g., gold-bearing telecommunication PCBs vs bulky cathode ray monitors).
    """
    pass

def recommend_optimal_sale_timing(
    lot_id: UUID,
    price_forecast_slope: float
) -> Dict[str, Any]:
    """
    Calculates the statistical point of maximum return balancing price acceleration vs storage decay.
    """
    pass

def evaluate_hold_vs_sell(
    lot_id: UUID,
    storage_cost_per_day_inr: float = 5.0
) -> HoldSellAdvice:
    """
    Determines whether a collector should liquidate inventory immediately or hold for 7-14 days:
    If (ExpectedPriceGain - CumulativeHoldingCost - CapitalOpportunityCost) > 0, recommend HOLD.
    """
    pass

def calculate_expected_earnings(
    estimated_weight_kg: float,
    material_id: UUID,
    candidate_buyer_offers: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Computes projected gross and net earnings across all available recycler offers for an uncommitted lot.
    """
    pass

def calculate_net_profit_opportunity(
    gross_revenue: float,
    transport_cost: float,
    handling_fee: float = 0.0,
    opportunity_cost: float = 0.0
) -> Dict[str, float]:
    """
    Core profitability formula:
    NetProfit = GrossRevenue - (TransportExpenses + Handling + OpportunityCost).
    Returns net profit in INR and net profit margin %.
    """
    pass
```

### Associated API Routes

- `GET /api/v1/opportunities/recommendations` - Daily collection target advice
- `GET /api/v1/opportunities/high-margin` - List high-margin materials nearby
- `POST /api/v1/opportunities/hold-sell-advice` - Analyze whether to hold or sell lot
- `POST /api/v1/opportunities/net-profit-calc` - Interactive net profit calculator

### Database Entities

`collection_opportunities`, `opportunity_recommendation_history`, `hold_sell_logs`.

---
## 5.9 🏭 Recycler Marketplace

### Core Features

- Authorised recycler discovery
- Recycler verification
- Nearby recycler search
- Accepted-material information
- Recycler offers
- Offer comparison
- Recycler ratings
- Recycler reliability
- Pickup availability
- Drop-off options

### Architecture & Service Blueprint

The Recycler Marketplace (`backend/recyclers`) connects collectors directly with government-authorized formal e-waste dismantlers, shredders, and PROs (Producer Responsibility Organisations). It enforces strict regulatory validation (State Pollution Control Board / Central Pollution Control Board registration), facilitates spot offers, compares competing terms, and indexes recycler operational reliability.

### Typed Function Specifications


```python
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from pydantic import BaseModel, Field

class RecyclerDirectoryRecord(BaseModel):
    recycler_id: UUID
    company_name: str
    cpcb_license_number: str
    is_verified: bool
    facility_latitude: float
    facility_longitude: float
    accepted_material_ids: List[UUID]
    composite_rating: float
    reliability_index: float
    offers_doorstep_pickup: bool
    minimum_pickup_weight_kg: float

class CompetingOfferComparison(BaseModel):
    offer_id: UUID
    recycler_id: UUID
    recycler_name: str
    quoted_rate_per_kg: float
    distance_km: float
    estimated_transport_cost: float
    logistics_type: str  # 'DOORSTEP_PICKUP', 'SELF_DROPOFF'
    projected_net_payout: float
    payment_terms: str  # 'INSTANT_UPI', 'SAME_DAY_BANK', 'CASH'
    reliability_badge: str

# --- Marketplace Functions ---

def search_authorized_recyclers(
    collector_lat: float,
    collector_lng: float,
    radius_km: float = 50.0,
    compliance_verified_only: bool = True
) -> List[RecyclerDirectoryRecord]:
    """
    Searches certified recycling facilities within geographic boundary.
    Filters by regulatory compliance and active operational status.
    """
    pass

def verify_recycler_cpcb_authorization(
    recycler_id: UUID,
    license_number: str
) -> Dict[str, Any]:
    """
    Verifies valid CPCB/SPCB registration and authorized capacity limits (in MT/annum)
    against the national EPR regulatory portal.
    """
    pass

def find_nearby_recyclers(
    lat: float,
    lng: float,
    limit: int = 10
) -> List[RecyclerDirectoryRecord]:
    """
    Returns nearest facilities ordered by spatial Euclidean/road distance.
    """
    pass

def get_recycler_accepted_materials(
    recycler_id: UUID
) -> List[Dict[str, Any]]:
    """
    Retrieves full manifest of materials accepted by the recycler, minimum quality grades,
    and prohibited items.
    """
    pass

def list_active_recycler_offers(
    recycler_id: UUID
) -> List[Dict[str, Any]]:
    """
    Lists published purchase offers, spot rates, and seasonal procurement quotas.
    """
    pass

def compare_offers_for_lot(
    lot_id: UUID,
    collector_lat: float,
    collector_lng: float
) -> List[CompetingOfferComparison]:
    """
    Ranks all candidate bids for a specific lot.
    Calculates **Net Payout = Gross Offer - Estimated Transport Cost**
    so the collector sees actual in-pocket realization.
    """
    pass

def calculate_recycler_composite_rating(
    recycler_id: UUID
) -> Dict[str, Any]:
    """
    Aggregates verified collector reviews on scale fairness, payout speed,
    and professionalism.
    """
    pass

def get_recycler_reliability_metrics(
    recycler_id: UUID
) -> Dict[str, float]:
    """
    Calculates algorithmic reliability metrics:
    - Weight deduction rate (% lots where recycler downgraded weight)
    - Payment promptness (average minutes between weighing and disbursement)
    - Pickup dispatch punctuality.
    """
    pass

def check_recycler_pickup_availability(
    recycler_id: UUID,
    collector_lat: float,
    collector_lng: float,
    lot_weight_kg: float
) -> Dict[str, Any]:
    """
    Evaluates whether the recycler provides truck dispatch for the specified lot location and volume.
    """
    pass

def get_recycler_dropoff_windows(
    recycler_id: UUID
) -> List[Dict[str, Any]]:
    """
    Retrieves facility receiving gate hours, dock queue wait times, and gate pass protocols.
    """
    pass
```

### Associated API Routes

- `GET /api/v1/recyclers` - Search authorized recyclers with filters
- `GET /api/v1/recyclers/{id}` - Get recycler profile and facilities
- `GET /api/v1/recyclers/{id}/materials` - Get accepted materials and rate rules
- `POST /api/v1/marketplace/lots/{lot_id}/compare-offers` - Compare competing buyer offers

### Database Entities

`recyclers`, `recycler_authorizations`, `recycler_accepted_materials`, `recycler_ratings`, `recycler_reliability_scores`.

---
## 5.10 🔄 Reverse Marketplace

### Core Features

- Recycler posts material demand
- Required quantity
- Required material quality
- Offered price
- Demand deadline
- Collector supply matching
- Bulk-demand matching
- Demand alerts

### Architecture & Service Blueprint

The Reverse Marketplace Service (`backend/demands`) shifts the paradigm from collectors pushing small random lots to formal recyclers posting specific procurement targets (e.g., "Need 5 Metric Tons of Server Power Supply Units @ ₹180/kg by Friday"). It matches matching collector supply, facilitates group lot coalitions, and pushes geo-fenced demand broadcasts.

### Typed Function Specifications

```python
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field

class ProcurementDemandDTO(BaseModel):
    demand_id: Optional[UUID]
    recycler_id: UUID
    material_category_id: UUID
    target_quantity_kg: float = Field(..., gt=0.0)
    minimum_grade: str
    offered_price_per_kg: float = Field(..., gt=0.0)
    max_distance_km: float = 100.0
    deadline_utc: datetime
    quality_specifications: Dict[str, Any]

class MatchedSupplySummary(BaseModel):
    demand_id: UUID
    total_matched_lots: int
    aggregate_weight_kg: float
    fulfillment_percentage: float
    matched_collector_ids: List[UUID]

# --- Reverse Marketplace Functions ---

def create_material_demand(
    demand_spec: ProcurementDemandDTO
) -> Dict[str, Any]:
    """
    Registers new recycler procurement order, validates credit balance/escrow,
    and initiates automated matching engine.
    """
    pass

def set_demand_quantity_bounds(
    demand_id: UUID,
    min_fulfillment_kg: float,
    max_fulfillment_kg: float
) -> Dict[str, Any]:
    """
    Defines partial-fill rules (e.g. minimum 500 kg batch, maximum 10,000 kg).
    """
    pass

def specify_demand_quality_criteria(
    demand_id: UUID,
    acceptable_grades: List[str],
    max_contamination_pct: float
) -> Dict[str, Any]:
    """
    Attaches formal laboratory/visual inspection criteria required for payout.
    """
    pass

def set_demand_pricing_structure(
    demand_id: UUID,
    base_rate: float,
    volume_bonus_tiers: Dict[float, float]
) -> Dict[str, Any]:
    """
    Configures step-up bonuses for aggregated supplies.
    """
    pass

def set_demand_expiration(
    demand_id: UUID,
    expiry_timestamp: datetime
) -> Dict[str, Any]:
    """
    Sets strict order deadline after which unfulfilled demand closes automatically.
    """
    pass

def match_collector_lots_to_demand(
    demand_id: UUID
) -> List[Dict[str, Any]]:
    """
    Finds individual unsold collector lots within radius matching material and quality criteria.
    """
    pass

def match_bulk_demands_to_collector_coalitions(
    demand_id: UUID
) -> MatchedSupplySummary:
    """
    Runs knapsack/clustering algorithm to group multiple small collector lots
    into a single cohesive bulk fulfillment package.
    """
    pass

def broadcast_demand_alert_to_collectors(
    demand_id: UUID,
    target_radius_km: float = 25.0
) -> Dict[str, Any]:
    """
    Dispatches high-priority push notifications and voice SMS alerts to active collectors
    operating in the catchment zone.
    """
    pass
```

### Associated API Routes:
- `POST /api/v1/demands` - Recycler creates procurement demand
- `GET /api/v1/demands` - List active demands with filters
- `GET /api/v1/demands/{id}` - Demand specifications and fulfillment status
- `POST /api/v1/demands/{id}/match-supply` - Run matching pipeline against unsold lots
- `POST /api/v1/demands/{id}/broadcast` - Dispatch push alerts to nearby collectors

### Database Entities:
`procurement_demands`, `demand_quality_specs`, `demand_lot_allocations`, `demand_alerts`.

---
## 5.11 📦 Aggregation & Bulk Selling

### Core Features:
- Combine multiple collector lots
- Material aggregation
- Bulk-order fulfilment
- Collective selling
- Bulk-price negotiation
- Individual ownership tracking
- Individual revenue settlement

### Architecture & Service Blueprint:
The Aggregation & Bulk Selling Service (`backend/aggregation`) enables small informal collectors to pool their micro-lots (e.g. 5 collectors combining 20 kg each to make 100 kg) to unlock high-tier bulk prices offered by industrial smelters. It maintains individual pro-rata ownership ledgers, ensures zero equity dilution, and automates proportional revenue settlement when the aggregate lot is sold.

### Typed Function Specifications:

```python
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field

class AggregateLotDTO(BaseModel):
    aggregate_lot_id: UUID
    aggregation_hub_id: UUID
    material_category_id: UUID
    total_constituent_lots: int
    total_aggregate_weight_kg: float
    status: str  # 'OPEN_POOLING', 'LOCKED_READY_FOR_SALE', 'SOLD_SETTLED'
    created_at: datetime

class CollectorLotContribution(BaseModel):
    lot_id: UUID
    collector_id: UUID
    weight_kg: float
    pro_rata_share_pct: float
    grade: str
    verified_at: datetime

class SettlementDistributionRecord(BaseModel):
    aggregate_lot_id: UUID
    collector_id: UUID
    gross_payout_inr: float
    logistics_deduction_inr: float
    net_payout_inr: float
    payment_status: str

# --- Aggregation Service Functions ---

def create_aggregate_lot(
    initiator_collector_id: UUID,
    constituent_lot_ids: List[UUID],
    hub_facility_id: UUID
) -> AggregateLotDTO:
    """
    Combines individual collector lots into an aggregate batch.
    Validates material compatibility and locks child lots from independent sale.
    """
    pass

def consolidate_materials_by_grade(
    aggregate_lot_id: UUID
) -> Dict[str, Any]:
    """
    Sorts and grades pooled materials at the local physical aggregation center.
    Calculates unified yield index and moisture/impurity deduction percentages.
    """
    pass

def fulfill_bulk_demand(
    demand_id: UUID,
    aggregate_lot_id: UUID
) -> Dict[str, Any]:
    """
    Binds an aggregate lot to a pending industrial recycler demand.
    Locks sale contract price per kilogram.
    """
    pass

def create_collective_sale_contract(
    aggregate_lot_id: UUID,
    buyer_recycler_id: UUID,
    agreed_price_per_kg: float
) -> Dict[str, Any]:
    """
    Generates multi-party legal procurement agreement between collector coalition and buyer.
    """
    pass

def negotiate_bulk_premium(
    aggregate_lot_id: UUID,
    target_recycler_id: UUID,
    offered_bid_inr: float
) -> Dict[str, Any]:
    """
    Facilitates structured digital counter-offers based on quantity tier curves.
    """
    pass

def track_individual_lot_contributions(
    aggregate_lot_id: UUID
) -> List[CollectorLotContribution]:
    """
    Calculates proportional equity share of each contributing collector:
    Share_i = (Weight_i * GradeMultiplier_i) / Sum(Weight_j * GradeMultiplier_j).
    """
    pass

def settle_individual_aggregate_payouts(
    aggregate_lot_id: UUID,
    net_realized_proceeds_inr: float
) -> List[SettlementDistributionRecord]:
    """
    Automates distribution of total sale proceeds into individual collector accounts/UPI
    in accordance with verified equity shares, subtracting proportional freight costs.
    """
    pass
```

### Associated API Routes:
- `POST /api/v1/aggregation/pools` - Create new aggregation batch
- `POST /api/v1/aggregation/pools/{id}/join` - Add collector lot to pool
- `GET /api/v1/aggregation/pools/{id}/shares` - View individual ownership shares
- `POST /api/v1/aggregation/pools/{id}/settle` - Execute individual revenue settlement

### Database Entities:
`aggregate_lots`, `aggregate_lot_items`, `aggregation_hubs`, `collective_settlements`.

---
## 5.12 🤝 Smart Matching

### Core Features:
- Collector → recycler matching
- Material compatibility
- Price-based matching
- Distance-based matching
- Demand-based matching
- Quantity matching
- Transport-cost consideration
- Recycler reliability
- Best **net-earning** recommendation

### Architecture & Service Blueprint:
The Smart Matching Engine (`backend/matching`) implements a multi-criteria optimization algorithm (using linear programming and scoring heuristics). Rather than suggesting the buyer with the highest gross rate, it calculates the highest **Net Return to Collector** after subtracting freight distance penalties and applying reliability risk discounts.

### Typed Function Specifications:

```python
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field

class SmartMatchCandidate(BaseModel):
    recycler_id: UUID
    recycler_name: str
    gross_offered_price_per_kg: float
    gross_total_inr: float
    road_distance_km: float
    estimated_freight_inr: float
    reliability_discount_factor: float
    net_projected_payout_inr: float
    match_score: float = Field(ge=0.0, le=100.0)
    recommendation_rank: int
    reasons_for_recommendation: List[str]

# --- Matching Service Functions ---

def find_optimal_recycler_matches(
    lot_id: UUID,
    max_results: int = 5
) -> List[SmartMatchCandidate]:
    """
    Main matching entry point. Filters for material compatibility, computes road distance,
    deducts transport costs, weights recycler reliability, and returns ranked matches.
    """
    pass

def filter_compatible_buyers(
    material_category_id: UUID,
    grade: str,
    candidate_recycler_ids: List[UUID]
) -> List[UUID]:
    """
    Filters out recyclers that do not possess CPCB authorization or technical capability
    to process the specific material grade.
    """
    pass

def rank_by_gross_payout(
    lot_weight_kg: float,
    candidates: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Sorts candidates strictly by gross financial offer.
    """
    pass

def rank_by_proximity(
    collector_lat: float,
    collector_lng: float,
    candidates: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Sorts candidates by shortest road distance using OSRM routing engine.
    """
    pass

def match_with_urgent_demands(
    lot_id: UUID,
    candidate_demands: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Prioritizes matches where a recycler has an active procurement deadline within 48 hours,
    which often carry price premiums.
    """
    pass

def evaluate_quantity_thresholds(
    lot_weight_kg: float,
    recycler_min_weight_kg: float,
    recycler_max_weight_kg: float
) -> float:
    """
    Returns a suitability factor (0.0 to 1.0) indicating how well the lot weight fits
    the buyer's batch processing window.
    """
    pass

def estimate_transport_cost(
    origin_lat: float,
    origin_lng: float,
    destination_lat: float,
    destination_lng: float,
    weight_kg: float
) -> float:
    """
    Calculates realistic local freight cost in INR:
    Cost = BaseHandlingFee + (Distance_km * PerKmVehicleRate) + (Weight_kg * WeightLoadFactor).
    """
    pass

def factor_reliability_discount(
    recycler_id: UUID,
    raw_match_score: float
) -> float:
    """
    Adjusts score based on historical downgrade frequency:
    If recycler frequently cuts weights by 15% at the dock, apply an algorithmic discount.
    """
    pass

def recommend_best_net_earning_recycler(
    lot_id: UUID,
    collector_id: UUID
) -> SmartMatchCandidate:
    """
    Final decision function returning the single optimal recommendation for the collector's pocket.
    """
    pass
```

### Associated API Routes:
- `POST /api/v1/matching/lots/{lot_id}/recommend` - Get smart matching candidates
- `POST /api/v1/matching/calculate-net-earning` - Simulate net earnings comparison

### Database Entities:
`matching_rules`, `smart_match_recommendation_history`, `transport_rate_tables`.

---
## 5.13 🚚 Logistics

### Core Features:
- Pickup requests
- Pickup scheduling
- Drop-off coordination
- Distance calculation
- Route estimation
- Transport-cost estimation
- Multi-collector pickup
- Pickup status
- Delivery confirmation

### Architecture & Service Blueprint:
The Logistics Engine (`backend/logistics`) integrates with Open Source Routing Machine (OSRM) and MapLibre. It coordinates logistics between scattered informal scrap yards and centralized recycler gates, handles vehicle dispatching (from 3-wheeler tempos to 10-ton flatbeds), groups multiple small pickups along a shared collection route, and verifies proof-of-delivery (POD).

### Typed Function Specifications:

```python
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field

class PickupRequestDTO(BaseModel):
    pickup_request_id: Optional[UUID]
    lot_id: UUID
    collector_id: UUID
    recycler_id: UUID
    pickup_address: str
    latitude: float
    longitude: float
    weight_kg: float
    preferred_slot_start: datetime
    preferred_slot_end: datetime

class LogisticsRouteManifest(BaseModel):
    route_id: UUID
    driver_id: Optional[UUID]
    vehicle_registration: str
    total_stops: int
    total_distance_km: float
    estimated_duration_minutes: int
    waypoints: List[Dict[str, Any]]
    status: str

# --- Logistics Functions ---

def request_recycler_pickup(
    request_data: PickupRequestDTO
) -> Dict[str, Any]:
    """
    Submits official request to buyer for vehicle dispatch to collector location.
    """
    pass

def schedule_pickup_slot(
    pickup_request_id: UUID,
    scheduled_time: datetime,
    assigned_vehicle_type: str  # 'AUTO_RICKSHAW_LOADER', 'LIGHT_COMMERCIAL_VEHICLE', 'HEAVY_TRUCK'
) -> Dict[str, Any]:
    """
    Locks logistics time window and informs collector and transport driver.
    """
    pass

def generate_dropoff_pass(
    lot_id: UUID,
    facility_id: UUID,
    target_arrival_time: datetime
) -> Dict[str, Any]:
    """
    Generates QR code gate pass for collectors opting for self-drop-off at the facility dock.
    """
    pass

def compute_road_distance_matrix(
    origin: Tuple[float, float],
    destinations: List[Tuple[float, float]]
) -> List[float]:
    """
    Calls OSRM routing engine to compute actual road network distances in kilometers.
    """
    pass

def generate_optimal_collection_route(
    stops: List[Dict[str, Any]],
    vehicle_capacity_kg: float
) -> LogisticsRouteManifest:
    """
    Solves Capacitated Vehicle Routing Problem (CVRP) to collect from multiple collectors
    in a single efficient loop.
    """
    pass

def calculate_route_transport_cost(
    distance_km: float,
    vehicle_type: str,
    diesel_rate_inr: float
) -> float:
    """
    Computes total transport expenditure including fuel, driver wage, and toll charges.
    """
    pass

def cluster_multi_collector_pickups(
    pending_pickups: List[PickupRequestDTO],
    max_payload_kg: float = 1500.0
) -> List[List[PickupRequestDTO]]:
    """
    Clusters geographically proximate micro-pickups into single truckloads.
    """
    pass

def track_pickup_execution_status(
    pickup_id: UUID
) -> Dict[str, Any]:
    """
    Returns real-time vehicle dispatch state:
    'REQUESTED', 'DRIVER_ASSIGNED', 'EN_ROUTE_PICKUP', 'LOADED', 'DELIVERED'.
    """
    pass

def confirm_logistics_delivery(
    pickup_id: UUID,
    dock_manager_signature: str,
    pod_photo_url: str
) -> Dict[str, Any]:
    """
    Records verifiable Proof of Delivery (POD) at the recycler facility gate.
    """
    pass
```

### Associated API Routes:
- `POST /api/v1/logistics/pickup-requests` - Create pickup request
- `POST /api/v1/logistics/routes/optimize` - Generate optimal collection route
- `GET /api/v1/logistics/pickups/{id}/status` - Live tracking of vehicle dispatch
- `POST /api/v1/logistics/pickups/{id}/pod` - Submit proof of delivery

### Database Entities:
`pickup_requests`, `logistics_routes`, `logistics_vehicles`, `delivery_receipts`.

---
## 5.14 🔗 Traceability & Handover

### Core Features:
- Digital handover
- Before-handover photos
- Recycler-side weighing
- Final weight
- Final price
- GPS
- Timestamp
- Collector confirmation
- Recycler confirmation
- Unique transaction ID
- Complete lot history
- Digital transaction receipt

### Architecture & Service Blueprint:
The Traceability & Handover Engine (`backend/handover`) creates an immutable audit trail fulfilling Central Pollution Control Board (CPCB) Extended Producer Responsibility (EPR) requirements. It bridges the critical physical transfer step: capturing pre-handover condition photos, calibrated scale readings, GPS geofence verification, and bilateral cryptographic PIN/OTP acceptance.

### Typed Function Specifications:

```python
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field

class HandoverSessionRecord(BaseModel):
    handover_id: UUID
    lot_id: UUID
    collector_id: UUID
    recycler_id: UUID
    facility_scale_id: Optional[str]
    gross_weight_kg: Optional[float]
    tare_weight_kg: Optional[float]
    final_certified_net_weight_kg: Optional[float]
    final_settlement_price_inr: Optional[float]
    collector_confirmed: bool
    recycler_confirmed: bool
    unique_transaction_manifest_id: Optional[str]
    completed_at: Optional[datetime]

# --- Handover Functions ---

def initiate_digital_handover(
    lot_id: UUID,
    collector_id: UUID,
    recycler_id: UUID
) -> HandoverSessionRecord:
    """
    Initiates formal digital handover session when collector arrives at dock or pickup truck.
    """
    pass

def record_pre_handover_inspection_photos(
    handover_id: UUID,
    photo_urls: List[str]
) -> Dict[str, Any]:
    """
    Uploads inspection photos taken on the dock prior to unloading to document condition.
    """
    pass

def record_recycler_calibrated_weight(
    handover_id: UUID,
    scale_device_id: str,
    gross_kg: float,
    tare_kg: float
) -> Dict[str, Any]:
    """
    Captures calibrated digital weighbridge/dock scale readings directly via Bluetooth/RS232
    or verified scale display photograph.
    """
    pass

def compute_net_final_weight(
    gross_kg: float,
    tare_kg: float,
    moisture_deduction_kg: float = 0.0,
    contamination_deduction_kg: float = 0.0
) -> float:
    """
    Calculates final certified net weight:
    NetWeight = (GrossWeight - TareWeight) - (MoistureDeduction + ContaminationDeduction).
    """
    pass

def calculate_final_settlement_price(
    certified_net_weight_kg: float,
    contracted_rate_per_kg: float,
    dock_grade_adjustment: float = 0.0
) -> float:
    """
    Computes final financial obligation before tax and digital payouts.
    """
    pass

def verify_handover_geofence(
    handover_id: UUID,
    collector_gps_lat: float,
    collector_gps_lng: float,
    facility_boundary_geojson: Dict[str, Any]
) -> bool:
    """
    Cryptographically verifies that handover confirmation occurs inside the authorized facility perimeter.
    """
    pass

def generate_tamper_evident_handover_timestamp(
    handover_id: UUID
) -> str:
    """
    Creates cryptographic proof tying previous block hash, ISO timestamp, and GPS coordinates.
    """
    pass

def sign_collector_handover(
    handover_id: UUID,
    collector_otp_or_biometric: str
) -> Dict[str, Any]:
    """
    Captures collector's consent on certified net weight and price via one-time PIN.
    """
    pass

def sign_recycler_handover(
    handover_id: UUID,
    authorized_agent_pin: str
) -> Dict[str, Any]:
    """
    Captures recycler dock officer's legal confirmation and custody acceptance.
    """
    pass

def issue_unique_transaction_manifest_id(
    handover_id: UUID
) -> str:
    """
    Generates CPCB-compliant EPR Transaction Manifest ID:
    e.g. EPR-MNF-2026-MH-98472910.
    """
    pass

def get_immutable_lot_lifecycle_chain(
    lot_id: UUID
) -> List[Dict[str, Any]]:
    """
    Returns unbroken chain of custody from informal waste pick to smelter processing.
    """
    pass

def generate_digital_handover_receipt(
    handover_id: UUID
) -> Dict[str, Any]:
    """
    Generates bilingual PDF and SMS receipt with barcode, verified weights, and payout details.
    """
    pass
```

### Associated API Routes:
- `POST /api/v1/handover/initiate` - Start handover session
- `POST /api/v1/handover/{id}/weigh` - Submit calibrated scale weights
- `POST /api/v1/handover/{id}/sign-collector` - Collector OTP confirmation
- `POST /api/v1/handover/{id}/sign-recycler` - Recycler dock signoff
- `GET /api/v1/handover/{id}/receipt` - Download digital transaction receipt

### Database Entities:
`handover_sessions`, `scale_weighing_logs`, `handover_signatures`, `epr_manifest_records`.

---
## 5.15 💳 Payments

### Core Features:
- Cash payment
- UPI
- Bank transfer
- Payment status
- Payment confirmation
- Digital receipts
- Pending-payment tracking

### Architecture & Service Blueprint:
The Payment Service (`backend/payments`) interfaces with National Payments Corporation of India (NPCI) UPI rails, Razorpay/Cashfree Payout APIs, and local banking gateways. Because many kabadiwalas depend on instant cash flow for daily sustenance, the platform supports real-time instant UPI payouts to VPA/phone numbers, verified cash-on-handover receipts with SMS confirmation, and pending receivables tracking.

### Typed Function Specifications:

```python
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field

class PaymentDisbursementDTO(BaseModel):
    transaction_id: UUID
    recipient_collector_id: UUID
    amount_inr: float = Field(..., gt=0.0)
    payment_mode: str  # 'UPI', 'IMPS_BANK_TRANSFER', 'CASH_CONFIRMED'
    upi_vpa: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None

class PaymentReceiptRecord(BaseModel):
    payment_id: UUID
    transaction_id: UUID
    utr_number: Optional[str]
    amount_inr: float
    payment_mode: str
    status: str  # 'INITIATED', 'PROCESSING', 'SUCCESS', 'FAILED', 'REFUNDED'
    receipt_pdf_url: str
    completed_at: Optional[datetime]

# --- Payment Service Functions ---

def record_cash_settlement(
    transaction_id: UUID,
    amount_inr: float,
    collector_ack_code: str
) -> Dict[str, Any]:
    """
    Records physical cash paid on the dock. Generates instant two-way SMS acknowledgement
    so the collector has verifiable digital proof of received cash.
    """
    pass

def initiate_instant_upi_transfer(
    disbursement: PaymentDisbursementDTO
) -> PaymentReceiptRecord:
    """
    Executes instant UPI 24x7 payout directly to collector's VPA or Aadhaar-linked phone number.
    Returns transaction UTR within 5 seconds.
    """
    pass

def queue_bank_transfer_payout(
    disbursement: PaymentDisbursementDTO
) -> Dict[str, Any]:
    """
    Initiates IMPS/NEFT transfer for collectors without UPI VPAs.
    """
    pass

def poll_payment_gateway_status(
    payment_id: UUID
) -> str:
    """
    Queries payment gateway webhook and settlement status.
    """
    pass

def emit_payment_success_event(
    payment_id: UUID,
    utr_number: str
) -> None:
    """
    Publishes PaymentSuccessEvent to Kafka, updating collector earnings dashboard,
    closing pending lot balance, and sending SMS alert.
    """
    pass

def generate_payment_receipt_pdf_or_sms(
    payment_id: UUID,
    locale: str = "hi"
) -> Dict[str, Any]:
    """
    Generates tax-compliant formal transaction invoice and localized SMS confirmation message.
    """
    pass

def list_pending_collector_receivables(
    collector_id: UUID
) -> Dict[str, Any]:
    """
    Returns total pending unsettled receivables owed by recyclers for delivered lots.
    """
    pass
```

### Associated API Routes:
- `POST /api/v1/payments/disburse` - Initiate payout (UPI / Bank)
- `POST /api/v1/payments/cash-ack` - Confirm dock cash settlement
- `GET /api/v1/payments/{id}/status` - Query payment status
- `GET /api/v1/payments/collector/{id}/pending` - List pending receivables
- `GET /api/v1/payments/{id}/receipt` - Download payment receipt

### Database Entities:
`payments`, `payment_disbursements`, `collector_bank_accounts`, `payment_webhook_logs`.

---
## 5.16 🛡️ Safety

### Core Features:
- Camera-based hazard detection
- Battery warnings
- CRT warnings
- Unsafe-processing warnings
- No burning guidance
- No crude-acid-treatment guidance
- Safe handling instructions
- Pictorial safety guides
- Audio safety instructions

### Architecture & Service Blueprint:
The Safety Guidance Engine (`backend/safety`) addresses the acute occupational health and environmental hazards prevalent in informal scrap handling. Through computer vision, rule engines, and multimedia instructions (pictorial infographics and regional voice prompts), it alerts collectors against toxic crude acid baths, open-wire burning, swollen lithium batteries, and hazardous CRT glass implosions.

### Typed Function Specifications:

```python
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel

class SafetyHazardAlert(BaseModel):
    hazard_id: UUID
    hazard_code: str  # 'LITHIUM_THERMAL_RUNAWAY', 'CRT_IMPLOSION', 'LEAD_TOXICITY', 'ACID_HAZARD'
    severity: str  # 'CRITICAL', 'HIGH', 'MODERATE'
    pictorial_guide_url: str
    audio_warning_url: str
    warning_text_hindi: str
    warning_text_marathi: str
    prohibited_actions: List[str]
    safe_handling_sop: List[str]

# --- Safety Service Functions ---

def scan_image_for_hazards(
    image_bytes: bytes
) -> List[SafetyHazardAlert]:
    """
    Scans camera photo for visual hazard signatures (bulging batteries, cracked glass, acid staining).
    """
    pass

def detect_swollen_or_damaged_batteries(
    detection_boxes: List[Dict[str, Any]]
) -> Optional[SafetyHazardAlert]:
    """
    Detects deformed Li-ion batteries at risk of thermal runaway.
    Triggers immediate audio warning to isolate in sand/metal container.
    """
    pass

def detect_crt_vacuum_implosion_hazard(
    detection_boxes: List[Dict[str, Any]]
) -> Optional[SafetyHazardAlert]:
    """
    Identifies exposed cathode ray tubes with intact vacuum neck and hazardous leaded funnel glass.
    """
    pass

def flag_informal_dismantling_risk(
    material_category_id: UUID,
    collector_action: str
) -> Dict[str, Any]:
    """
    Flags dangerous manual dismantling attempts on sealed mercury relays, capacitors, or refrigerants.
    """
    pass

def check_and_trigger_no_burn_alert(
    material_type: str,
    locale: str = "hi"
) -> Dict[str, Any]:
    """
    Displays bold red visual alert and plays loud audio prompt forbidding wire burning:
    'Taar ko aag mat lagao! Isse zehreela dhuwa nikalta hai aur taambe ka daam kam hota hai.'
    """
    pass

def check_and_trigger_no_acid_leaching_alert(
    material_type: str,
    locale: str = "hi"
) -> Dict[str, Any]:
    """
    Educates collector against cyanide/aqua-regia crude leaching; directs to authorized refiners.
    """
    pass

def retrieve_material_safe_handling_sop(
    material_id: UUID
) -> List[Dict[str, str]]:
    """
    Retrieves illustrated standard operating procedure (SOP) cards for material handling.
    """
    pass

def get_visual_safety_infographics(
    hazard_code: str
) -> Dict[str, Any]:
    """
    Returns SVG/PNG visual icon cards optimized for zero-text comprehension.
    """
    pass

def play_audio_safety_warning(
    hazard_id: UUID,
    locale: str
) -> bytes:
    """
    Streams high-urgency spoken audio warning in Hindi or Marathi.
    """
    pass
```

### Associated API Routes:
- `POST /api/v1/safety/scan` - Real-time hazard image inspection
- `GET /api/v1/safety/materials/{id}/sop` - Safe handling guidelines
- `GET /api/v1/safety/alerts/{hazard_code}/audio` - Stream spoken audio safety warning

### Database Entities:
`safety_hazards`, `safety_sop_cards`, `collector_safety_acknowledgements`.

---
## 5.17 📊 Entrepreneur Dashboard

### Core Features:
- Daily earnings
- Weekly earnings
- Monthly earnings
- Total collection volume
- Material-wise revenue
- Recycler-wise revenue
- Average selling price
- Estimated profit
- Transport expenses
- Pending sales
- Pending payments
- Best-performing material
- Best-performing recycler

### Architecture & Service Blueprint:
The Entrepreneur Dashboard Service (`backend/analytics/collector`) powers the collector's business cockpit. It aggregates transactions into daily/weekly/monthly earnings metrics, computes net margins after subtracting transportation fuel and vehicle expenses, and highlights top-earning material categories and trusted buyers.

### Typed Function Specifications:

```python
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import date, datetime
from pydantic import BaseModel

class EarningsSummaryDTO(BaseModel):
    collector_id: UUID
    period: str  # 'DAILY', 'WEEKLY', 'MONTHLY'
    gross_earnings_inr: float
    transport_expenses_inr: float
    net_profit_inr: float
    total_volume_kg: float
    lots_completed: int
    pending_payouts_inr: float
    inventory_valuation_inr: float

class CategoryRevenueShare(BaseModel):
    material_category_id: UUID
    material_name: str
    volume_kg: float
    revenue_inr: float
    percentage_share: float
    average_price_per_kg: float

# --- Dashboard Service Functions ---

def get_daily_earnings_summary(
    collector_id: UUID,
    target_date: date
) -> EarningsSummaryDTO:
    """
    Fetches real-time financial ledger for the current day.
    """
    pass

def get_weekly_earnings_aggregation(
    collector_id: UUID,
    start_date: date
) -> EarningsSummaryDTO:
    """
    Aggregates weekly rolling metrics for trend comparison.
    """
    pass

def get_monthly_earnings_report(
    collector_id: UUID,
    year: int,
    month: int
) -> EarningsSummaryDTO:
    """
    Generates monthly business summary and income certificate.
    """
    pass

def get_cumulative_collection_volume_kg(
    collector_id: UUID,
    timeframe: str = "ALL_TIME"
) -> float:
    """
    Returns total physical e-waste volume collected and formally recycled.
    """
    pass

def get_revenue_breakdown_by_material(
    collector_id: UUID,
    start_date: date,
    end_date: date
) -> List[CategoryRevenueShare]:
    """
    Generates material revenue contribution pie/bar data.
    """
    pass

def get_revenue_breakdown_by_recycler(
    collector_id: UUID,
    start_date: date,
    end_date: date
) -> List[Dict[str, Any]]:
    """
    Breaks down revenue realization across different buyer entities.
    """
    pass

def calculate_average_realized_price(
    collector_id: UUID,
    material_id: UUID,
    lookback_days: int = 30
) -> float:
    """
    Computes average actual selling price per kg achieved by the collector.
    """
    pass

def calculate_estimated_net_profit(
    collector_id: UUID,
    start_date: date,
    end_date: date
) -> Dict[str, float]:
    """
    Computes Net Margin % = (Net Profit / Gross Revenue) * 100.
    """
    pass

def aggregate_transport_and_logistics_expenses(
    collector_id: UUID,
    start_date: date,
    end_date: date
) -> float:
    """
    Sums all logged freight, fuel, and auto expenses.
    """
    pass

def get_active_unsold_inventory_value(
    collector_id: UUID
) -> Dict[str, Any]:
    """
    Valuates current unsold scrap held in collector's yard at active spot rates.
    """
    pass

def get_unsettled_transaction_balances(
    collector_id: UUID
) -> float:
    """
    Sums receivables from delivered lots awaiting payment clearing.
    """
    pass

def identify_highest_earning_material(
    collector_id: UUID
) -> Dict[str, Any]:
    """
    Identifies collector's #1 profit generator.
    """
    pass

def identify_highest_paying_recycler(
    collector_id: UUID
) -> Dict[str, Any]:
    """
    Identifies buyer offering highest net return after transport deductions.
    """
    pass
```

### Associated API Routes:
- `GET /api/v1/dashboard/collector/summary` - Collector financial KPIs summary
- `GET /api/v1/dashboard/collector/breakdown/material` - Revenue by material
- `GET /api/v1/dashboard/collector/breakdown/recycler` - Revenue by recycler
- `GET /api/v1/dashboard/collector/inventory` - Current unsold inventory valuation

### Database Entities:
`collector_daily_ledgers`, `collector_expense_logs`, `collector_inventory_cache`.

---
## 5.18 🧠 Business Intelligence

### Core Features:
- Personalised business insights
- Underpriced-sale detection
- Best material identification
- Best recycler identification
- Best region identification
- Collection pattern analysis
- Profitability analysis
- Price-performance comparison
- Earnings improvement suggestions
- Business growth recommendations

### Architecture & Service Blueprint:
The Business Intelligence Engine (`backend/analytics/bi`) functions as an automated digital mentor. It runs diagnostic analytics on past transactions, flags when a collector sold below fair market value, uncovers lucrative collection corridors, and provides actionable recommendations to increase monthly income by 30-50%.

### Typed Function Specifications:

```python
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel

class BusinessInsight(BaseModel):
    insight_id: UUID
    collector_id: UUID
    insight_type: str  # 'UNDERPRICED_SALE', 'UNTAPPED_REGION', 'HIGH_VALUE_SHIFT'
    severity: str  # 'CRITICAL_OPPORTUNITY', 'INFORMATIONAL'
    headline_text: str
    detailed_explanation: str
    potential_monthly_gain_inr: float
    action_cta: str

# --- Business Intelligence Functions ---

def generate_personalized_business_insights(
    collector_id: UUID
) -> List[BusinessInsight]:
    """
    Synthesizes tailored business coaching tips for the collector.
    """
    pass

def detect_underpriced_sales_history(
    collector_id: UUID,
    variance_threshold_pct: float = 15.0
) -> List[Dict[str, Any]]:
    """
    Detects past transactions where the collector sold > 15% below prevailing market index:
    e.g. 'Last Tuesday you sold SMPS for ₹80/kg when authorized buyers were paying ₹110/kg'.
    """
    pass

def compute_collector_optimal_material_focus(
    collector_id: UUID
) -> Dict[str, Any]:
    """
    Identifies high-value materials with low local competition where collector can specialize.
    """
    pass

def rank_historical_recycler_partners(
    collector_id: UUID
) -> List[Dict[str, Any]]:
    """
    Ranks buyer relationships by dock honesty, zero deductions, and instant payment.
    """
    pass

def identify_most_lucrative_harvest_zones(
    collector_id: UUID
) -> List[Dict[str, Any]]:
    """
    Highlights neighborhoods and industrial estates yielding the highest revenue per collection trip.
    """
    pass

def analyze_collection_seasonality_and_schedule(
    collector_id: UUID
) -> Dict[str, Any]:
    """
    Evaluates weekly schedule efficiency (e.g. collecting on corporate decommission days).
    """
    pass

def generate_unit_economics_audit(
    collector_id: UUID
) -> Dict[str, Any]:
    """
    Audits revenue vs operating costs (fuel, helper wages, tea/food) to compute true net hourly earnings.
    """
    pass

def compare_collector_prices_vs_market_benchmark(
    collector_id: UUID
) -> Dict[str, Any]:
    """
    Benchmarks collector realization against municipal average.
    """
    pass

def generate_actionable_uplift_recommendations(
    collector_id: UUID
) -> List[str]:
    """
    Generates 3 concrete steps to boost income (e.g., 'Separate copper windings before selling transformers').
    """
    pass

def synthesize_business_expansion_playbook(
    collector_id: UUID
) -> Dict[str, Any]:
    """
    Provides roadmap to scale from solo collector to aggregator with a collection vehicle.
    """
    pass
```

### Associated API Routes:
- `GET /api/v1/bi/insights/collector/{id}` - Get personalized business insights
- `GET /api/v1/bi/audits/underpriced-sales` - Underpriced sales history
- `GET /api/v1/bi/benchmarks/regional` - Compare earnings vs regional benchmark

### Database Entities:
`bi_collector_insights`, `underpriced_sale_logs`, `collector_efficiency_metrics`.

---
## 5.19 🚨 Fraud & Anomaly Detection

### Core Features:
- Unusual price detection
- Weight inconsistency detection
- Duplicate lot detection
- Duplicate photo detection
- Suspicious transaction patterns
- Abnormal recycler behaviour
- Abnormal collector behaviour
- Transaction-risk alerts

### Architecture & Service Blueprint:
The Fraud & Anomaly Engine (`backend/fraud`) protects ecosystem integrity against collusion, ghost transactions, perceptual image reuse, and predatory grading practices. It computes real-time transaction risk scores using Isolation Forests, perceptual hashing (pHash), and weight deviation models.

### Typed Function Specifications:

```python
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel

class FraudAlertRecord(BaseModel):
    alert_id: UUID
    transaction_id: Optional[UUID]
    lot_id: Optional[UUID]
    flag_type: str  # 'PHOTO_DUPLICATION', 'WEIGHT_MISMATCH', 'PRICE_SPIKE', 'VELOCITY_ANOMALY'
    risk_score: float  # 0.0 to 1.0
    status: str  # 'OPEN', 'INVESTIGATING', 'CLEARED', 'CONFIRMED_FRAUD'
    details: Dict[str, Any]

# --- Fraud Service Functions ---

def flag_unusual_lot_pricing(
    material_id: UUID,
    quoted_price_per_kg: float,
    regional_avg: float
) -> Optional[FraudAlertRecord]:
    """
    Flags prices deviating by more than 3 standard deviations from market norms.
    """
    pass

def verify_scale_weight_vs_vision_estimate(
    initial_estimate_kg: float,
    verified_scale_kg: float,
    tolerance_pct: float = 25.0
) -> Optional[FraudAlertRecord]:
    """
    Flags gross discrepancies between initial lot volume and dock scale weight
    (detecting phantom weight inflation or dock tampering).
    """
    pass

def detect_duplicate_lot_submissions(
    collector_id: UUID,
    material_category_id: UUID,
    weight_kg: float,
    window_hours: int = 24
) -> Optional[FraudAlertRecord]:
    """
    Flags identical lots submitted repeatedly within a short time window.
    """
    pass

def compute_perceptual_image_hash_match(
    image_bytes: bytes,
    distance_threshold: int = 5
) -> Optional[FraudAlertRecord]:
    """
    Calculates image perceptual hash (dHash/pHash) and checks against Hamming distance index
    to detect recycled scrap photos downloaded from the internet or re-used from previous lots.
    """
    pass

def analyze_transaction_velocity_anomalies(
    collector_id: UUID,
    recycler_id: UUID
) -> Optional[FraudAlertRecord]:
    """
    Detects circular fake trading loops designed to inflate volume for fraudulent EPR certificate generation.
    """
    pass

def flag_recycler_grading_markdown_bias(
    recycler_id: UUID
) -> Optional[FraudAlertRecord]:
    """
    Flags buyers who systematically downgrade material grades upon dock delivery (> 40% downgrade rate).
    """
    pass

def flag_abnormal_collector_volume_spikes(
    collector_id: UUID
) -> Optional[FraudAlertRecord]:
    """
    Detects sudden 10x volume surges that may indicate stolen corporate hardware.
    """
    pass

def emit_transaction_risk_score(
    transaction_id: UUID
) -> float:
    """
    Computes holistic multi-variable risk score prior to releasing payment.
    """
    pass
```

### Associated API Routes:
- `POST /api/v1/fraud/verify-transaction` - Run risk scoring on transaction
- `GET /api/v1/fraud/alerts` - List active fraud alerts for admin review
- `POST /api/v1/fraud/alerts/{id}/resolve` - Resolve and clear or confirm alert

### Database Entities:
`fraud_alerts`, `image_hash_registry`, `fraud_risk_scores`, `audit_investigations`.

---
## 5.20 🤖 AI/ML

### Core Features:
- Image classification
- Material valuation
- Price prediction
- Demand prediction
- Supply estimation
- Recycler recommendation
- Collection opportunity prediction
- Industry-to-e-waste prediction
- Transaction anomaly detection
- Personalised recommendations

### Architecture & Service Blueprint:
The Central AI & Machine Learning Subsystem (`backend/ai/ml`) coordinates training, inference, and model deployment across edge and cloud. It utilizes PyTorch, ONNX Runtime, and MLflow, serving vision classifiers, XGBoost gradient-boosted regressors for dynamic valuation, and contextual multi-armed bandits for collector guidance.

### Typed Function Specifications:

```python
from typing import List, Optional, Dict, Any
from uuid import UUID
import numpy as np
from pydantic import BaseModel

class MLInferenceResult(BaseModel):
    model_name: str
    model_version: str
    inference_latency_ms: float
    predictions: Dict[str, Any]

# --- ML Service Functions ---

def infer_ewaste_categories_cnn(
    image_tensor: Any
) -> Dict[str, float]:
    """
    Executes PyTorch/ONNX inference returning class probability distribution over e-waste categories.
    """
    pass

def predict_lot_fair_market_value(
    feature_vector: List[float]
) -> float:
    """
    Runs XGBoost regression model on material, weight, purity, and location features
    to output expected fair market value in INR.
    """
    pass

def forecast_material_price_time_series(
    material_id: UUID,
    horizon_days: int = 14
) -> List[float]:
    """
    Forecasts daily price trajectory using LightGBM + Prophet commodity features.
    """
    pass

def forecast_recycler_demand_volume(
    region_id: str,
    material_id: UUID
) -> float:
    """
    Predicts expected quarterly industrial e-waste procurement appetite.
    """
    pass

def estimate_latent_e_waste_supply_density(
    h3_index: str
) -> float:
    """
    Calculates unharvested scrap stock using spatial demographic models.
    """
    pass

def rank_recyclers_for_lot_collaborative_filtering(
    collector_id: UUID,
    lot_id: UUID
) -> List[UUID]:
    """
    Applies Matrix Factorization / Two-Tower neural network to match lots with highest-affinity buyers.
    """
    pass

def predict_collection_yield_by_location(
    lat: float,
    lng: float,
    day_of_week: int
) -> Dict[str, float]:
    """
    Predicts probable kg of scrap collected per kilometer traveled in a target zone.
    """
    pass

def infer_scrap_yield_from_industrial_firmographics(
    firm_metadata: Dict[str, Any]
) -> Dict[str, float]:
    """
    Predicts scrap yield based on factory type, employee size, and machinery age.
    """
    pass

def detect_multivariate_transaction_outliers(
    feature_matrix: Any
) -> List[int]:
    """
    Runs Isolation Forest to identify statistically anomalous transactions.
    """
    pass

def generate_contextual_bandit_collector_prompts(
    collector_id: UUID,
    context_vector: List[float]
) -> str:
    """
    Applies Contextual Bandit (LinUCB) to choose the single most impactful recommendation action.
    """
    pass
```

### Associated API Routes:
- `POST /api/v1/ml/inference/classify-image` - Cloud vision inference endpoint
- `POST /api/v1/ml/inference/valuate-lot` - Automated valuation endpoint
- `GET /api/v1/ml/models/metadata` - List active model versions and drift statistics

### Database Entities:
`ml_model_registry`, `ml_feature_store_cache`, `ml_inference_audit_logs`.

---
## 5.21 📡 Offline & Data Synchronisation

### Core Features:
- Offline lot creation
- Offline camera operation
- Offline voice/safety features
- Local data storage
- Sync queue
- Automatic synchronisation
- Conflict handling
- Retry failed synchronisation

### Architecture & Service Blueprint:
The Offline & Synchronization Subsystem (`apps/collector-mobile/src/services/sync` + `backend/sync`) guarantees that informal collectors can create lots, snap photos, record weights, and receive safety warnings even in deep basements or remote industrial yards with zero cellular connectivity. Built on client SQLite (WatermelonDB), client-side UUID generation, vector clocks, idempotency keys, and exponential backoff retry queues.

### Typed Function Specifications:

```python
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel

class SyncQueueItem(BaseModel):
    queue_id: str
    client_mutation_id: UUID
    entity_name: str  # 'lots', 'images', 'weights'
    operation: str    # 'INSERT', 'UPDATE', 'DELETE'
    payload_json: Dict[str, Any]
    created_at_epoch_ms: int
    retry_count: int = 0
    sync_status: str  # 'QUEUED', 'IN_FLIGHT', 'FAILED', 'SYNCED'

class SyncResponsePayload(BaseModel):
    server_timestamp: datetime
    processed_mutation_ids: List[UUID]
    conflict_resolutions: List[Dict[str, Any]]
    downstream_updates: Dict[str, List[Dict[str, Any]]]

# --- Synchronization Functions ---

def create_offline_lot_record(
    local_db_conn: Any,
    lot_payload: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Persists new lot in local SQLite database with client-generated ULID/UUID
    and inserts mutation record into local sync queue.
    """
    pass

def cache_captured_image_locally(
    local_storage_dir: str,
    image_bytes: bytes,
    metadata: Dict[str, Any]
) -> str:
    """
    Saves compressed image to private application file storage, generates local file URI,
    and stages binary upload for network availability.
    """
    pass

def evaluate_offline_safety_rules(
    cached_rules: List[Dict[str, Any]],
    material_code: str
) -> Dict[str, Any]:
    """
    Evaluates rule-engine safety alerts offline using locally bundled JSON database.
    """
    pass

def manage_sqlite_watermark_store(
    last_sync_timestamp: datetime
) -> None:
    """
    Updates local database watermark cursor to ensure delta-only synchronization.
    """
    pass

def enqueue_sync_operation(
    entity: str,
    operation: str,
    payload: Dict[str, Any]
) -> SyncQueueItem:
    """
    Appends pending data change to client FIFO sync queue with SHA-256 idempotency key.
    """
    pass

def trigger_background_sync_pipeline(
    queue_items: List[SyncQueueItem]
) -> SyncResponsePayload:
    """
    Upstream sync endpoint. Processes batched mutations in a single atomic database transaction.
    """
    pass

def resolve_client_server_conflict(
    server_entity: Dict[str, Any],
    client_entity: Dict[str, Any],
    strategy: str = "SERVER_WINS_FOR_VERIFIED_STATUS"
) -> Dict[str, Any]:
    """
    Resolves data discrepancies:
    - If status is WEIGHED/SETTLED on server, server state overrides client draft.
    - If collector edited notes/photos offline, field-level 3-way merge is applied.
    """
    pass

def execute_exponential_backoff_sync_retry(
    failed_items: List[SyncQueueItem]
) -> None:
    """
    Schedules retries using randomized exponential backoff (2s, 4s, 8s... up to 10 min)
    to prevent thundering herd when network reconnects.
    """
    pass
```

### Associated API Routes:
- `POST /api/v1/sync/push` - Push local mutations upstream
- `GET /api/v1/sync/pull` - Pull server deltas since cursor timestamp
- `POST /api/v1/sync/images/upload` - Resumable multipart upload for staged offline photos

### Database Entities:
`sync_mutations_log`, `sync_watermarks`, `sync_conflicts`.

---
## 5.22 🏭 Recycler Interface

### Core Features:
- Recycler registration
- Authorisation verification
- Inventory
- Material requirements
- Demand posting
- Price setting
- Incoming-lot management
- Offer management
- Pickup management
- Weight verification
- Handover confirmation
- Payment management
- Transaction history
- Recycler analytics

### Architecture & Service Blueprint:
The Recycler Portal (`backend/recyclers` + Next.js web application) is the operational dashboard for formal recyclers, smelters, and refurbishers. It enables enterprise buyers to publish purchasing price sheets, configure dock acceptance criteria, manage incoming delivery trucks, certify scale weights, authorize collector digital disbursements, and export EPR compliance audits.

### Typed Function Specifications:

```python
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, date
from pydantic import BaseModel

class RecyclerInventoryItem(BaseModel):
    material_category_id: UUID
    material_name: str
    in_stock_weight_kg: float
    quarantine_weight_kg: float
    processed_weight_kg: float
    average_procurement_cost_per_kg: float

# --- Recycler Interface Functions ---

def register_recycler_entity(
    registration_payload: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Registers recycling enterprise: GSTIN, corporate incorporation, and facility addresses.
    """
    pass

def validate_regulatory_authorizations(
    recycler_id: UUID,
    cpcb_license_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Audits authorized processing capacity and validity dates from pollution control boards.
    """
    pass

def get_recycler_warehouse_inventory(
    recycler_id: UUID
) -> List[RecyclerInventoryItem]:
    """
    Returns warehouse stock levels across all segregated e-waste bins.
    """
    pass

def configure_facility_material_acceptance_rules(
    recycler_id: UUID,
    rules: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Configures acceptance thresholds, moisture tolerance, and prohibited contaminant penalties.
    """
    pass

def publish_facility_procurement_demand(
    recycler_id: UUID,
    demand_spec: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Publishes procurement quota to the Reverse Marketplace.
    """
    pass

def update_recycler_rate_card(
    recycler_id: UUID,
    price_table: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Updates daily factory-gate scrap buying prices.
    """
    pass

def list_inbound_expected_lots(
    recycler_id: UUID,
    date_window: date
) -> List[Dict[str, Any]]:
    """
    Lists scheduled shipments and self-dropoff passes expected at facility gates.
    """
    pass

def submit_recycler_quote_on_lot(
    recycler_id: UUID,
    lot_id: UUID,
    quote_details: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Submits binding purchase offer on a listed collector lot.
    """
    pass

def dispatch_facility_pickup_truck(
    pickup_id: UUID,
    driver_id: UUID,
    truck_id: str
) -> Dict[str, Any]:
    """
    Dispatches logistics fleet vehicle for doorstep collection.
    """
    pass

def certify_incoming_weight_on_dock(
    lot_id: UUID,
    dock_scale_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Certifies incoming gross, tare, and net weights with digital scale ticket.
    """
    pass

def acknowledge_dock_handover(
    handover_id: UUID,
    pin_verification: str
) -> Dict[str, Any]:
    """
    Completes legal transfer of scrap lot custody from collector to facility.
    """
    pass

def approve_and_release_collector_payment(
    transaction_id: UUID,
    approver_user_id: UUID
) -> Dict[str, Any]:
    """
    Releases payment escrow for instantaneous UPI or IMPS disbursement to collector.
    """
    pass

def query_facility_procurement_history(
    recycler_id: UUID,
    start_date: date,
    end_date: date
) -> Dict[str, Any]:
    """
    Fetches historical purchases for internal ERP integration and tax filing.
    """
    pass

def get_facility_processing_throughput_analytics(
    recycler_id: UUID,
    timeframe: str
) -> Dict[str, Any]:
    """
    Measures facility turnaround time, dismantling yield, and collector retention.
    """
    pass
```

### Associated API Routes:
- `POST /api/v1/recycler/rate-card` - Publish factory-gate prices
- `GET /api/v1/recycler/inbound-queue` - Live view of expected shipments
- `POST /api/v1/recycler/dock/certify-weight` - Submit dock scale certificate
- `POST /api/v1/recycler/payments/authorize` - Authorize instant collector payment

### Database Entities:
`recycler_facilities`, `recycler_inventories`, `facility_rate_cards`, `inbound_shipment_manifests`.

---
## 5.23 🏛️ Admin / Authority Dashboard

### Core Features:
- Collector management
- Recycler management
- Authorisation monitoring
- Regional e-waste analytics
- Material-flow analytics
- Price analytics
- Formal-recycling participation
- Transaction monitoring
- Anomaly monitoring
- Geographic hotspots
- Recycling reports

### Architecture & Service Blueprint:
The Admin & Regulatory Dashboard (`backend/admin` + Next.js web application) provides state environmental authorities (SPCBs/CPCB), municipal corporations, and platform administrators with macro-level oversight. It provides real-time e-waste mass balances, verifies formalization rates (informal scrap pickers transitioning to formal digital supply chains), monitors hazardous incident flags, and exports automated EPR audit reports.

### Typed Function Specifications:

```python
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import date
from pydantic import BaseModel

class RegionalMassBalance(BaseModel):
    region_code: str
    reporting_period: str
    total_ewaste_collected_mt: float
    total_formally_recycled_mt: float
    informal_to_formal_conversion_pct: float
    hazardous_materials_safely_diverted_kg: float

# --- Admin Service Functions ---

def admin_list_and_filter_collectors(
    filters: Dict[str, Any],
    page: int = 1,
    limit: int = 50
) -> Dict[str, Any]:
    """
    Lists collectors with KYC status, operating territories, and total formal volumes.
    """
    pass

def admin_list_and_audit_recyclers(
    filters: Dict[str, Any],
    page: int = 1,
    limit: int = 50
) -> Dict[str, Any]:
    """
    Audits recycler licenses, processing capacities, and compliance infractions.
    """
    pass

def track_expiring_cpcb_licenses(
    warning_threshold_days: int = 30
) -> List[Dict[str, Any]]:
    """
    Flags recycling facilities whose statutory pollution control clearances expire soon.
    """
    pass

def aggregate_regional_ewaste_mass_balance(
    region_code: str,
    start_date: date,
    end_date: date
) -> RegionalMassBalance:
    """
    Calculates macro material balance: Total Input vs Material Salvaged vs Residue Disposed.
    """
    pass

def trace_sankey_material_flows(
    source_region: str,
    start_date: date,
    end_date: date
) -> Dict[str, Any]:
    """
    Generates Sankey diagram data showing flow of e-waste from collector wards
    to aggregators, formal dismantlers, and final smelters.
    """
    pass

def monitor_cross_regional_price_disparities(
    material_category_id: UUID
) -> Dict[str, Any]:
    """
    Monitors inter-state scrap price variations to identify illegal interstate smuggling.
    """
    pass

def calculate_formalization_transition_rate(
    start_date: date,
    end_date: date
) -> Dict[str, Any]:
    """
    Measures how many informal waste pickers have opened bank accounts, registered on platform,
    and diverted scrap from illegal open-burning to authorized recyclers.
    """
    pass

def stream_live_ecosystem_transactions(
    criteria: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    Live transaction feed across all city nodes.
    """
    pass

def stream_flagged_fraud_incidents(
    severity_filter: str = "HIGH"
) -> List[Dict[str, Any]]:
    """
    Real-time feed of anomalous price or weight alerts for regulatory intervention.
    """
    pass

def query_hotspot_geometries_geojson(
    jurisdiction_code: str
) -> Dict[str, Any]:
    """
    Returns geographic boundaries of municipal e-waste generation clusters.
    """
    pass

def generate_epr_compliance_audit_report(
    recycler_id: UUID,
    reporting_year: int
) -> Dict[str, Any]:
    """
    Compiles official Government EPR compliance certificate documenting verifiable tons
    procured from informal collectors with complete KYC and GPS traceability.
    """
    pass
```

### Associated API Routes:
- `GET /api/v1/admin/analytics/mass-balance` - Regional e-waste mass balance
- `GET /api/v1/admin/analytics/sankey-flows` - Sankey material flow visualization
- `GET /api/v1/admin/compliance/epr-reports/{year}` - Generate formal EPR certificate
- `GET /api/v1/admin/monitoring/anomalies` - Active regulatory anomaly stream

### Database Entities:
`admin_audit_logs`, `regulatory_epr_certificates`, `municipal_mass_balances`.

---
## 5.24 🗄️ Data Platform

### Core Features:
- Material dataset
- Image dataset
- Price dataset
- Transaction dataset
- Recycler dataset
- Collector dataset
- Demand dataset
- Regional industry dataset
- Historical market dataset
- Data cleaning
- Data validation
- Data anonymisation
- Dataset updating

### Architecture & Service Blueprint:
The Data Platform (`backend/data`) manages the enterprise lakehouse architecture (built on PostgreSQL, Apache Iceberg / S3 Parquet, and DuckDB). It maintains master reference datasets, coordinates automated ELT pipelines, strips personally identifiable information (PII) to protect informal workers, and powers downstream machine learning feature stores.

### Typed Function Specifications:

```python
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, date
from pydantic import BaseModel

class DatasetSyncReport(BaseModel):
    dataset_name: str
    records_processed: int
    records_updated: int
    validation_errors: int
    execution_time_seconds: float
    completed_at: datetime

# --- Data Platform Functions ---

def sync_material_taxonomy_master_dataset() -> DatasetSyncReport:
    """
    Synchronizes master catalog of e-waste materials, component breakdowns,
    and dangerous substance definitions with official regulatory gazettes.
    """
    pass

def ingest_annotated_lot_vision_dataset(
    image_s3_paths: List[str],
    ground_truth_labels: List[Dict[str, Any]]
) -> DatasetSyncReport:
    """
    Ingests collector-verified photos into the training lakehouse for CV retraining.
    """
    pass

def aggregate_daily_market_price_snapshots() -> DatasetSyncReport:
    """
    Compiles daily snapshots of domestic and international commodity prices.
    """
    pass

def build_partitioned_transaction_lakehouse_table(
    partition_date: date
) -> DatasetSyncReport:
    """
    Partitions raw transactions into Parquet format on object storage partitioned by (year, month, region).
    """
    pass

def maintain_verified_recycler_directory_view() -> DatasetSyncReport:
    """
    Maintains clean, query-optimized materialized view of authorized recycling facilities.
    """
    pass

def maintain_collector_demographics_and_metrics_view() -> DatasetSyncReport:
    """
    Refreshes analytical aggregates for collector cohort analysis and churn modeling.
    """
    pass

def maintain_historical_procurement_demand_ledger() -> DatasetSyncReport:
    """
    Archives fulfilled and expired demands for demand-forecasting models.
    """
    pass

def enrich_industrial_cluster_firmographic_layer() -> DatasetSyncReport:
    """
    Updates spatial geometries of industrial parks with new corporate filings and factory openings.
    """
    pass

def compile_macro_secondary_metal_indices() -> DatasetSyncReport:
    """
    Ingests and normalizes external price feeds (LME Copper, MCX, ScrapMonster).
    """
    pass

def run_data_hygiene_and_deduplication_jobs() -> DatasetSyncReport:
    """
    Executes automated data cleansing, deduplicating identical lots and removing corrupted sensor readings.
    """
    pass

def validate_schema_and_integrity_constraints() -> Dict[str, Any]:
    """
    Runs Great Expectations / Pydantic schema validation suites against raw data pipelines.
    """
    pass

def mask_personally_identifiable_collector_telemetry(
    raw_records: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Strips collector phone numbers, names, and exact home GPS coordinates prior to lakehouse export;
    replaces with irreversible pseudo-anonymous tokens and H3 resolution-7 centroids.
    """
    pass

def schedule_automated_feature_store_updates() -> DatasetSyncReport:
    """
    Refreshes Feast / Hopsworks ML feature store entities for real-time model inference.
    """
    pass
```

### Associated API & CLI Commands:
- `POST /api/v1/data-platform/pipelines/run-hygiene` - Trigger data hygiene job
- `POST /api/v1/data-platform/pipelines/sync-metal-indices` - Refresh commodity feeds
- `GET /api/v1/data-platform/datasets/health` - Check health of all managed datasets

### Database Entities:
`data_pipeline_runs`, `dataset_version_registry`, `anonymization_audit_ledger`.

---
## 5.25 🔁 Core Entrepreneurial Loop

### Core Features:
- End-to-end execution of the primary value-creation cycle:
  **Regional Intelligence → Opportunity Prediction → Collection → Camera Identification → Valuation → Price Intelligence → Recycler Demand → Smart Matching → Aggregation → Sale → Traceable Handover → Payment → Earnings Analytics → Better Future Collection Decisions**
- Orchestration and state management across all 14 lifecycle steps
- Autonomous event-driven transitions
- Reinforcement feedback loop for collector decision enhancement

### Architecture & Service Blueprint:
The Core Entrepreneurial Loop Orchestrator (`backend/engine/loop`) ties together all 24 individual modules into an automated, self-reinforcing flywheel. When an informal collector turns on the mobile app in the morning, the system identifies regional collection opportunities, guides the collector along high-yield routes, identifies and grades e-waste via camera, benchmarks prices, matches buyer demand, guarantees certified handover and instant digital payment, and updates the collector's business intelligence dashboard to ensure smarter future collection decisions.

```text
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                      THE CORE ENTREPRENEURIAL LOOP                          │
  └─────────────────────────────────────────────────────────────────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
   1. Regional Intelligence                             2. Opportunity Prediction
   (Map clusters, factories, scrap density)             (What should I collect today?)
            │                                                     │
            └──────────────────────────┬──────────────────────────┘
                                       ▼
                             3. Collection Activity
                             (Collector traverses route & collects scrap)
                                       │
                                       ▼
                          4. Camera AI Identification
                          (YOLO detection, OCR, quality & hazard analysis)
                                       │
                                       ▼
                             5. Material Valuation
                             (Calculate fair market value based on purity)
                                       │
                                       ▼
                           6. Price Intelligence Check
                           (Compare spot rates vs historical trends)
                                       │
                                       ▼
                           7. Recycler Demand Matching
                           (Scan urgent procurement orders)
                                       │
                                       ▼
                            8. Smart Matching Engine
                            (Maximize NET earnings: Gross price minus transport)
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
   9. Aggregation & Pooling (Optional)                 10. Sale Commitment
   (Combine with peers for bulk bonus)                 (Lock contract price & dispatch)
            │                                                     │
            └──────────────────────────┬──────────────────────────┘
                                       ▼
                         11. Traceable Digital Handover
                         (Dock weighing, GPS geofence, tamper-evident receipt)
                                       │
                                       ▼
                        12. Instant Digital Payment
                        (Instant UPI / IMPS payout to collector)
                                       │
                                       ▼
                       13. Earnings & Dashboard Update
                       (Real-time net profit ledger, volume KPIs)
                                       │
                                       ▼
                   14. Reinforcement Loop for Future Decisions
                   (System adapts weights: higher collector income next time)
```

### Typed Function Specifications:

```python
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field

class EntrepreneurialLoopContext(BaseModel):
    cycle_id: UUID
    collector_id: UUID
    start_gps: Tuple[float, float]
    active_lot_id: Optional[UUID] = None
    identified_category_id: Optional[UUID] = None
    estimated_weight_kg: float = 0.0
    certified_weight_kg: float = 0.0
    recommended_recycler_id: Optional[UUID] = None
    agreed_sale_price_inr: float = 0.0
    net_profit_earned_inr: float = 0.0
    current_step: int = Field(default=1, ge=1, le=14)
    status: str = "IN_PROGRESS"

# --- Complete Loop Orchestration Functions ---

def execute_core_entrepreneurial_cycle(
    collector_id: UUID,
    current_lat: float,
    current_lng: float
) -> EntrepreneurialLoopContext:
    """
    Master Orchestration Function.
    Executes and coordinates the end-to-end 14-stage entrepreneurial lifecycle.
    Persists loop state transitions and ensures data consistency across all services.
    """
    pass

def step_1_query_regional_intelligence(
    lat: float,
    lng: float,
    radius_km: float = 10.0
) -> Dict[str, Any]:
    """
    Step 1: Scans regional e-waste density, nearby industrial clusters, and active scrap hotspots.
    """
    pass

def step_2_predict_collector_opportunities(
    collector_id: UUID,
    regional_context: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    Step 2: Predicts highest net-profit collection target ('Collect 20kg SMPS at MIDC Area today').
    """
    pass

def step_3_initiate_collection_activity(
    collector_id: UUID,
    chosen_opportunity_id: UUID
) -> UUID:
    """
    Step 3: Opens active collection trip, tracks waypoints, and records collected physical scrap.
    """
    pass

def step_4_camera_ai_identification(
    lot_photo_bytes: bytes,
    collector_id: UUID
) -> Dict[str, Any]:
    """
    Step 4: AI Vision captures image, identifies components, grades purity, and checks hazards.
    """
    pass

def step_5_material_fair_valuation(
    category_id: UUID,
    quality_grade: str,
    estimated_weight_kg: float
) -> Dict[str, float]:
    """
    Step 5: Computes fair baseline market value based on intrinsic secondary metal recovery yields.
    """
    pass

def step_6_fetch_price_intelligence_benchmarks(
    category_id: UUID,
    location_coords: Tuple[float, float]
) -> Dict[str, Any]:
    """
    Step 6: Retrieves real-time local price spread, price trends, and commodity benchmarks.
    """
    pass

def step_7_match_active_recycler_demands(
    category_id: UUID,
    weight_kg: float
) -> List[Dict[str, Any]]:
    """
    Step 7: Scans reverse marketplace for matching industrial recycler procurement demands.
    """
    pass

def step_8_compute_smart_matching_recommendation(
    lot_id: UUID,
    collector_id: UUID
) -> Dict[str, Any]:
    """
    Step 8: Runs smart matching algorithm to select the buyer yielding highest net earnings
    after subtracting transport costs and applying reliability scores.
    """
    pass

def step_9_evaluate_bulk_aggregation(
    lot_id: UUID,
    nearby_hubs: List[UUID]
) -> Optional[Dict[str, Any]]:
    """
    Step 9: Checks if combining lot with nearby peer lots unlocks higher bulk pricing tier.
    """
    pass

def step_10_finalize_sale_commitment(
    lot_id: UUID,
    buyer_id: UUID,
    agreed_terms: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Step 10: Locks binding digital sale contract and schedules doorstep pickup or dock drop-off.
    """
    pass

def step_11_execute_traceable_handover(
    sale_id: UUID,
    dock_scale_weight_kg: float,
    verification_pin: str
) -> Dict[str, Any]:
    """
    Step 11: Performs digital handover on facility dock with calibrated scale reading,
    geofence validation, and EPR manifest minting.
    """
    pass

def step_12_disburse_digital_payment(
    handover_manifest_id: UUID,
    payout_channel: str = "UPI"
) -> Dict[str, Any]:
    """
    Step 12: Executes instant digital settlement (UPI/bank transfer) directly to collector.
    """
    pass

def step_13_update_collector_earnings_dashboard(
    collector_id: UUID,
    completed_transaction_id: UUID
) -> Dict[str, Any]:
    """
    Step 13: Updates real-time entrepreneur ledger, cumulative volume, and profit metrics.
    """
    pass

def step_14_reinforce_future_collection_models(
    collector_id: UUID,
    cycle_history: EntrepreneurialLoopContext
) -> bool:
    """
    Step 14: Feeds realized transaction economics back into the ML opportunity engine
    so the system learns which recommendations generate the highest real-world net profits.
    """
    pass
```

### Associated API Routes:
- `POST /api/v1/loop/start` - Initiate new entrepreneurial loop cycle
- `GET /api/v1/loop/{cycle_id}/state` - Get active state and next recommended action
- `POST /api/v1/loop/{cycle_id}/advance` - Advance loop to next lifecycle stage
- `POST /api/v1/loop/{cycle_id}/complete` - Finalize loop and trigger model reinforcement

### Database Entities:
`entrepreneurial_cycles`, `cycle_step_transitions`, `reinforcement_feedback_records`.

---
# 6. Recommended Technology Stack

## 6.1 Frontend

### Collector App

**Recommended: React Native + TypeScript**

Reasons:

- Android-first
- single codebase
- strong UI control
- offline support
- camera integration
- speech integration
- multilingual support

Alternative:

- Kotlin + Jetpack Compose if Android-only development is preferred.

### Recycler/Admin Web

Recommended:

- Next.js
- React
- TypeScript
- Tailwind CSS
- MapLibre GL JS

---

## 6.2 Backend

Recommended:

- Python
- FastAPI
- Pydantic
- SQLAlchemy
- Celery for background jobs
- Redis

Alternative enterprise stack:

- Node.js + NestJS

Python is preferable because the platform has significant AI/ML and data-processing requirements.

---

## 6.3 Database

Primary transactional database:

**PostgreSQL**

Extensions:

- PostGIS
- pgvector where appropriate

Use PostgreSQL for:

- users
- collectors
- recyclers
- materials
- lots
- offers
- demands
- transactions
- payments
- locations
- events

---

## 6.4 Cache / Queue

**Redis**

Use for:

- caching
- rate limiting
- temporary sessions
- job queues
- recommendation caching
- frequently accessed market data

For larger scale:

- Apache Kafka / Redpanda for event streaming.

Do not introduce Kafka on day one unless actual traffic requires it.

---

## 6.5 Object Storage

Use:

- Amazon S3
- Cloudflare R2
- Google Cloud Storage
- Azure Blob Storage

Store:

- e-waste photos
- receipts
- verification documents
- model artefacts
- generated reports

Do not store large images directly inside PostgreSQL.

---

## 6.6 AI/ML

Recommended:

```text
Python
├── PyTorch
├── OpenCV
├── Ultralytics YOLO
├── scikit-learn
├── pandas
├── NumPy
├── MLflow
└── ONNX Runtime
```

Potential models:

| Problem | Candidate Approach |
|---|---|
| Object detection | YOLO |
| Material classification | CNN / ViT |
| OCR | PaddleOCR |
| Price prediction | XGBoost / LightGBM |
| Demand prediction | XGBoost / temporal models |
| Opportunity scoring | Gradient boosting + rules |
| Anomaly detection | Isolation Forest |
| Recommendation | Hybrid recommender |
| Image duplicate detection | Perceptual hash + embeddings |
| Geospatial clustering | H3 + clustering |

---

## 6.7 Maps & GIS

Recommended:

- PostGIS
- OpenStreetMap
- MapLibre
- H3
- routing engine such as OSRM/GraphHopper

Potential commercial alternative:

- Mapbox

---

## 6.8 Authentication

Recommended:

- OAuth 2.0 / OpenID Connect
- JWT access tokens
- refresh-token rotation
- OTP login where legally and operationally appropriate

Roles:

```text
COLLECTOR
RECYCLER
AGGREGATOR
ADMIN
AUTHORITY
SUPPORT
```

---

## 6.9 Notifications

Channels:

- push notifications
- SMS
- WhatsApp where appropriate
- in-app notifications
- voice notifications

Events:

```text
New recycler demand
Offer received
Offer expiring
Pickup scheduled
Payment received
Payment delayed
Safety alert
Price opportunity
```

---

## 6.10 Payments

For an India-first deployment:

- UPI-compatible payment gateway/provider
- bank transfer
- cash recording

Use a payment provider rather than implementing payment rails yourself.

---

## 6.11 DevOps / Cloud

Recommended initial stack:

```text
GitHub
   ↓
GitHub Actions
   ↓
Docker
   ↓
Cloud deployment

Production:
- AWS / GCP / Azure
- Managed PostgreSQL
- Managed Redis
- Object Storage
- Container platform
- Monitoring
```

Possible AWS architecture:

```text
CloudFront
    ↓
API Gateway / Load Balancer
    ↓
ECS / EKS
    ├── FastAPI
    ├── Worker
    └── ML inference
    ↓
RDS PostgreSQL + PostGIS
    ↓
ElastiCache Redis
    ↓
S3
```

For a student/MVP deployment, a much simpler stack is preferable:

```text
React Native + TypeScript
+
FastAPI
+
PostgreSQL/PostGIS
+
Redis
+
S3-compatible storage
+
Docker
+
GitHub Actions
```

---

# 7. High-Level System Architecture

```text
                         ┌─────────────────────┐
                         │     Collector App   │
                         │ React Native + TypeScript / Android   │
                         └──────────┬──────────┘
                                    │
                         ┌──────────▼──────────┐
                         │      API Gateway    │
                         └──────────┬──────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
      ┌───────▼───────┐     ┌──────▼───────┐     ┌──────▼───────┐
      │ Auth Service   │     │ Core Backend │     │ AI Gateway   │
      └───────────────┘     └──────┬───────┘     └──────┬───────┘
                                    │                    │
                   ┌────────────────┼────────────┐       │
                   │                │            │       │
             ┌─────▼─────┐   ┌──────▼─────┐ ┌────▼────┐ │
             │ PostgreSQL│   │   Redis     │ │ Object  │ │
             │ + PostGIS │   │             │ │ Storage │ │
             └───────────┘   └─────────────┘ └─────────┘ │
                                                         │
                                                ┌────────▼────────┐
                                                │ ML Inference     │
                                                │ Vision / Pricing │
                                                │ Demand / Risk    │
                                                └─────────────────┘
```

---

# 8. Backend Service Architecture

For the first release, use a **modular monolith**, not dozens of microservices.

Suggested modules:

```text
backend/
├── auth/                 # Collector & Recycler JWT/OAuth2 & OTP
├── collectors/           # Collector profile, territory, reputation
├── mobile/               # Mobile session, telemetry, low-literacy configs
├── vision/               # Camera inference, YOLO detection, OCR, hazards
├── voice/                # Indic Whisper ASR, TTS, voice intents
├── lots/                 # Material lot management & audit lifecycle
├── regional/             # GIS, H3 hexagonal density, industrial clusters
├── pricing/              # Spot rates, dynamic valuation, metal indices
├── opportunities/        # "What should I collect?", hold vs sell
├── recyclers/            # Authorized recycler marketplace & directory
├── demands/              # Reverse marketplace procurement orders
├── aggregation/          # Micro-lot pooling & collective selling
├── matching/             # Smart matching & net-earnings optimization
├── logistics/            # Pickup routing, OSRM distance, dispatch
├── handover/             # Digital handover, scale tickets, EPR manifests
├── payments/             # Instant UPI payouts, IMPS, cash tracking
├── safety/               # Hazard alerts, pictorial & voice SOPs
├── analytics/            # Entrepreneur daily/weekly ledger & volume KPIs
├── bi/                   # Underpriced sale detection, mentor insights
├── fraud/                # Duplicate pHash check, scale weight verification
├── ml/                   # Model registry, feature store, inference server
├── sync/                 # Offline synchronization, conflict resolution
├── recycler_portal/      # Recycler dock ops, inventory, ERP sync
├── admin/                # Regulatory SPCB/CPCB mass balance, audit reports
├── data_platform/        # Iceberg/DuckDB lakehouse, PII anonymization
└── loop_orchestrator/    # Core 14-step entrepreneurial loop pipeline
```

As scale grows, independently extract high-load components:

```text
Core API
   ├── Matching Service
   ├── Pricing Service
   ├── ML Inference Service
   ├── Notification Service
   ├── Logistics Service
   └── Analytics Pipeline
```

---

# 9. Core Data Model

## 9.1 User

```text
User
- id
- role
- name
- phone
- language
- verification_status
- created_at
- updated_at
```

## 9.2 Collector

```text
Collector
- id
- user_id
- operating_area
- collection_radius
- material_expertise
- reputation_score
- total_volume
- total_earnings
```

## 9.3 Recycler

```text
Recycler
- id
- organisation_name
- verification_status
- authorisation_data
- operating_area
- pickup_radius
- reliability_score
- payment_reliability
```

## 9.4 Material

```text
Material
- id
- category
- subtype
- hazard_class
- base_unit
- recyclable_components
```

## 9.5 Lot

```text
Lot
- id
- collector_id
- material_id
- quantity
- estimated_weight
- final_weight
- quality
- location
- created_at
- status
```

## 9.6 Lot Image

```text
LotImage
- id
- lot_id
- storage_url
- image_hash
- ai_result
- confidence
```

## 9.7 Offer

```text
Offer
- id
- recycler_id
- material_id
- price_per_unit
- min_quantity
- max_quantity
- quality_requirement
- expires_at
```

## 9.8 Demand

```text
Demand
- id
- recycler_id
- material_id
- required_quantity
- quality_requirement
- offered_price
- deadline
- status
```

## 9.9 Transaction

```text
Transaction
- id
- lot_id
- collector_id
- recycler_id
- final_weight
- final_price
- gross_amount
- transport_cost
- fees
- net_amount
- status
```

## 9.10 Payment

```text
Payment
- id
- transaction_id
- method
- amount
- provider_reference
- status
- paid_at
```

## 9.11 Event

```text
Event
- id
- entity_type
- entity_id
- event_type
- actor_id
- payload
- timestamp
- idempotency_key
```

---

# 10. API Architecture

Use REST for the primary application API.

Example endpoints:

```text
POST   /auth/login
POST   /auth/verify

GET    /collector/profile
PATCH  /collector/profile

POST   /lots
GET    /lots
GET    /lots/{id}
PATCH  /lots/{id}

POST   /lots/{id}/images
POST   /ai/classify
POST   /ai/valuate

GET    /prices
GET    /prices/trends
GET    /opportunities
GET    /opportunities/materials

GET    /recyclers
GET    /recyclers/{id}
GET    /recyclers/{id}/offers

GET    /demands
POST   /demands
POST   /demands/{id}/match

POST   /matching/recommend
POST   /pickup
PATCH  /pickup/{id}

POST   /handover
POST   /handover/{id}/confirm

POST   /payments
GET    /payments/{id}

GET    /analytics/earnings
GET    /analytics/materials
GET    /analytics/recyclers
```

For mobile synchronisation:

```text
POST /sync/push
GET  /sync/pull?cursor=...
```

Every mutation should support an idempotency key.

---

# 11. Core Entrepreneurial Engine

The central recommendation pipeline:

```text
Regional Data
     ↓
Potential Material Supply
     ↓
Recycler Demand
     ↓
Current Prices
     ↓
Historical Prices
     ↓
Transport Cost
     ↓
Collector Capability
     ↓
Risk
     ↓
Opportunity Score
     ↓
Recommended Collection
```

Example:

```text
Collector location:
Industrial Zone A

System detects:
- electronics businesses nearby
- high copper demand
- increasing copper price
- nearby recycler with active demand
- low transport cost

Recommendation:
"Prioritise copper cable collection this week."

Estimated:
Gross value: ₹X
Transport: ₹Y
Expected net earning: ₹Z
```

---

# 12. AI Architecture

## 12.1 Vision Model

Input:

```text
Photo
```

Output:

```text
Objects
Material
Condition
Hazard
OCR
Confidence
```

## 12.2 Pricing Model

Input:

```text
Material
Quality
Weight
Region
Recycler
Demand
Historical price
```

Output:

```text
Estimated market price
Confidence interval
```

## 12.3 Demand Model

Input:

```text
Historical purchases
Recycler demand
Seasonality
Region
Material
Price
```

Output:

```text
Expected demand
```

## 12.4 Opportunity Model

Input:

```text
Supply
Demand
Price
Trend
Distance
Transport
Risk
Collector history
```

Output:

```text
Opportunity Score
Expected Net Earning
Recommendation
```

---

# 13. Recommendation Engine

The system should support three recommendation levels.

## Level 1 — Rule-Based MVP

```text
if demand_high
and price_good
and transport_low:
    recommend
```

Advantages:

- easy to explain,
- easy to debug,
- requires little data.

## Level 2 — ML-Assisted

Use historical transactions to learn:

```text
expected_profit = f(material, region, buyer, quantity, quality, time)
```

## Level 3 — Personalised Intelligence

Learn the collector's actual business patterns:

```text
collector-specific conversion rate
collector-specific collection volume
collector-specific preferred materials
collector-specific recycler success
collector-specific travel cost
```

The recommendation system should explain its reasoning rather than output an unexplained score.

---

# 14. Security Architecture

## Authentication

- secure password/OTP handling
- token expiration
- refresh-token rotation
- device/session management

## Authorisation

Use RBAC:

```text
Collector → own lots / own transactions
Recycler → own offers / own demands / assigned lots
Admin → ecosystem-level access
Authority → approved reporting datasets
```

## Data Security

- TLS everywhere
- encryption at rest
- secure object storage
- secrets manager
- database backups
- audit logging

## Privacy

Collect only information required for:

- identity,
- transaction processing,
- safety,
- logistics,
- analytics.

Location should be minimised and protected. Do not expose a collector's exact location publicly.

---

# 15. Fraud Prevention

## Duplicate Lots

Use:

- lot metadata similarity
- image perceptual hashing
- image embeddings
- time/location patterns

## Weight Fraud

Compare:

```text
Collector estimated weight
vs
Recycler final weight
```

Repeated large discrepancies should generate an anomaly signal.

## Price Manipulation

Detect:

```text
Recycler offer
vs
regional verified range
```

## Behavioural Anomaly

Example:

```text
Normal:
10 transactions/month

Sudden:
300 transactions/day

→ Review
```

Anomaly detection should be a risk signal, not an automatic punishment mechanism.

---

# 16. Traceability Model

Each physical material flow receives a digital identity.

```text
Collection
   ↓
Lot ID
   ↓
Images
   ↓
Material classification
   ↓
Weight
   ↓
Offer
   ↓
Match
   ↓
Pickup
   ↓
Handover
   ↓
Final weight
   ↓
Final price
   ↓
Payment
```

The Lot ID remains linked to all downstream events.

For aggregated lots:

```text
L001 ─┐
L002 ─┼──► AGG-001 ───► Transaction T001
L003 ─┘
```

Ownership remains linked through the aggregation record.

---

# 17. Event-Driven Architecture

Important business events:

```text
CollectorRegistered
LotCreated
LotIdentified
MaterialCorrected
OfferCreated
DemandCreated
MatchCreated
PickupScheduled
PickupCompleted
HandoverStarted
WeightConfirmed
SaleCompleted
PaymentInitiated
PaymentCompleted
AnomalyDetected
```

Events can power:

- notifications,
- analytics,
- audit trails,
- recommendation updates,
- ML training datasets.

---

# 18. Offline-First Design

## Local Data

Store locally:

- collector profile subset
- active lots
- material reference data
- safety guides
- pending transactions
- sync queue

## Sync Strategy

```text
Local mutation
    ↓
Write local DB
    ↓
Create Sync Event
    ↓
Network available
    ↓
Upload
    ↓
Server validates
    ↓
Server ACK
    ↓
Mark synced
```

## Conflict Resolution

For simple fields:

```text
last-write-wins
```

For financial state:

```text
server-authoritative
```

For event histories:

```text
append-only
```

---

# 19. Data Pipeline

```text
Mobile App
   ↓
API
   ↓
PostgreSQL
   ↓
CDC / Scheduled Export
   ↓
Object Storage
   ↓
Data Processing
   ↓
Analytics DB / Warehouse
   ↓
ML Training
   ↓
Model Registry
   ↓
Inference API
```

Data quality checks:

- missing values
- impossible weights
- invalid prices
- duplicate transactions
- invalid coordinates
- stale recycler information
- inconsistent material categories

---

# 20. Observability

Use:

- structured application logs
- metrics
- distributed tracing
- error monitoring
- ML monitoring

Track:

```text
API latency
API error rate
sync failure rate
AI inference latency
AI confidence
payment failure rate
matching success rate
pickup completion rate
transaction completion rate
```

ML-specific:

```text
model accuracy
confidence distribution
data drift
concept drift
false positive rate
false negative rate
```

Potential tools:

- OpenTelemetry
- Prometheus
- Grafana
- Sentry
- cloud-native monitoring

---

# 21. Testing Strategy

## Unit Testing

Test:

- price calculations
- net earning calculations
- state transitions
- matching scores
- permission rules
- payment states

## Integration Testing

Test:

```text
Lot creation
→ AI classification
→ offer matching
→ pickup
→ handover
→ payment
```

## ML Testing

Test:

- classification accuracy
- precision
- recall
- confusion matrix
- confidence calibration

## Mobile Testing

Test:

- offline mode
- poor connectivity
- low-end Android devices
- camera permissions
- microphone permissions
- multilingual UI
- sync recovery

---

# 22. Non-Functional Requirements

## Performance

Target:

- normal API response: < 500 ms where practical
- database queries: < 200 ms for common operations
- image inference: near-real-time where device/cloud capacity allows
- sync should tolerate intermittent connectivity

These are targets, not guarantees; benchmark on actual deployment hardware.

## Availability

Initial target:

```text
99%+
```

Production target can increase as infrastructure matures.

## Scalability

Architecture should support:

```text
10,000 collectors
→ 100,000 collectors
→ 1,000,000+ collectors
```

without redesigning the entire domain model.

---

# 23. MVP Scope

Do not build all 25 categories at once.

## Phase 1 — Functional MVP

Build:

1. Collector registration
2. Collector profile
3. Material catalogue
4. Camera upload
5. Basic AI classification
6. Manual correction
7. Lot creation
8. Price lookup
9. Recycler discovery
10. Recycler offers
11. Basic matching
12. Digital transaction record
13. Payment status
14. Earnings dashboard
15. Offline lot creation
16. Hindi/English support

## Phase 2 — Intelligence

Add:

- demand marketplace
- opportunity engine
- regional maps
- price prediction
- demand prediction
- personalised recommendations
- logistics optimisation
- voice interface

## Phase 3 — Ecosystem

Add:

- aggregation
- bulk selling
- authority dashboard
- advanced anomaly detection
- industry-to-e-waste prediction
- advanced analytics
- formal recycling analytics

---

# 24. Suggested Repository Structure

```text
kabadiwala-platform/
│
├── apps/
│   ├── collector-mobile/
│   ├── recycler-web/
│   └── admin-web/
│
├── backend/
│   ├── app/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── collectors/
│   │   ├── recyclers/
│   │   ├── materials/
│   │   ├── lots/
│   │   ├── marketplace/
│   │   ├── matching/
│   │   ├── pricing/
│   │   ├── opportunities/
│   │   ├── logistics/
│   │   ├── handover/
│   │   ├── payments/
│   │   ├── safety/
│   │   ├── analytics/
│   │   ├── fraud/
│   │   └── sync/
│   ├── tests/
│   └── migrations/
│
├── ml/
│   ├── vision/
│   ├── pricing/
│   ├── demand/
│   ├── recommendation/
│   ├── anomaly/
│   └── training/
│
├── data/
│   ├── raw/
│   ├── processed/
│   ├── labels/
│   └── schemas/
│
├── infrastructure/
│   ├── docker/
│   ├── terraform/
│   └── monitoring/
│
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── ml/
│   └── product/
│
├── docker-compose.yml
├── README.md
└── architect.md
```

---

# 25. IoT & Hardware Architecture

## 25.1 Architecture Decision

The platform is **smartphone-first and IoT-optional**. No dedicated hardware is required for the MVP. The collector smartphone provides the camera, microphone, GPS, local storage, connectivity, QR scanning, and voice interaction.

### MVP hardware

| Hardware | Required | Purpose |
|---|---:|---|
| Android smartphone | Yes | Primary collector device |
| Smartphone camera | Built in | E-waste identification |
| Smartphone microphone | Built in | Voice input |
| Smartphone GPS | Built in | Location |
| Dedicated IoT device | No | Not required |
| Dedicated weighing scale | No | Manual/estimated weight for MVP |
| RFID reader | No | Optional; phone can handle QR/NFC where supported |

## 25.2 Future IoT Integrations

### Bluetooth smart weighing scale

```text
Material → BLE Weighing Scale → React Native App → Lot → Backend
```

This is the highest-value future hardware integration because it improves weight accuracy, reduces manual entry, and helps resolve weight disputes.

### NFC / RFID lot identification

```text
Physical Bag/Lot → NFC/RFID Tag → Phone → Lot ID → Traceability
```

Useful for aggregation, warehouses, and recycler receiving.

### Smart collection bin

Potential components:
- load cell
- microcontroller
- NFC/RFID
- connectivity module
- battery

### Environmental sensors

For specialised storage facilities, optional temperature/humidity/battery-storage sensors can provide safety alerts. Safety-critical decisions should use deterministic thresholds in addition to ML.

## 25.3 IoT Principle

Do not make hardware a prerequisite for the business model. Introduce hardware only when it measurably improves accuracy, safety, traceability, fraud prevention, or operational efficiency.

# 26. Deployment Architecture

## MVP

```text
                 Internet
                    │
              ┌─────▼─────┐
              │ Cloudflare │
              └─────┬─────┘
                    │
              ┌─────▼─────┐
              │ FastAPI   │
              │ Container │
              └─────┬─────┘
                    │
       ┌────────────┼────────────┐
       │            │            │
   PostgreSQL     Redis       Object Store
       │
    PostGIS
```

## Scaled

```text
                    CDN
                     │
              Load Balancer
                     │
              API Gateway
                     │
       ┌─────────────┼─────────────┐
       │             │             │
   Core API       ML API       Worker Pool
       │             │             │
       └─────────────┼─────────────┘
                     │
              Event / Queue Layer
                     │
       ┌─────────────┼─────────────┐
       │             │             │
 PostgreSQL       Redis       Object Storage
       │
       ▼
 Analytics / Warehouse
```

---

# 27. Key Architectural Decisions

## Decision 1 — Mobile First

The collector's smartphone is the primary field device.

No dedicated hardware is required for the initial product.

## Decision 2 — Modular Monolith First

A modular monolith reduces:

- deployment complexity,
- debugging complexity,
- infrastructure cost,
- development time.

Microservices can be introduced when scale justifies them.

## Decision 3 — PostgreSQL as System of Record

PostgreSQL handles transactional truth.

Use specialised systems only when needed.

## Decision 4 — AI-Assisted, Human-Confirmed

AI should accelerate workflows, not blindly control financial outcomes.

## Decision 5 — Net Earnings Over Gross Price

Recommendations must account for:

```text
Price
− transport
− handling
− fees
− risk
```

## Decision 6 — Event-Based Traceability

Every important state change becomes an auditable event.

## Decision 7 — Offline First

A collector should still be able to create and record collection data when connectivity is poor.

---

# 28. Security & Abuse Cases

The architecture must consider:

- fake recycler accounts
- fake collector accounts
- stolen identity documents
- manipulated weight
- manipulated prices
- duplicate lots
- fake photos
- replayed transactions
- payment fraud
- GPS spoofing
- account takeover
- API abuse
- malicious image uploads
- fraudulent bulk aggregation

Controls:

```text
Authentication
+
RBAC
+
Rate Limiting
+
Input Validation
+
File Validation
+
Audit Logs
+
Anomaly Detection
+
Human Review
```

---

# 29. Data Governance

Data categories:

```text
Identity Data
Transaction Data
Location Data
Financial Data
Image Data
Operational Data
ML Training Data
```

Principles:

- collect minimum necessary data,
- encrypt sensitive data,
- separate operational and analytical access,
- anonymise datasets used for modelling where possible,
- define retention policies,
- maintain audit trails,
- obtain appropriate user consent where required.

---

# 30. Analytics KPIs

## Collector KPIs

```text
Active collectors
Collection volume
Average earnings
Average net margin
Average selling price
Repeat sales
Payment completion rate
```

## Marketplace KPIs

```text
Active recyclers
Active demands
Offer acceptance rate
Match success rate
Average distance
Average transport cost
```

## Recycling KPIs

```text
Total e-waste volume
Formal recycling volume
Material recovery
Regional recycling rate
```

## Platform KPIs

```text
DAU / MAU
Lot creation rate
AI confirmation rate
Sync success rate
Transaction completion rate
Revenue
Retention
```

---

# 31. Example End-to-End Scenario

```text
1. Collector enters an industrial region.

2. App shows:
   "High opportunity for copper cable."

3. Collector collects a batch.

4. Collector photographs it.

5. AI detects:
   Copper cable
   Confidence: 92%

6. Collector confirms.

7. Collector says:
   "Weight 35 kilos."

8. Lot L001 is created.

9. System checks:
   - nearby recycler prices
   - active recycler demand
   - distance
   - transport cost
   - historical prices

10. System recommends Recycler B.

11. Recycler B has an active demand for copper cable.

12. Collector accepts.

13. Pickup is scheduled.

14. Recycler receives material.

15. Recycler weighs:
   34.6 kg.

16. Final price is recorded.

17. Payment is initiated.

18. Collector receives payment.

19. Dashboard updates:
   - revenue
   - profit
   - material performance
   - recycler performance

20. The transaction becomes training/analytics data.

21. The system improves future recommendations.
```

---

# 32. Example Opportunity Calculation

Assume:

```text
Expected quantity = 50 kg
Recycler A price = ₹100/kg
Recycler B price = ₹106/kg

Gross:
A = ₹5,000
B = ₹5,300

Transport:
A = ₹100
B = ₹450

Other cost:
A = ₹50
B = ₹50
```

Net:

```text
A = ₹5,000 - ₹100 - ₹50 = ₹4,850

B = ₹5,300 - ₹450 - ₹50 = ₹4,800
```

Therefore:

> Recycler A is the better recommendation despite having the lower listed price.

This is a fundamental product principle.

---

# 33. Explainability

Every major recommendation should provide a short reason.

Bad:

```text
Opportunity Score: 87.4
```

Better:

```text
Recommended because:

✓ High local demand
✓ Good current price
✓ Recycler nearby
✓ Low transport cost
✓ Your previous sales of this material were profitable
```

This is especially important for users with low digital literacy.

---

# 34. Accessibility Design

The collector interface should support:

- large touch targets,
- high contrast,
- icons,
- minimal text,
- local languages,
- audio prompts,
- confirmation screens,
- simple error recovery.

Example:

```text
┌──────────────────────┐
│   📷 SELL MATERIAL   │
├──────────────────────┤
│                      │
│   📷 TAKE PHOTO      │
│                      │
├──────────────────────┤
│   🎤 SPEAK WEIGHT    │
│                      │
├──────────────────────┤
│   ₹ CHECK PRICE      │
└──────────────────────┘
```

---

# 35. Basic-Phone Compatibility

The primary feature set requires a smartphone for:

- camera AI,
- maps,
- rich UI,
- offline image capture.

For basic phones, provide a reduced channel through:

- IVR,
- SMS,
- assisted collection centres,
- voice calls.

Basic-phone users should not be forced into the full smartphone workflow.

---

# 36. Internationalisation

Initial languages:

```text
English
Hindi
Marathi
```

Architecture should support adding:

```text
Tamil
Telugu
Bengali
Gujarati
Kannada
Malayalam
Punjabi
```

All UI strings should be externalised.

Never hardcode user-facing text inside business logic.

---

# 37. Model Governance

Every production ML model should have:

```text
Model ID
Version
Training dataset version
Metrics
Known limitations
Deployment date
Rollback version
```

Example:

```text
vision-material-v1.4
Accuracy: XX%
Precision: XX%
Recall: XX%
Dataset: e-waste-2026-08
```

Models must support rollback.

---

# 38. Disaster Recovery

Minimum requirements:

- automated PostgreSQL backups,
- object-storage versioning,
- database point-in-time recovery,
- infrastructure-as-code,
- replicated critical data,
- documented restore procedure.

Target metrics:

```text
RPO: define based on financial requirements
RTO: define based on operational requirements
```

For financial records, durability takes priority over aggressive cost optimisation.

---

# 39. Future Extensions

Potential future capabilities:

- IoT-enabled weighing scales
- Bluetooth weighing machines
- QR-coded physical sacks
- digital collector credit
- microfinance integration
- working-capital recommendations
- insurance integrations
- carbon-impact accounting
- ESG reporting
- enterprise e-waste pickup contracts
- B2B collection networks
- material commodity forecasting
- computer-vision-assisted dismantling guidance
- automated warehouse inventory
- digital certificates of recycling

Hardware should remain optional rather than becoming a dependency.

---

# 40. What Makes the Platform Different

The platform is not merely:

```text
Scrap marketplace
```

It combines:

```text
Marketplace
+
AI Vision
+
Regional Intelligence
+
Market Intelligence
+
Opportunity Prediction
+
Reverse Demand
+
Smart Matching
+
Logistics
+
Traceability
+
Payments
+
Business Intelligence
```

The strategic shift is:

```text
OLD MODEL

Collect → Find Buyer → Sell


NEW MODEL

Predict Opportunity
        ↓
Collect Intelligently
        ↓
Identify
        ↓
Value
        ↓
Compare Demand
        ↓
Optimise Net Earnings
        ↓
Sell
        ↓
Track
        ↓
Analyse
        ↓
Improve Next Decision
```

---

# 41. Final Architecture Summary

```text
                         KABADIWALA → ENTREPRENEUR
                                  PLATFORM
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
   COLLECTOR APP                 INTELLIGENCE                 MARKETPLACE
        │                             │                             │
   Camera / Voice              Regional Intelligence        Recycler Offers
   Offline Mode                Price Prediction              Reverse Demand
   Lot Creation                Demand Prediction             Smart Matching
        │                       Opportunity Engine             Aggregation
        │                             │                             │
        └─────────────────────────────┼─────────────────────────────┘
                                      │
                               TRANSACTION CORE
                                      │
                     ┌────────────────┼────────────────┐
                     │                │                │
                 Logistics       Traceability       Payments
                     │                │                │
                     └────────────────┼────────────────┘
                                      │
                               DATA PLATFORM
                                      │
                 ┌────────────────────┼────────────────────┐
                 │                    │                    │
             Analytics              ML/AI             Governance
                 │                    │                    │
                 └────────────────────┼────────────────────┘
                                      │
                             BETTER DECISIONS
                                      │
                                      ▼
                              HIGHER NET EARNINGS
                              + FORMAL RECYCLING
                              + TRACEABILITY
                              + BUSINESS GROWTH
```

---

# 42. Recommended Build Order

The technically sensible order is:

```text
Phase 1
Authentication
→ Collector
→ Recycler
→ Materials
→ Lots
→ Basic pricing
→ Transactions

Phase 2
Camera
→ AI classification
→ OCR
→ Safety

Phase 3
Recycler marketplace
→ Reverse demand
→ Matching
→ Offers

Phase 4
Regional intelligence
→ GIS
→ Price intelligence
→ Opportunity engine

Phase 5
Logistics
→ Pickup
→ Routing
→ Aggregation

Phase 6
Payments
→ Digital receipts
→ Settlement

Phase 7
Analytics
→ Business intelligence
→ Fraud detection
→ Personalisation

Phase 8
Advanced ML
→ Price prediction
→ Demand prediction
→ Industry-to-e-waste prediction
→ Opportunity prediction
```

This sequencing avoids the common mistake of building an elaborate AI layer before there is enough trustworthy transaction data to train it.

---

# 43. Final Technology Stack

| Layer | Recommended Technology |
|---|---|
| Collector Mobile | React Native + TypeScript |
| Android Native | Kotlin where needed |
| Recycler/Admin | Next.js + React + TypeScript |
| Backend | Python + FastAPI |
| ORM | SQLAlchemy |
| Database | PostgreSQL |
| GIS | PostGIS |
| Spatial Index | H3 |
| Cache | Redis |
| Queue | Celery/Redis initially |
| Event Streaming | Kafka/Redpanda later |
| Object Storage | S3 / R2 / GCS |
| Computer Vision | PyTorch + YOLO + OpenCV |
| OCR | PaddleOCR |
| ML | scikit-learn + XGBoost/LightGBM |
| Model Tracking | MLflow |
| Inference | FastAPI + ONNX Runtime |
| Maps | OpenStreetMap + MapLibre |
| Routing | OSRM / GraphHopper |
| Authentication | OAuth2/OIDC + JWT |
| Notifications | FCM + SMS/WhatsApp provider |
| Payments | UPI/payment gateway |
| Containers | Docker |
| CI/CD | GitHub Actions |
| Monitoring | OpenTelemetry + Prometheus + Grafana |
| Error Tracking | Sentry |
| Infrastructure | AWS/GCP/Azure |
| IaC | Terraform |
| Testing | Pytest + React Native + TypeScript test + Playwright |
| Documentation | Markdown + OpenAPI |

---

# 44. Architecture Principle

> **The platform should make the collector smarter before it tries to make the ecosystem more complicated.**

The first measurable outcome should be:

**Can the system help a collector make a better collection or selling decision than they could make alone?**

If yes, every subsequent feature—marketplace, logistics, aggregation, AI, analytics, and traceability—has a clear purpose.

