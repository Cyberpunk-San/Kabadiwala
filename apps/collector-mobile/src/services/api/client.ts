// src/services/api/client.ts
import { config } from "../../constants/config";
import type { MaterialPrediction, RecyclerOffer } from "../../types/domain";

// ─── Core fetch helper ───────────────────────────────────────────────────────
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${config.apiBaseUrl}${path}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.apiTimeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`API ${res.status}: ${text || res.statusText}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Collector types (mirrors backend models/domain.py) ──────────────────────
export interface CollectorProfile {
  id: string;
  phone: string;
  name: string;
  language: "en" | "hi" | "mr";
  operating_area?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  collection_radius_km: number;
  material_expertise?: string[] | null;
  kyc_status: "PENDING" | "IN_PROGRESS" | "VERIFIED" | "REJECTED";
  kyc_aadhaar_last4?: string | null;
  kyc_pan_masked?: string | null;
  kyc_bank_account_last4?: string | null;
  kyc_verified_at?: string | null;
  tier: "bronze" | "silver" | "gold" | "platinum";
  rating: number;
  total_lots: number;
  total_weight_kg: number;
  total_earnings: number;
  created_at: string;
}

export interface CollectorStats {
  total_lots: number;
  total_weight_kg: number;
  total_earnings: number;
  avg_earnings_per_lot: number;
  avg_price_per_kg: number;
  tier: "bronze" | "silver" | "gold" | "platinum";
  rating: number;
  next_tier_at_kg?: number | null;
}

// ─── Collectors ──────────────────────────────────────────────────────────────
export async function registerCollector(input: {
  phone: string;
  name: string;
  language: "en" | "hi" | "mr";
  operating_area?: string;
  latitude?: number;
  longitude?: number;
  collection_radius_km?: number;
}): Promise<CollectorProfile> {
  return apiFetch<CollectorProfile>("/v1/collectors/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function loginCollector(phone: string): Promise<CollectorProfile> {
  return apiFetch<CollectorProfile>("/v1/collectors/login", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export async function getCollector(id: string): Promise<CollectorProfile> {
  return apiFetch<CollectorProfile>(`/v1/collectors/${id}`);
}

export async function updateCollector(
  id: string,
  patch: Partial<{
    name: string;
    language: "en" | "hi" | "mr";
    operating_area: string;
    latitude: number;
    longitude: number;
    collection_radius_km: number;
    material_expertise: string[];
  }>
): Promise<CollectorProfile> {
  return apiFetch<CollectorProfile>(`/v1/collectors/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function getCollectorStats(id: string): Promise<CollectorStats> {
  return apiFetch<CollectorStats>(`/v1/collectors/${id}/stats`);
}

