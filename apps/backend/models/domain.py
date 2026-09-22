from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

MaterialType = Literal[
    "Copper cable",
    "Server boards",
    "Aluminium",
    "Mixed e-waste",
    "Lithium-ion batteries",
    "Brass fittings",
    "Printed Circuit Boards (PCB)",
    "Electric motors",
    "Iron & steel scrap",
    "CRT & monitor glass",
    "Lead acid batteries",
    "Compressors & cooling units",
]

LotStatus = Literal[
    "DRAFT",
    "IDENTIFIED",
    "AVAILABLE",
    "MATCHED",
    "PICKUP_SCHEDULED",
    "SOLD",
    "PAID",
    "AGGREGATED",
]

class GeoLocation(BaseModel):
    latitude: float = Field(..., description="Latitude coordinate")
    longitude: float = Field(..., description="Longitude coordinate")
    accuracy: Optional[float] = Field(None, description="Accuracy in meters")
    cluster_name: Optional[str] = Field("Bhosari MIDC, Pune", description="Identified industrial cluster")

class LotCreate(BaseModel):
    material: MaterialType
    quality: Literal["low", "medium", "high"] = "medium"
    weight_kg: float = Field(..., gt=0)
    collector_id: str = "CLT-4218"
    collector_name: str = "Ramesh Kumar"
    location: Optional[GeoLocation] = None
    image_uri: Optional[str] = None
    expected_net_earnings: Optional[float] = None

class LotResponse(BaseModel):
    id: str
    material: MaterialType
    quality: Literal["low", "medium", "high"]
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

class HandoverVerificationRequest(BaseModel):
    qr_payload: Optional[str] = None
    lot_id: Optional[str] = None
    pickup_pin: Optional[str] = None

class HandoverConfirmRequest(BaseModel):
    lot_id: str
    pickup_pin: str
    recycler_id: str = "REC-PUNE-01"
    recycler_name: str = "EcoCycle Recyclers Pvt Ltd"
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

class MLMaterialPrediction(BaseModel):
    material: MaterialType
    category: str
    quality: Literal["low", "medium", "high"]
    hazard: bool
    confidence: float
    safety_message: Optional[str] = None
    bounding_box: Optional[Dict[str, float]] = None
    model_version: str = "MobileNetV3-Ewaste-v2.4-FineTuned"

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
    model_type: str = "ARIMA(2,1,1) with Seasonal Drift"
    forecast_7_days: List[PriceForecastPoint]
    advice: str

class AggregatorPoolCreate(BaseModel):
    lot_ids: List[str]
    aggregator_id: str = "AGG-WEST-09"
    aggregator_name: str = "Pune Central Scrap Aggregator"

class AggregatorPoolResponse(BaseModel):
    pool_id: str
    total_weight_kg: float
    lot_count: int
    material: MaterialType
    negotiated_bulk_rate_per_kg: float
    premium_gain_percent: float
    status: str = "READY_FOR_SMELTER"

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
