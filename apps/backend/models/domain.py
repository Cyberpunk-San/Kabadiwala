# apps/backend/models/domain.py
"""Pydantic models for every request/response in the API."""

from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field, field_validator
from datetime import date, datetime


# ─── Enums ───────────────────────────────────────────────────────────────────

MaterialType = Literal[
    "Copper cable", "Server boards", "Aluminium", "Mixed e-waste",
    "Lithium-ion batteries", "Brass fittings", "Printed Circuit Boards (PCB)",
    "Electric motors", "Iron & steel scrap", "CRT & monitor glass",
    "Lead acid batteries", "Compressors & cooling units",
    # Household scrap (priced from city rate cards)
    "Newspaper", "Books & notebooks", "Cardboard", "Mixed plastic", "PET bottles", "Stainless steel",
]

LotStatus = Literal[
    "DRAFT", "IDENTIFIED", "AVAILABLE", "MATCHED",
    "PICKUP_SCHEDULED", "SOLD", "PAID", "AGGREGATED",
]

QualityLevel = Literal["low", "medium", "high"]
LanguageType = Literal["en", "hi", "mr"]
KycStatus = Literal["PENDING", "IN_PROGRESS", "VERIFIED", "REJECTED"]
CollectorTier = Literal["bronze", "silver", "gold", "platinum"]
PickupSlot = Literal["morning", "afternoon", "evening", "anytime"]
DemandStatus = Literal["OPEN", "PARTIAL", "FULFILLED", "EXPIRED"]
RiskSeverity = Literal["low", "medium", "high", "critical"]
RiskAlertType = Literal[
    "DUPLICATE_LOT", "DUPLICATE_PHOTO", "WEIGHT_MISMATCH", "PRICE_OUTLIER",
    "SUSPICIOUS_PATTERN", "UNVERIFIED_ACTIVITY", "ABNORMAL_RECYCLER",
    "TRANSACTION_RISK",
]


# ─── Geo ─────────────────────────────────────────────────────────────────────

class GeoLocation(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    cluster_name: Optional[str] = "Bhosari MIDC, Pune"


# ─── Lots ────────────────────────────────────────────────────────────────────

class LotCreate(BaseModel):
    material: MaterialType
    quality: QualityLevel = "medium"
    weight_kg: float = Field(..., gt=0)
    collector_id: str = "CLT-4218"
    collector_name: str = "Ramesh Kumar"
    location: Optional[GeoLocation] = None
    image_uri: Optional[str] = None
    expected_net_earnings: Optional[float] = None


class LotResponse(BaseModel):
    id: str
    material: MaterialType
    quality: QualityLevel
    weight_kg: float
    status: LotStatus
    collector_id: str
    collector_name: str
    location: Optional[GeoLocation] = None
    image_uri: Optional[str] = None
    created_at: str
    expected_net_earnings: Optional[float] = None
    sync_state: str = "SYNCED"
    epr_certificate_id: Optional[str] = None


# ─── Recycler offers ─────────────────────────────────────────────────────────

class RecyclerOffer(BaseModel):
    id: str
    recycler_name: str
    verified: bool = True
    cpcb_license: str
    rating: float
    listed_price_per_kg: float
    pickup_cost: float
    handling_cost: float
    platform_fee: float
    distance_km: float
    payment_reliability: int
    net_earnings: float
    location: GeoLocation


# ─── Handover ────────────────────────────────────────────────────────────────

class HandoverVerificationRequest(BaseModel):
    qr_payload: Optional[str] = None
    lot_id: Optional[str] = None
    pickup_pin: Optional[str] = None


class HandoverConfirmRequest(BaseModel):
    lot_id: str
    pickup_pin: str
    recycler_id: str = "REC-PUNE-01"
    recycler_name: Optional[str] = "EcoCycle Recyclers Pvt Ltd"
    audited_weight_kg: float
    agreed_payout: float
    payment_mode: Literal["UPI", "BANK_TRANSFER", "CASH"] = "UPI"


class HandoverReceipt(BaseModel):
    status: str = "CONFIRMED"
    lot_id: str
    utr_number: str
    amount_paid: float
    beneficiary: str
    payment_mode: str
    timestamp: str
    epr_certificate_id: str
    carbon_offset_kg: float
    cpcb_compliance_hash: str


# ─── Vision ──────────────────────────────────────────────────────────────────

class MaterialAlternative(BaseModel):
    material: MaterialType
    confidence: float


class MLMaterialPrediction(BaseModel):
    material: MaterialType
    category: str
    quality: QualityLevel
    hazard: bool
    confidence: float
    safety_message: Optional[str] = None
    bounding_box: Optional[Dict[str, float]] = None
    alternatives: List[MaterialAlternative] = []
    model_version: str = "fallback"
    # "huggingface" | "local" | "fallback" — lets the UI say where the answer came from.
    source: str = "fallback"


class ImageAnalyzeRequest(BaseModel):
    # Preferred: base64 JPEG/PNG (raw or data URL) straight from the phone camera.
    image_base64: Optional[str] = None
    # Legacy: a path readable by the backend machine (scripts / tests).
    imageUri: Optional[str] = None


# ─── AI Assistant ────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=2000)


class AssistantChatRequestLocation(BaseModel):
    latitude: float
    longitude: float


class AssistantChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., min_length=1, max_length=20)
    language: LanguageType = "hi"
    collector_id: Optional[str] = None
    location: Optional[AssistantChatRequestLocation] = None