// ─── KYC (simulated) ─────────────────────────────────────────────────────────
export async function kycStart(
  collectorId: string,
  input: { aadhaar_last4: string; pan_masked: string; bank_account_last4: string }
): Promise<CollectorProfile> {
  return apiFetch<CollectorProfile>(`/v1/collectors/${collectorId}/kyc/start`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function kycVerify(
  collectorId: string,
  selfieUri?: string
): Promise<CollectorProfile> {
  return apiFetch<CollectorProfile>(`/v1/collectors/${collectorId}/kyc/verify`, {
    method: "POST",
    body: JSON.stringify({ selfie_uri: selfieUri ?? null }),
  });
}

// ─── Offers ──────────────────────────────────────────────────────────────────
export async function getOffers(params: {
  material: string;
  weightKg: number;
  latitude?: number;
  longitude?: number;
}): Promise<RecyclerOffer[]> {
  const qs = new URLSearchParams({
    material: params.material,
    weight_kg: String(params.weightKg),
  });
  if (params.latitude !== undefined) qs.set("latitude", String(params.latitude));
  if (params.longitude !== undefined) qs.set("longitude", String(params.longitude));
  return apiFetch<RecyclerOffer[]>(`/v1/marketplace/offers?${qs}`);
}

// ─── Lots ────────────────────────────────────────────────────────────────────
export interface RemoteLot {
  id: string;
  material: string;
  quality: "low" | "medium" | "high";
  weight_kg: number;
  status: string;
  collector_id: string;
  collector_name: string;
  created_at: string;
  expected_net_earnings?: number | null;
  epr_certificate_id?: string | null;
}

export async function createLotRemote(input: {
  material: string;
  quality: "low" | "medium" | "high";
  weightKg: number;
  collectorId: string;
  collectorName: string;
  latitude?: number;
  longitude?: number;
  imageUri?: string;
  expectedNetEarnings?: number;
}): Promise<RemoteLot> {
  return apiFetch<RemoteLot>("/v1/lots", {
    method: "POST",
    body: JSON.stringify({
      material: input.material,
      quality: input.quality,
      weight_kg: input.weightKg,
      collector_id: input.collectorId,
      collector_name: input.collectorName,
      location:
        input.latitude !== undefined && input.longitude !== undefined
          ? { latitude: input.latitude, longitude: input.longitude }
          : null,
      image_uri: input.imageUri ?? null,
      expected_net_earnings: input.expectedNetEarnings ?? null,
    }),
  });
}

export async function getLotPin(lotId: string): Promise<string> {
  const data = await apiFetch<{ lot_id: string; pickup_pin: string }>(
    `/v1/lots/${lotId}/pin`
  );
  return data.pickup_pin;
}

// ─── Handover ────────────────────────────────────────────────────────────────
export interface HandoverReceipt {
  status: string;
  lot_id: string;
  utr_number: string;
  amount_paid: number;
  beneficiary: string;
  payment_mode: string;
  timestamp: string;
  epr_certificate_id: string;
  carbon_offset_kg: number;
  cpcb_compliance_hash: string;
}

export async function confirmHandover(input: {
  lotId: string;
  pickupPin: string;
  recyclerId?: string;
  recyclerName?: string;
  auditedWeightKg: number;
  agreedPayout: number;
  paymentMode?: "UPI" | "BANK_TRANSFER" | "CASH";
}): Promise<HandoverReceipt> {
  return apiFetch<HandoverReceipt>("/v1/handover/confirm", {
    method: "POST",
    body: JSON.stringify({
      lot_id: input.lotId,
      pickup_pin: input.pickupPin,
      recycler_id: input.recyclerId ?? "REC-PUNE-01",
      recycler_name: input.recyclerName ?? "EcoCycle Recyclers Pvt Ltd",
      audited_weight_kg: input.auditedWeightKg,
      agreed_payout: input.agreedPayout,
      payment_mode: input.paymentMode ?? "UPI",
    }),
  });
}

// ─── Vision ──────────────────────────────────────────────────────────────────
export async function analyseMaterial(imageUri: string): Promise<MaterialPrediction> {
  try {
    return await apiFetch<MaterialPrediction>("/v1/vision/analyze", {
      method: "POST",
      body: JSON.stringify({ imageUri }),
    });
  } catch (err) {
    console.warn("[api] analyseMaterial failed, returning fallback:", err);
    return {
      material: "Mixed e-waste",
      category: "Electronics",
      quality: "low",
      hazard: false,
      confidence: 0.0,
    };
  }
}

// NOTE: demoOffers has been removed.
// All marketplace data now comes from the backend.
// ─── Reverse Marketplace: Demands ────────────────────────────────────────────

export interface Demand {
  id: string;
  recycler_id: string;
  recycler_name: string;
  material: string;
  quality_required: "low" | "medium" | "high";
  quantity_kg: number;
  offered_price_per_kg: number;
  deadline: string;
  hub?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  status: "OPEN" | "PARTIAL" | "FULFILLED" | "EXPIRED";
  filled_kg: number;
  created_at: string;
  match_count: number;
  hours_remaining: number;
}

export async function listDemands(material?: string): Promise<Demand[]> {
  const qs = material ? `?material=${encodeURIComponent(material)}` : "";
  return apiFetch<Demand[]>(`/v1/demands${qs}`);
}

export async function getDemandMatches(demandId: string): Promise<Array<{
  demand_id: string;
  lot_id: string;
  collector_id: string;
  weight_kg: number;
  match_score: number;
  match_reasons: string[];
}>> {
  return apiFetch(`/v1/demands/${demandId}/matches`);
}

// ─── Opportunity Engine ──────────────────────────────────────────────────────

export interface OpportunityItem {
  material: string;
  opportunity_score: number;
  avg_listed_price_per_kg: number;
  best_net_per_kg: number;
  demand_kg_open: number;
  active_demand_count: number;
  recommended_weight_kg: number;
  expected_payout: number;
  reasoning: string;
}

export interface OpportunityFeed {
  generated_at: string;
  location_label: string;
  items: OpportunityItem[];
}

export async function getOpportunityFeed(params?: {
  latitude?: number;
  longitude?: number;
}): Promise<OpportunityFeed> {
  const qs = new URLSearchParams();
  if (params?.latitude !== undefined) qs.set("latitude", String(params.latitude));
  if (params?.longitude !== undefined) qs.set("longitude", String(params.longitude));
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiFetch<OpportunityFeed>(`/v1/opportunities/feed${suffix}`);
}
// ─── Risk & Fraud ────────────────────────────────────────────────────────────

export interface RiskAlert {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  type: string;
  message: string;
  lot_id?: string | null;
  collector_id?: string | null;
  recycler_id?: string | null;
  risk_score: number;
  resolved: boolean;
  created_at: string;
}

export async function scanRisks(): Promise<{ total_alerts: number; alerts: RiskAlert[] }> {
  return apiFetch("/v1/risk/scan", { method: "POST" });
}

export async function listRiskAlerts(): Promise<RiskAlert[]> {
  return apiFetch<RiskAlert[]>("/v1/risk/alerts");
}

// ─── ML: Valuation ───────────────────────────────────────────────────────────

export interface Valuation {
  material: string;
  weight_kg: number;
  quality: "low" | "medium" | "high";
  fair_price_per_kg: number;
  fair_payout: number;
  confidence: number;
  method: string;
  reasoning: string;
}

export async function getValuation(input: {
  material: string;
  quality: "low" | "medium" | "high";
  weightKg: number;
}): Promise<Valuation> {
  return apiFetch<Valuation>("/v1/ml/valuation", {
    method: "POST",
    body: JSON.stringify({
      material: input.material,
      quality: input.quality,
      weight_kg: input.weightKg,
    }),
  });
}

// ─── Sync (offline batch) ────────────────────────────────────────────────────

export interface SyncItem {
  entity: "lot" | "handover" | "demand";
  entity_id: string;
  idempotency_key: string;
  payload: Record<string, unknown>;
  client_created_at?: string;
}

export interface SyncResultItem {
  entity: string;
  entity_id: string;
  idempotency_key: string;
  status: "APPLIED" | "DUPLICATE" | "CONFLICT" | "REJECTED";
  server_id?: string;
  message?: string;
}

export interface SyncResponse {
  device_id: string;
  accepted: number;
  duplicates: number;
  conflicts: number;
  rejected: number;
  results: SyncResultItem[];
}

export async function syncBatch(
  deviceId: string,
  items: SyncItem[]
): Promise<SyncResponse> {
  return apiFetch<SyncResponse>("/v1/sync/batch", {
    method: "POST",
    body: JSON.stringify({ device_id: deviceId, items }),
  });
}