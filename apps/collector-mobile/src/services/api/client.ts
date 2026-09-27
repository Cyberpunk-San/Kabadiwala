// src/services/api/client.ts
import { config } from "../../constants/config";
import type { Language, Material, MaterialPrediction, RecyclerOffer } from "../../types/domain";

/** Carries the HTTP status so callers can tell "not found" from "server down". */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/** True when the request never reached the server (offline, wrong IP, timeout). */
export function isNetworkError(err: unknown): boolean {
  return !(err instanceof ApiError);
}

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
      let detail = text || res.statusText;
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed?.detail === "string") detail = parsed.detail;
      } catch {
        // not JSON — keep raw text
      }
      throw new ApiError(res.status, detail);
    }

    return (await res.json()) as T;
  } catch (err: any) {
    if (err?.name === "AbortError" || String(err?.message ?? "").toLowerCase().includes("cancel")) {
      throw new Error(`Request timed out or was cancelled. Check backend at ${config.apiBaseUrl}`);
    }
    if (String(err?.message ?? "").toLowerCase().includes("network request failed")) {
      throw new Error(`Cannot reach backend at ${config.apiBaseUrl}. Start FastAPI and check Android network settings.`);
    }
    throw err;
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

// ─── Regional intelligence ───────────────────────────────────────────────────
export type HotspotReason = "SUPPLY" | "PICKUPS" | "DEMAND" | "INDUSTRY";

export interface RegionalOverview {
  latitude: number;
  longitude: number;
  radius_km: number;
  cell_deg: number;
  cells: Array<{ latitude: number; longitude: number; supply_kg: number; pickup_kg: number; pickups: number; demand_kg: number; recyclers: number; industry: number; score: number }>;
  hotspots: Array<{ latitude: number; longitude: number; score: number; reasons: HotspotReason[]; area?: string | null; distance_km: number }>;
  clusters: Array<{
    id: string; name: string; sector: string; sector_label: string; latitude: number; longitude: number; size: number;
    distance_km: number; value_per_kg: number; open_demand_kg: number; opportunity_score: number;
    materials: Array<{ material: Material; share: number; best_price_per_kg?: number | null }>;
  }>;
  balance: Array<{ material: Material; supply_kg: number; demand_kg: number; gap_kg: number; best_price_per_kg?: number | null }>;
  recyclers: Array<{ id: string; name: string; latitude: number; longitude: number }>;
  dataset: { name: string; approximate: boolean; clusters: number; retrieved_on?: string | null };
}

export interface PriceHeatmap {
  material: Material;
  step_lat: number;
  step_lon: number;
  cells: Array<{ latitude: number; longitude: number; best_net_per_kg?: number | null; best_recycler?: string | null }>;
  min_price?: number | null;
  max_price?: number | null;
}

export const getRegionalOverview = (latitude: number, longitude: number, radiusKm: number) =>
  apiFetch<RegionalOverview>(`/v1/regional/overview?latitude=${latitude}&longitude=${longitude}&radius_km=${radiusKm}`);

export const getPriceHeatmap = (material: Material, latitude: number, longitude: number, radiusKm: number) =>
  apiFetch<PriceHeatmap>(`/v1/regional/price-heatmap?material=${encodeURIComponent(material)}&latitude=${latitude}&longitude=${longitude}&radius_km=${radiusKm}`);

// ─── Business insights ───────────────────────────────────────────────────────
export type InsightCode = "UNDERPRICED" | "SWITCH_RECYCLER" | "SELL_STALE" | "POOL_SMALL_LOTS" | "NEW_DEMAND" | "BEST_DAY";

export interface CollectorInsights {
  sold_lots: number;
  sold_kg: number;
  earned: number;
  avg_per_kg: number;
  /** Earned as % of what today's best offers would have paid. */
  realised_percent: number;
  unsold_lots: number;
  unsold_value: number;
  underpriced: Array<{
    lot_id: string; material: Material; weight_kg: number; sold_per_kg: number; fair_per_kg: number;
    gap_percent: number; lost_inr: number; recycler_name: string; sold_at: string;
  }>;
  materials: Array<{ material: Material; kg: number; earned: number; sales: number; avg_per_kg: number; share_percent: number; realised_percent: number }>;
  recyclers: Array<{ recycler_id: string; recycler_name: string; sales: number; kg: number; earned: number; avg_per_kg: number }>;
  weekdays: Array<{ day: string; lots: number; kg: number }>;
  best_material?: Material | null;
  best_recycler?: string | null;
  suggestions: Array<{ code: InsightCode; impact_inr: number; params: Record<string, string | number> }>;
}

export const getCollectorInsights = (id: string) => apiFetch<CollectorInsights>(`/v1/collectors/${encodeURIComponent(id)}/insights`);

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
  const rows = await apiFetch<Array<{
    id: string; recycler_name: string; verified: boolean; rating: number;
    listed_price_per_kg: number; pickup_cost: number; handling_cost: number;
    platform_fee: number; distance_km: number; payment_reliability: number;
  }>>(`/v1/marketplace/offers?${qs}`);
  // Backend speaks snake_case; the app's RecyclerOffer is camelCase.
  return rows.map((r) => ({
    id: r.id,
    recyclerName: r.recycler_name,
    verified: r.verified,
    rating: r.rating,
    listedPricePerKg: r.listed_price_per_kg,
    pickupCost: r.pickup_cost,
    handlingCost: r.handling_cost,
    platformFee: r.platform_fee,
    distanceKm: r.distance_km,
    paymentReliability: r.payment_reliability,
  }));
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

export async function listMyLots(collectorId: string): Promise<RemoteLot[]> {
  return apiFetch<RemoteLot[]>(`/v1/lots?collector_id=${encodeURIComponent(collectorId)}`);
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
      recycler_id: input.recyclerId ?? "eco-cycle",
      recycler_name: input.recyclerName ?? null,
      audited_weight_kg: input.auditedWeightKg,
      agreed_payout: input.agreedPayout,
      payment_mode: input.paymentMode ?? "UPI",
    }),
  });
}