class AssistantAction(BaseModel):
    """Something the app can do for the user — rendered as a tappable button."""
    type: Literal["open_market", "open_scan", "open_rates", "open_demands", "open_earnings", "open_opportunity"]
    material: Optional[MaterialType] = None
    weight_kg: Optional[float] = None


class AssistantStep(BaseModel):
    """One tool call the agent made — shown to the user for transparency."""
    tool: str
    summary: str


class AssistantChatResponse(BaseModel):
    reply: str
    provider: str  # "huggingface" | "gemini" | "offline"
    suggestions: List[str] = []
    actions: List[AssistantAction] = []
    steps: List[AssistantStep] = []


# ─── Collector business insights ─────────────────────────────────────────────

class UnderpricedSale(BaseModel):
    lot_id: str
    material: MaterialType
    weight_kg: float
    sold_per_kg: float
    fair_per_kg: float
    gap_percent: float
    lost_inr: float
    recycler_name: str
    sold_at: str


class InsightMaterial(BaseModel):
    material: MaterialType
    kg: float
    earned: float
    sales: int
    avg_per_kg: float
    share_percent: float
    realised_percent: float


class InsightRecycler(BaseModel):
    recycler_id: str
    recycler_name: str
    sales: int
    kg: float
    earned: float
    avg_per_kg: float


class InsightWeekday(BaseModel):
    day: str
    lots: int
    kg: float


class InsightSuggestion(BaseModel):
    """Rendered as a sentence by the app, in the collector's language."""
    code: Literal["UNDERPRICED", "SWITCH_RECYCLER", "SELL_STALE", "POOL_SMALL_LOTS", "NEW_DEMAND", "BEST_DAY"]
    impact_inr: float
    params: Dict[str, Any] = {}


class CollectorInsights(BaseModel):
    collector_id: str
    generated_at: str
    sold_lots: int
    sold_kg: float
    earned: float
    avg_per_kg: float
    realised_percent: float
    unsold_lots: int
    unsold_value: float
    underpriced: List[UnderpricedSale]
    materials: List[InsightMaterial]
    recyclers: List[InsightRecycler]
    weekdays: List[InsightWeekday]
    best_material: Optional[str] = None
    best_recycler: Optional[str] = None
    suggestions: List[InsightSuggestion]


# ─── Regional intelligence ───────────────────────────────────────────────────

class RegionalCell(BaseModel):
    latitude: float
    longitude: float
    supply_kg: float
    collected_kg: float
    pickup_kg: float
    pickups: int
    demand_kg: float
    recyclers: int
    industry: float
    score: float


