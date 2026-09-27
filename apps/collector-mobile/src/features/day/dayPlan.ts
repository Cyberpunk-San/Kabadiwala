/**
 * What a kabadiwala should do next.
 *
 * Accepted doorsteps become a short route (nearest neighbour from where they
 * are). Unsold stock gets one call — sell, hold, or collect a bit more —
 * from this week's price move minus a small holding cost.
 */
import type { Material } from "../../types/domain";
import { calculateDistanceKm } from "../../services/location/gpsService";
import { optimizeRoute, type RouteStop } from "../../services/logistics/routeOptimizer";

export type PlanPoint = { latitude: number; longitude: number };

export type RouteJob = {
  id: string;
  label: string;
  material: Material;
  weightKg: number;
  valueRs: number;
  latitude: number;
  longitude: number;
};

export type PlannedStop = RouteJob & { order: number; legKm: number };

export type PlannedRoute = {
  stops: PlannedStop[];
  totalDistanceKm: number;
  estimatedTotalMinutes: number;
  estimatedFuelCostRs: number;
  /** Fuel saved against riding the jobs in the order they were accepted. */
  savingsVsNaiveRs: number;
  mapsUrl: string;
};

/** A pickup the API already knows about. Missing coordinates cannot be routed. */
export function pickupToJob(p: {
  id: string;
  requester_name?: string | null;
  address?: string | null;
  material: Material;
  estimated_weight_kg: number;
  estimated_value: number;
  latitude?: number | null;
  longitude?: number | null;
}): RouteJob | null {
  if (p.latitude == null || p.longitude == null) return null;
  if (!Number.isFinite(p.latitude) || !Number.isFinite(p.longitude)) return null;
  return {
    id: p.id,
    label: (p.requester_name || p.address || p.material).trim(),
    material: p.material,
    weightKg: p.estimated_weight_kg,
    valueRs: Math.round(p.estimated_value || 0),
    latitude: p.latitude,
    longitude: p.longitude,
  };
}

export function planRoute(start: PlanPoint, jobs: RouteJob[]): PlannedRoute | null {
  if (!jobs.length) return null;
  const asStops: RouteStop[] = jobs.map((j) => ({
    id: j.id,
    label: j.label,
    coords: { latitude: j.latitude, longitude: j.longitude },
    material: j.material,
    weightKg: j.weightKg,
  }));
  const optimized = optimizeRoute(start, asStops);
  const byId = new Map(jobs.map((j) => [j.id, j]));

  let cursor = start;
  const stops: PlannedStop[] = [];
  for (const stop of optimized.stops) {
    const job = byId.get(stop.id);
    if (!job) continue;
    const legKm = calculateDistanceKm(cursor.latitude, cursor.longitude, job.latitude, job.longitude);
    cursor = { latitude: job.latitude, longitude: job.longitude };
    stops.push({ ...job, order: stops.length + 1, legKm });
  }
  if (!stops.length) return null;

  return {
    stops,
    totalDistanceKm: optimized.totalDistanceKm,
    estimatedTotalMinutes: optimized.estimatedTotalMinutes,
    estimatedFuelCostRs: optimized.estimatedFuelCostRs,
    savingsVsNaiveRs: optimized.savingsVsNaiveRs,
    mapsUrl: mapsDirectionsUrl(start, stops),
  };
}

/** The door after this one on the route. Null when this stop is last or not on the route. */
export function nextAfter(route: PlannedRoute, currentId: string): PlannedStop | null {
  const index = route.stops.findIndex((s) => s.id === currentId);
  if (index < 0) return null;
  return route.stops[index + 1] ?? null;
}

/** Google Maps directions for a two-wheeler / tempo following the roads. */
export function mapsDirectionsUrl(start: PlanPoint, stops: PlanPoint[]): string {
  if (!stops.length) return "";
  const dest = stops[stops.length - 1]!;
  const via = stops.slice(0, -1);
  const q = new URLSearchParams({
    api: "1",
    origin: `${start.latitude},${start.longitude}`,
    destination: `${dest.latitude},${dest.longitude}`,
    travelmode: "driving",
  });
  if (via.length) q.set("waypoints", via.map((s) => `${s.latitude},${s.longitude}`).join("|"));
  return `https://www.google.com/maps/dir/?${q.toString()}`;
}

export type Detour = { job: RouteJob; detourKm: number; nearStop: number };

/** An open request that sits close to a stop already on today's route. */
export function alongTheWay(route: PlannedRoute, open: RouteJob[], maxDetourKm = 2.5): Detour | null {
  const onRoute = new Set(route.stops.map((s) => s.id));
  let best: (Detour & { score: number }) | null = null;
  for (const job of open) {
    if (onRoute.has(job.id)) continue;
    let detourKm = Infinity;
    let nearStop = 1;
    for (const stop of route.stops) {
      const d = calculateDistanceKm(stop.latitude, stop.longitude, job.latitude, job.longitude);
      if (d < detourKm) {
        detourKm = d;
        nearStop = stop.order;
      }
    }
    if (detourKm > maxDetourKm) continue;
    const score = job.valueRs / (1 + detourKm);
    if (!best || score > best.score) best = { job, detourKm, nearStop, score };
  }
  if (!best) return null;
  return { job: best.job, detourKm: best.detourKm, nearStop: best.nearStop };
}