// ─── Vision ──────────────────────────────────────────────────────────────────
type RawPrediction = {
  material: Material; category: string; quality: "low" | "medium" | "high";
  hazard: boolean; confidence: number; safety_message?: string | null;
  alternatives?: Array<{ material: Material; confidence: number }>;
  source?: "huggingface" | "local" | "fallback";
};

/** Send the photo (base64 JPEG) to the backend AI. Never throws — returns confidence 0 on failure. */
export async function analyseMaterial(imageBase64: string): Promise<MaterialPrediction> {
  try {
    const r = await apiFetch<RawPrediction>("/v1/vision/analyze", {
      method: "POST",
      body: JSON.stringify({ image_base64: imageBase64 }),
    });
    return {
      material: r.material,
      category: r.category,
      quality: r.quality,
      hazard: r.hazard,
      confidence: r.confidence,
      safetyMessage: r.safety_message ?? undefined,
      alternatives: r.alternatives ?? [],
      source: r.source ?? "fallback",
    };
  } catch (err) {
    console.warn("[api] analyseMaterial failed:", err);
    return { material: "Mixed e-waste", category: "Electronics", quality: "low", hazard: false, confidence: 0, source: "fallback", alternatives: [] };
  }
}

// ─── Health ──────────────────────────────────────────────────────────────────
export interface HealthInfo {
  status: string;
  components: {
    vision_ai?: { huggingface_api?: string | null; local_clip?: boolean };
    ai_assistant?: { providers?: { huggingface?: string | null; gemini?: string | null } };
  };
}