class RegionalHotspot(BaseModel):
    latitude: float
    longitude: float
    score: float
    reasons: List[Literal["SUPPLY", "PICKUPS", "DEMAND", "INDUSTRY"]]
    area: Optional[str] = None
    distance_km: float


class RegionalClusterMaterial(BaseModel):
    material: MaterialType
    share: float
    best_price_per_kg: Optional[float] = None


class RegionalCluster(BaseModel):
    id: str
    name: str
    sector: str
    sector_label: str
    latitude: float
    longitude: float
    size: int
    distance_km: float
    value_per_kg: float
    open_demand_kg: float
    opportunity_score: float
    materials: List[RegionalClusterMaterial]


class RegionalMaterialBalance(BaseModel):
    material: MaterialType
    supply_kg: float
    demand_kg: float
    gap_kg: float
    best_price_per_kg: Optional[float] = None


class RegionalRecycler(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float


class RegionalDataset(BaseModel):
    name: str
    approximate: bool
    clusters: int
    retrieved_on: Optional[str] = None


class RegionalOverviewResponse(BaseModel):
    latitude: float
    longitude: float
    radius_km: float
    cell_deg: float
    cells: List[RegionalCell]
    hotspots: List[RegionalHotspot]
    clusters: List[RegionalCluster]
    balance: List[RegionalMaterialBalance]
    recyclers: List[RegionalRecycler]
    dataset: RegionalDataset


class PriceHeatCell(BaseModel):
    latitude: float
    longitude: float
    best_net_per_kg: Optional[float] = None
    best_recycler: Optional[str] = None


class PriceHeatmapResponse(BaseModel):
    material: MaterialType
    latitude: float
    longitude: float
    radius_km: float
    step_lat: float
    step_lon: float
    cells: List[PriceHeatCell]
    min_price: Optional[float] = None
    max_price: Optional[float] = None


# ─── Prices ──────────────────────────────────────────────────────────────────

class PriceForecastPoint(BaseModel):
    date: str
    forecast_price: float
    lower_ci: float
    upper_ci: float
    trend: Literal["up", "down", "stable"]


class PriceForecastResponse(BaseModel):
    material: MaterialType
    zone: str
    current_price: float
    model_type: str = "ARIMA(2,1,1)"
    forecast_7_days: List[PriceForecastPoint]
    advice: str


class PriceHistoryPoint(BaseModel):
    date: str
    price: float
    source: str


# ─── Aggregator ──────────────────────────────────────────────────────────────

class AggregatorPoolCreate(BaseModel):
    lot_ids: List[str]
    aggregator_id: str = "AGG-WEST-09"
    aggregator_name: Optional[str] = "Pune Central Scrap Aggregator"


class AggregatorPoolResponse(BaseModel):
    pool_id: str
    total_weight_kg: float
    lot_count: int
    material: MaterialType
    negotiated_bulk_rate_per_kg: float
    premium_gain_percent: float
    status: str = "READY_FOR_SMELTER"


# ─── CPCB ────────────────────────────────────────────────────────────────────

class CPCBMaterialTonnage(BaseModel):
    material: MaterialType
    tonnage_mt: float
    recycled_mt: float
    disposed_mt: float
    recovery_rate_percent: float
    epr_credits_generated: float


class CPCBReportResponse(BaseModel):
    report_id: str
    period: str = "FY 2025-26"
    rule_reference: str = "Rule 13(1) & Form-2 E-Waste (Management) Rules, 2022"
    registered_hub: str = "Pune & Maharashtra West Circular Zone"
    total_e_waste_collected_mt: float
    total_epr_credits: float
    materials_breakdown: List[CPCBMaterialTonnage]
    verified_recyclers_count: int
    registered_collectors_count: int
    compliance_status: str = "100% AUDIT COMPLIANT"
    generated_at: str
    digital_signature: str


# ─── National context ────────────────────────────────────────────────────────

class StateEwasteRow(BaseModel):
    state: str
    collected_mt: float


class NationalContextResponse(BaseModel):
    configured: bool
    message: Optional[str] = None
    source: Optional[Dict[str, Any]] = None
    year: Optional[int] = None
    india: Optional[Dict[str, Any]] = None
    top_states: Optional[List[StateEwasteRow]] = None
    notes: Optional[str] = None


# ─── Collector ───────────────────────────────────────────────────────────────

class CollectorRegisterRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)
    name: str = Field(..., min_length=2, max_length=80)
    language: LanguageType = "hi"
    operating_area: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    collection_radius_km: float = 10.0


class CollectorLoginRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)


class CollectorProfileResponse(BaseModel):
    id: str
    phone: str
    name: str
    language: LanguageType
    operating_area: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    collection_radius_km: float
    material_expertise: Optional[List[str]] = None
    kyc_status: KycStatus
    kyc_aadhaar_last4: Optional[str] = None
    kyc_pan_masked: Optional[str] = None
    kyc_bank_account_last4: Optional[str] = None
    kyc_verified_at: Optional[str] = None
    tier: CollectorTier
    rating: float
    total_lots: int
    total_weight_kg: float
    total_earnings: float
    created_at: str


class CollectorUpdateRequest(BaseModel):
    name: Optional[str] = None
    language: Optional[LanguageType] = None
    operating_area: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    collection_radius_km: Optional[float] = None
    material_expertise: Optional[List[str]] = None


class KycStartRequest(BaseModel):
    aadhaar_last4: str = Field(..., min_length=4, max_length=4)
    pan_masked: str = Field(..., min_length=6, max_length=15)
    bank_account_last4: str = Field(..., min_length=4, max_length=4)


class KycVerifyRequest(BaseModel):
    selfie_uri: Optional[str] = None


class CollectorStatsResponse(BaseModel):
    total_lots: int
    total_weight_kg: float
    total_earnings: float
    avg_earnings_per_lot: float
    avg_price_per_kg: float
    tier: CollectorTier
    rating: float
    next_tier_at_kg: Optional[float] = None


# ─── Demands / Reverse Marketplace ───────────────────────────────────────────

class DemandCreate(BaseModel):
    recycler_id: str
    recycler_name: str
    material: MaterialType
    quality_required: QualityLevel = "medium"
    quantity_kg: float = Field(..., gt=0)
    offered_price_per_kg: float = Field(..., gt=0)
    deadline_days: int = Field(7, ge=1, le=90)
    hub: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None


class DemandResponse(BaseModel):
    id: str
    recycler_id: str
    recycler_name: str
    material: MaterialType
    quality_required: QualityLevel
    quantity_kg: float
    offered_price_per_kg: float
    deadline: str
    hub: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None
    status: DemandStatus
    filled_kg: float
    created_at: str
    match_count: int = 0
    hours_remaining: float = 0.0


class DemandMatchResponse(BaseModel):
    demand_id: str
    lot_id: str
    collector_id: str
    weight_kg: float
    match_score: float
    match_reasons: List[str]


# ─── Opportunity Engine ──────────────────────────────────────────────────────

class OpportunityItem(BaseModel):
    material: MaterialType
    opportunity_score: float
    avg_listed_price_per_kg: float
    best_net_per_kg: float
    demand_kg_open: float
    active_demand_count: int
    recommended_weight_kg: float
    expected_payout: float
    reasoning: str


class OpportunityFeedResponse(BaseModel):
    generated_at: str
    location_label: str
    items: List[OpportunityItem]


# ─── Admin ───────────────────────────────────────────────────────────────────

class AdminOverviewResponse(BaseModel):
    generated_at: str
    totals: Dict[str, Any]
    today: Dict[str, Any]
    pending_actions: Dict[str, Any]
    top_materials: List[Dict[str, Any]]
    top_recyclers: List[Dict[str, Any]]


class AdminCollectorRow(BaseModel):
    id: str
    name: str
    phone: str
    operating_area: Optional[str] = None
    kyc_status: KycStatus
    tier: CollectorTier
    rating: float
    total_lots: int
    total_weight_kg: float
    total_earnings: float
    created_at: str