/** Best open doorstep by rupees per kilometre, inside a rideable radius. */
export function bestOpenPickup(start: PlanPoint, open: RouteJob[], maxKm = 25): (RouteJob & { distanceKm: number }) | null {
  let best: (RouteJob & { distanceKm: number; score: number }) | null = null;
  for (const job of open) {
    const distanceKm = calculateDistanceKm(start.latitude, start.longitude, job.latitude, job.longitude);
    if (distanceKm > maxKm || job.valueRs <= 0) continue;
    const score = job.valueRs / Math.max(distanceKm, 0.3);
    if (!best || score > best.score) best = { ...job, distanceKm, score };
  }
  if (!best) return null;
  const { score: _score, ...job } = best;
  return job;
}

export type StockLot = {
  material: Material;
  weightKg: number;
  status: string;
  createdAt: string;
  expectedNetEarnings?: number;
};

export type PriceSnap = { material: Material; currentPrice: number; changePercent: number };

export type StockAdvice = {
  action: "SELL_NOW" | "HOLD" | "AGGREGATE";
  reason: "falling" | "stale" | "rising" | "small_batch";
  material: Material;
  weightKg: number;
  valueRs: number;
  /** This week's price move, percent. */
  pct: number;
  ageDays: number;
  targetKg?: number;
  saveRs?: number;
};

/** ₹2/kg/day for space and cash that could be working. A yard trip is ~₹180. */
const HOLDING_PER_KG_DAY = 2;
const YARD_TRIP_RS = 180;
const FULL_LOAD_KG = 25;

/**
 * One call for unsold stock. The rupee at stake decides: a falling price or
 * stock sitting past a week means sell; a rise that beats holding cost means
 * wait; a small pile means collect more before paying for the trip.
 */
export function adviseStock(lots: StockLot[], prices: PriceSnap[], now = Date.now()): StockAdvice | null {
  const priceOf = new Map(prices.map((p) => [p.material, p]));
  const groups = new Map<Material, { kg: number; value: number; oldest: number }>();

  for (const lot of lots) {
    if (lot.status === "PAID" || lot.weightKg <= 0) continue;
    const price = priceOf.get(lot.material);
    const value = lot.expectedNetEarnings && lot.expectedNetEarnings > 0
      ? lot.expectedNetEarnings
      : (price?.currentPrice ?? 0) * lot.weightKg;
    const created = new Date(lot.createdAt).getTime();
    const age = Number.isFinite(created) ? Math.max(0, (now - created) / 86_400_000) : 0;
    const g = groups.get(lot.material) ?? { kg: 0, value: 0, oldest: 0 };
    g.kg += lot.weightKg;
    g.value += value;
    g.oldest = Math.max(g.oldest, age);
    groups.set(lot.material, g);
  }

  let best: StockAdvice | null = null;
  let bestImpact = 0;
  const consider = (advice: StockAdvice, impact: number) => {
    if (impact >= 40 && impact > bestImpact) {
      bestImpact = impact;
      best = advice;
    }
  };

  for (const [material, g] of groups) {
    const pct = priceOf.get(material)?.changePercent ?? 0;
    const kg = Math.round(g.kg * 10) / 10;
    const valueRs = Math.round(g.value);
    const ageDays = Math.floor(g.oldest);
    const holdingWeek = HOLDING_PER_KG_DAY * kg * 7;
    const weekMove = valueRs * (pct / 100);
    const base = { material, weightKg: kg, valueRs, pct, ageDays };

    if (pct <= -1) {
      consider({ ...base, action: "SELL_NOW", reason: "falling" }, Math.abs(weekMove));
    }
    if (ageDays >= 7) {
      consider({ ...base, action: "SELL_NOW", reason: "stale" }, Math.min(valueRs, holdingWeek * (ageDays / 7)));
    }
    if (pct >= 2 && ageDays < 7) {
      const net = weekMove - holdingWeek;
      if (net > 0) consider({ ...base, action: "HOLD", reason: "rising" }, net);
    }
    if (kg < 12 && ageDays < 6 && pct > -1) {
      const saveRs = Math.round(YARD_TRIP_RS * (1 - kg / FULL_LOAD_KG));
      if (saveRs > 80) {
        consider({ ...base, action: "AGGREGATE", reason: "small_batch", targetKg: FULL_LOAD_KG, saveRs }, saveRs);
      }
    }
  }
  return best;
}

export type DayPlan = {
  route: PlannedRoute | null;
  along: Detour | null;
  nearby: (RouteJob & { distanceKm: number }) | null;
  stock: StockAdvice | null;
};

export function buildDayPlan(input: {
  start: PlanPoint;
  accepted: RouteJob[];
  open: RouteJob[];
  lots: StockLot[];
  prices: PriceSnap[];
  now?: number;
}): DayPlan {
  const route = planRoute(input.start, input.accepted);
  return {
    route,
    along: route ? alongTheWay(route, input.open) : null,
    nearby: route ? null : bestOpenPickup(input.start, input.open),
    stock: adviseStock(input.lots, input.prices, input.now),
  };
}