export async function checkHealth(): Promise<HealthInfo> {
  // /health lives at the server root, not under /api.
  const root = config.apiBaseUrl.replace(/\/api$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${root}/health`, { signal: controller.signal });
    if (!res.ok) throw new ApiError(res.status, "health check failed");
    return (await res.json()) as HealthInfo;
  } finally {
    clearTimeout(timer);
  }
}

// ─── AI Assistant (agent) ────────────────────────────────────────────────────
export type AssistantActionType =
  | "open_market" | "open_scan" | "open_rates" | "open_demands" | "open_earnings" | "open_opportunity";

export interface AssistantAction { type: AssistantActionType; material?: Material | null; weight_kg?: number | null }
export interface AssistantReply {
  reply: string;
  provider: "huggingface" | "gemini" | "offline";
  suggestions: string[];
  actions: AssistantAction[];
  steps: Array<{ tool: string; summary: string }>;
}

export async function askAssistant(input: {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  language: Language;
  collectorId?: string;
  location?: { latitude: number; longitude: number };
}): Promise<AssistantReply> {
  return apiFetch<AssistantReply>("/v1/assistant/chat", {
    method: "POST",
    body: JSON.stringify({
      messages: input.messages,
      language: input.language,
      collector_id: input.collectorId ?? null,
      location: input.location ?? null,
    }),
  });
}

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
// ─── Accounts (all roles) ────────────────────────────────────────────────────
export type Role = "kabadiwala" | "household" | "company";

export interface HouseholdProfile {
  id: string; phone: string; name: string; language: Language;
  address?: string | null; latitude?: number | null; longitude?: number | null;
  created_at: string; total_pickups: number; total_received: number;
}

export interface CompanyProfile {
  id: string; phone: string; name: string; contact_name?: string | null;
  company_type: "buyer" | "seller" | "both"; gstin?: string | null; cpcb_license?: string | null;
  address?: string | null; latitude?: number | null; longitude?: number | null;
  approved: boolean; created_at: string; total_pickups: number;
}

export interface LoginResult {
  role: Role;
  collector?: CollectorProfile | null;
  household?: HouseholdProfile | null;
  company?: CompanyProfile | null;
}

/** Looks the phone up across all roles. Throws ApiError(404) for a new user. */
export async function loginAny(phone: string): Promise<LoginResult> {
  return apiFetch<LoginResult>("/v1/auth/login", { method: "POST", body: JSON.stringify({ phone }) });
}

export async function registerHousehold(input: {
  phone: string; name: string; language: Language; address?: string; latitude?: number; longitude?: number;
}): Promise<HouseholdProfile> {
  return apiFetch<HouseholdProfile>("/v1/households/register", { method: "POST", body: JSON.stringify(input) });
}

export async function registerCompany(input: {
  phone: string; name: string; contact_name?: string; company_type: CompanyProfile["company_type"];
  address?: string; latitude?: number; longitude?: number;
}): Promise<CompanyProfile> {
  return apiFetch<CompanyProfile>("/v1/companies/register", { method: "POST", body: JSON.stringify(input) });
}

export const getHousehold = (id: string) => apiFetch<HouseholdProfile>(`/v1/households/${id}`);
export const getCompany = (id: string) => apiFetch<CompanyProfile>(`/v1/companies/${id}`);

// ─── Pickup requests ─────────────────────────────────────────────────────────
export type PickupStatus = "OPEN" | "ACCEPTED" | "COMPLETED" | "CANCELLED";
export type PickupSlot = "morning" | "afternoon" | "evening" | "anytime";

export interface Pickup {
  id: string;
  requester_type: "household" | "company";
  requester_id: string;
  requester_name: string;
  requester_phone?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  material: Material;
  estimated_weight_kg: number;
  estimated_value: number;
  notes?: string | null;
  preferred_time?: string | null;
  /** YYYY-MM-DD */
  preferred_date?: string | null;
  preferred_slot?: PickupSlot | null;
  status: PickupStatus;
  collector_id?: string | null;
  collector_name?: string | null;
  collector_phone?: string | null;
  offered_price_per_kg?: number | null;
  actual_weight_kg?: number | null;
  amount_paid?: number | null;
  lot_id?: string | null;
  distance_km?: number | null;
  created_at: string;
  accepted_at?: string | null;
  completed_at?: string | null;
  pickup_pin?: string | null;
}

export async function createPickup(input: {
  requester_type: "household" | "company"; requester_id: string; material: Material;
  estimated_weight_kg: number; address?: string; latitude?: number; longitude?: number;
  notes?: string; preferred_time?: string; preferred_date?: string; preferred_slot?: PickupSlot;
}): Promise<Pickup> {
  return apiFetch<Pickup>("/v1/pickups", { method: "POST", body: JSON.stringify(input) });
}

export type DailyPriceRow = {
  material: Material; category: string; current_price: number; previous_price: number; change_percent: number;
  trend: "up" | "down" | "stable"; market_price: number; local_premium_pct: number;
  premium_reasons: Array<{ kind: "industry" | "buyers" | "demand"; label: string; detail: string; distance_km: number | null; pct: number }>;
  doorstep_price: number; basis: "live" | "rate_card" | "reference"; source: string; history_7d: number[];
  demand: "HIGH" | "MODERATE" | "LOW"; unit: string;
};
export type DailyPrices = {
  location: { latitude: number; longitude: number };
  market: { mode: "live" | "cached" | "reference"; fetched_at: string | null; usd_inr: number | null };
  prices: DailyPriceRow[];
};

/** Today's price for every material at this location (live metals / city rate cards + nearby-industry premium). */
export const getDailyPrices = (latitude: number, longitude: number) =>
  apiFetch<DailyPrices>(`/v1/prices/daily?latitude=${latitude}&longitude=${longitude}`);

export const listMyPickups = (requesterId: string) =>
  apiFetch<Pickup[]>(`/v1/pickups?requester_id=${encodeURIComponent(requesterId)}`);

/** Every open request, nearest first. Pass radiusKm only to drop the far ones (e.g. "near you" alerts). */
export const listNearbyPickups = (latitude: number, longitude: number, radiusKm?: number) =>
  apiFetch<Pickup[]>(`/v1/pickups?latitude=${latitude}&longitude=${longitude}${radiusKm ? `&radius_km=${radiusKm}` : ""}`);

export const listAcceptedPickups = (collectorId: string) =>
  apiFetch<Pickup[]>(`/v1/pickups?collector_id=${encodeURIComponent(collectorId)}`);

export const acceptPickup = (id: string, collectorId: string, offeredPricePerKg?: number) =>
  apiFetch<Pickup>(`/v1/pickups/${id}/accept`, {
    method: "POST",
    body: JSON.stringify({ collector_id: collectorId, offered_price_per_kg: offeredPricePerKg ?? null }),
  });

export const completePickup = (id: string, collectorId: string, pin: string, actualWeightKg: number) =>
  apiFetch<Pickup>(`/v1/pickups/${id}/complete`, {
    method: "POST",
    body: JSON.stringify({ collector_id: collectorId, pickup_pin: pin, actual_weight_kg: actualWeightKg }),
  });

export const reschedulePickup = (id: string, requesterId: string, preferredDate: string, preferredSlot: PickupSlot, preferredTime?: string) =>
  apiFetch<Pickup>(`/v1/pickups/${id}/schedule`, {
    method: "POST",
    body: JSON.stringify({ requester_id: requesterId, preferred_date: preferredDate, preferred_slot: preferredSlot, preferred_time: preferredTime ?? null }),
  });

export const cancelPickup = (id: string, requesterId: string) =>
  apiFetch<Pickup>(`/v1/pickups/${id}/cancel?requester_id=${encodeURIComponent(requesterId)}`, { method: "POST" });

/** Save the take-home amount once the collector picks a buyer for an existing lot. */
export const setLotOffer = (lotId: string, expectedNetEarnings: number) =>
  apiFetch<RemoteLot>(`/v1/lots/${lotId}/offer`, {
    method: "PATCH",
    body: JSON.stringify({ expected_net_earnings: expectedNetEarnings }),
  });

export const getPickup = (id: string, viewerId?: string) =>
  apiFetch<Pickup>(`/v1/pickups/${id}${viewerId ? `?viewer_id=${encodeURIComponent(viewerId)}` : ""}`);