class AdminRecyclerRow(BaseModel):
    id: str
    recycler_name: str
    cpcb_license: str
    rating: float
    cluster: Optional[str] = None
    is_active: bool
    payment_reliability: int


class AdminMaterialFlowRow(BaseModel):
    material: MaterialType
    lots: int
    weight_kg: float
    payout_inr: float
    avg_price_per_kg: float


class AdminAnomalyRow(BaseModel):
    severity: Literal["low", "medium", "high"]
    type: str
    message: str
    lot_id: Optional[str] = None
    collector_id: Optional[str] = None
    created_at: str


# ─── Risk / Fraud ────────────────────────────────────────────────────────────

class RiskAlert(BaseModel):
    id: str
    severity: RiskSeverity
    type: RiskAlertType
    message: str
    lot_id: Optional[str] = None
    collector_id: Optional[str] = None
    recycler_id: Optional[str] = None
    risk_score: float
    resolved: bool
    created_at: str


class RiskScanResponse(BaseModel):
    generated_at: str
    total_alerts: int
    by_severity: Dict[str, int]
    alerts: List[RiskAlert]


# ─── ML: Valuation & Demand ──────────────────────────────────────────────────

class ValuationRequest(BaseModel):
    material: MaterialType
    quality: QualityLevel = "medium"
    weight_kg: float = Field(..., gt=0)
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class ValuationResponse(BaseModel):
    material: MaterialType
    weight_kg: float
    quality: QualityLevel
    fair_price_per_kg: float
    fair_payout: float
    confidence: float
    method: str = "local market price (live metals × nearby industry) × quality × volume"
    reasoning: str


class DemandPredictionPoint(BaseModel):
    material: MaterialType
    current_open_kg: float
    predicted_kg_next_7d: float
    trend: Literal["up", "down", "stable"]
    confidence: float


class DemandPredictionResponse(BaseModel):
    generated_at: str
    points: List[DemandPredictionPoint]


# ─── Sync ────────────────────────────────────────────────────────────────────

class SyncBatchItem(BaseModel):
    entity: Literal["lot", "handover", "demand"]
    entity_id: str
    idempotency_key: str
    payload: Dict[str, Any]
    client_created_at: Optional[str] = None


class SyncBatchRequest(BaseModel):
    device_id: str
    items: List[SyncBatchItem]


class SyncBatchResult(BaseModel):
    entity: str
    entity_id: str
    idempotency_key: str
    status: Literal["APPLIED", "DUPLICATE", "CONFLICT", "REJECTED"]
    server_id: Optional[str] = None
    message: Optional[str] = None


class SyncBatchResponse(BaseModel):
    device_id: str
    accepted: int
    duplicates: int
    conflicts: int
    rejected: int
    results: List[SyncBatchResult]


# ─── Recycler Console ────────────────────────────────────────────────────────

class RecyclerPrices(BaseModel):
    recycler_id: str
    recycler_name: str
    is_active: bool
    prices: Dict[str, float]
    market_linked: List[str] = []   # materials whose price follows the live market


class RecyclerPricesUpdate(BaseModel):
    prices: Dict[MaterialType, float]

    @field_validator("prices")
    @classmethod
    def _positive(cls, v: Dict[str, float]) -> Dict[str, float]:
        if not v or any(p <= 0 or p > 100000 for p in v.values()):
            raise ValueError("Prices must be between 0 and 100000 ₹/kg")
        return v


class RecyclerOfferCreate(BaseModel):
    recycler_id: str
    lot_id: str
    offered_price_per_kg: float = Field(..., gt=0)
    pickup_cost: float = 0.0
    handling_cost: float = 0.0
    platform_fee: float = 0.0
    notes: Optional[str] = None
    expires_in_hours: int = Field(48, ge=1, le=336)


class RecyclerOfferResponse(BaseModel):
    id: str
    recycler_id: str
    lot_id: str
    offered_price_per_kg: float
    pickup_cost: float
    handling_cost: float
    platform_fee: float
    net_earnings: float
    notes: Optional[str] = None
    status: Literal["PENDING", "ACCEPTED", "REJECTED", "EXPIRED"]
    expires_at: Optional[str] = None
    created_at: str


class RecyclerIncomingLot(BaseModel):
    id: str
    material: MaterialType
    quality: QualityLevel
    weight_kg: float
    status: str
    collector_id: str
    collector_name: str
    expected_net_earnings: Optional[float] = None
    created_at: str
    distance_km: Optional[float] = None


class RecyclerTransaction(BaseModel):
    handover_id: str
    lot_id: str
    utr_number: str
    amount_paid: float
    audited_weight_kg: float
    epr_certificate_id: Optional[str] = None
    carbon_offset_kg: Optional[float] = None
    payment_mode: str
    created_at: str


class RecyclerAnalytics(BaseModel):
    recycler_id: str
    total_handovers: int
    total_kg: float
    total_paid_inr: float
    avg_price_per_kg: float
    top_material: Optional[str] = None
    open_offers: int
    accepted_offers: int
    incoming_lots_pending: int

# ─── Roles: households & companies ───────────────────────────────────────────

CompanyType = Literal["buyer", "seller", "both"]
PickupStatus = Literal["OPEN", "ACCEPTED", "COMPLETED", "CANCELLED"]
RoleType = Literal["kabadiwala", "household", "company"]


class HouseholdRegisterRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)
    name: str = Field(..., min_length=2, max_length=80)
    language: LanguageType = "hi"
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class HouseholdProfile(BaseModel):
    id: str
    phone: str
    name: str
    language: LanguageType
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: str
    total_pickups: int = 0
    total_received: float = 0.0


class CompanyRegisterRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)
    name: str = Field(..., min_length=2, max_length=120)
    contact_name: Optional[str] = None
    company_type: CompanyType = "seller"
    gstin: Optional[str] = None
    cpcb_license: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class CompanyProfile(BaseModel):
    id: str
    phone: str
    name: str
    contact_name: Optional[str] = None
    company_type: CompanyType
    gstin: Optional[str] = None
    cpcb_license: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    approved: bool
    created_at: str
    total_pickups: int = 0


class LoginRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)


class LoginResponse(BaseModel):
    role: RoleType
    collector: Optional[CollectorProfileResponse] = None
    household: Optional[HouseholdProfile] = None
    company: Optional[CompanyProfile] = None


class PickupCreate(BaseModel):
    requester_type: Literal["household", "company"]
    requester_id: str
    material: MaterialType
    estimated_weight_kg: float = Field(..., gt=0, le=100000)
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = Field(None, max_length=500)
    preferred_time: Optional[str] = Field(None, max_length=60)
    preferred_date: Optional[date] = None
    preferred_slot: Optional[PickupSlot] = None


class PickupSchedule(BaseModel):
    requester_id: str
    preferred_date: date
    preferred_slot: PickupSlot = "anytime"
    preferred_time: Optional[str] = Field(None, max_length=60)


class PickupAccept(BaseModel):
    collector_id: str
    offered_price_per_kg: Optional[float] = Field(None, gt=0)


class PickupComplete(BaseModel):
    collector_id: str
    pickup_pin: str
    actual_weight_kg: float = Field(..., gt=0, le=100000)


class PickupResponse(BaseModel):
    id: str
    requester_type: str
    requester_id: str
    requester_name: str
    requester_phone: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    material: MaterialType
    estimated_weight_kg: float
    estimated_value: float
    notes: Optional[str] = None
    preferred_time: Optional[str] = None
    preferred_date: Optional[str] = None
    preferred_slot: Optional[PickupSlot] = None
    status: PickupStatus
    collector_id: Optional[str] = None
    collector_name: Optional[str] = None
    collector_phone: Optional[str] = None
    offered_price_per_kg: Optional[float] = None
    actual_weight_kg: Optional[float] = None
    amount_paid: Optional[float] = None
    lot_id: Optional[str] = None
    distance_km: Optional[float] = None
    created_at: str
    accepted_at: Optional[str] = None
    completed_at: Optional[str] = None
    # Only returned to the requester — the kabadiwala must ask for it at the door.
    pickup_pin: Optional[str] = None
