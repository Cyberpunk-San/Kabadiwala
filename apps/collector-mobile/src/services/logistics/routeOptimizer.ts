/**
 * src/services/logistics/routeOptimizer.ts
 *
 * Regional Intelligence + Logistics Engine.
 *
 * Features:
 *   A. findOptimalCluster()  — pick the best drop-off hub, not just nearest.
 *      Scoring: 40% material acceptance + 35% demand pressure + 25% distance penalty
 *
 *   B. batchAdvisory()       — "Wait for X kg before selling (saves ₹Y transport)"
 *      Uses diminishing-returns pickup cost model.
 *
 *   C. routeOptimizer()      — nearest-neighbor heuristic for multi-stop routes.
 *      Good for 3-5 stops; O(n²) but n is always small.
 *
 *   D. estimateETA()         — distance → time estimate with time-of-day factor.
 */

import type { Material } from "../../types/domain";
import { MATERIAL_METADATA } from "../../types/domain";
import { getAllBazarPrices } from "../../data/prices";
import {
  KNOWN_SCRAP_CLUSTERS,
  calculateDistanceKm,
  type GeoCoordinates,
  type ScrapCluster,
} from "../location/gpsService";

// ─── A: Optimal Cluster Finder ────────────────────────────────────────────────

// Which clusters specialize in which categories
const CLUSTER_MATERIAL_ACCEPTANCE: Record<string, string[]> = {
  "pune-bhosari":     ["Metals", "Electronics", "Heavy Scrap"],
  "mumbai-dharavi":   ["Metals", "Electronics", "Batteries", "Heavy Scrap"],
  "delhi-mayapuri":   ["Metals", "Heavy Scrap"],
  "bangalore-peenya": ["Electronics", "Metals", "Batteries"],
  "delhi-mandoli":    ["Electronics", "Batteries"],
};

// Demand pressure index by cluster (higher = more active buying)
const CLUSTER_DEMAND_PRESSURE: Record<string, number> = {
  "pune-bhosari":     0.75,
  "mumbai-dharavi":   1.00,
  "delhi-mayapuri":   0.85,
  "bangalore-peenya": 0.80,
  "delhi-mandoli":    0.90,
};

export interface ClusterScore {
  cluster: ScrapCluster;
  distanceKm: number;
  score: number;               // 0–100
  acceptsMaterial: boolean;
  demandPressure: number;      // 0–1
  reasoning: string;
  reasoningHi: string;
  reasoningMr: string;
  estimatedETAMinutes: number;
}

export function findOptimalCluster(
  material: Material,
  coords: GeoCoordinates
): ClusterScore[] {
  const meta = MATERIAL_METADATA[material];
  const prices = getAllBazarPrices();
  const priceItem = prices.find((p) => p.material === material);

  const results: ClusterScore[] = KNOWN_SCRAP_CLUSTERS.map((cluster) => {
    const distKm = calculateDistanceKm(
      coords.latitude, coords.longitude,
      cluster.latitude, cluster.longitude
    );

    const accepted = CLUSTER_MATERIAL_ACCEPTANCE[cluster.id] ?? [];
    const acceptsMaterial = accepted.includes(meta.category);
    const demandPressure = CLUSTER_DEMAND_PRESSURE[cluster.id] ?? 0.5;

    // Scoring model
    const acceptanceScore = acceptsMaterial ? 100 : 20;
    const demandScore = demandPressure * 100;
    // Travel cost dominates for a collector on a cycle/cart: 100 at the door,
    // ~37 at 25 km, ~0 beyond 100 km (a hub in another city can't win).
    const distanceScore = 100 * Math.exp(-distKm / 25);

    const score = Math.round(
      acceptanceScore * 0.30 +
      demandScore     * 0.20 +
      distanceScore   * 0.50
    );

    const eta = estimateETAMinutes(distKm);

    const reasoning =
      `${cluster.name} (${distKm.toFixed(1)} km): ` +
      (acceptsMaterial ? `Accepts ${meta.category}. ` : `May not specialise in ${meta.category}. `) +
      `Demand pressure: ${(demandPressure * 100).toFixed(0)}%. ` +
      `ETA ~${eta} min. Score: ${score}/100.`;

    const reasoningHi =
      `${cluster.name} (${distKm.toFixed(1)} किमी दूर): ` +
      (acceptsMaterial ? `${meta.category} स्वीकार करता है। ` : ``) +
      `मांग दबाव: ${(demandPressure * 100).toFixed(0)}%। ` +
      `अनुमानित समय: ~${eta} मिनट।`;

    const reasoningMr =
      `${cluster.name} (${distKm.toFixed(1)} किमी): ` +
      (acceptsMaterial ? `${meta.category} स्वीकारतो. ` : ``) +
      `मागणी दबाव: ${(demandPressure * 100).toFixed(0)}%. ` +
      `अंदाजे वेळ: ~${eta} मिनिटे.`;

    return {
      cluster,
      distanceKm: Math.round(distKm * 10) / 10,
      score,
      acceptsMaterial,
      demandPressure,
      reasoning,
      reasoningHi,
      reasoningMr,
      estimatedETAMinutes: eta,
    };
  });

  return results.sort((a, b) => b.score - a.score);
}

// ─── B: Batch Advisory ────────────────────────────────────────────────────────

export interface BatchAdvisory {
  currentWeightKg: number;
  recommendedWeightKg: number;
  waitDays: number;
  estimatedExtraSavingsRs: number;
  advice: string;
  adviceHi: string;
  adviceMr: string;
  shouldWait: boolean;
}

// Pickup cost model: has a fixed cost + per-kg variable
// Fixed cost amortizes over larger batches
const PICKUP_FIXED_COST = 120;    // ₹120 auto-rickshaw / tempo base
const PICKUP_VARIABLE_PER_KM = 8; // ₹8/km

export function batchAdvisory(
  material: Material,
  currentWeightKg: number,
  distanceToClusterKm: number,
  dailyCollectionRateKg: number = 5
): BatchAdvisory {
  const prices = getAllBazarPrices();
  const priceItem = prices.find((p) => p.material === material);
  const pricePerKg = priceItem?.currentPrice ?? MATERIAL_METADATA[material].basePricePerKg;

  // Pickup cost at current weight
  const totalPickupCostNow = PICKUP_FIXED_COST + PICKUP_VARIABLE_PER_KM * distanceToClusterKm;
  const netPerKgNow = pricePerKg - totalPickupCostNow / currentWeightKg;

  // Find optimal weight where marginal pickup cost per kg is below 3% of price
  let optimalKg = currentWeightKg;
  for (let kg = currentWeightKg; kg <= currentWeightKg + dailyCollectionRateKg * 7; kg += 1) {
    const costPerKg = totalPickupCostNow / kg;
    if (costPerKg / pricePerKg < 0.03) {
      optimalKg = kg;
      break;
    }
    optimalKg = kg;
  }

  const netPerKgOptimal = pricePerKg - totalPickupCostNow / optimalKg;
  const extraSavingsPerKg = Math.max(0, netPerKgOptimal - netPerKgNow);
  const estimatedExtraSavingsRs = Math.round(extraSavingsPerKg * optimalKg);
  const waitDays = Math.ceil((optimalKg - currentWeightKg) / dailyCollectionRateKg);

  const shouldWait = estimatedExtraSavingsRs > 100 && waitDays <= 5;

  const advice = shouldWait
    ? `You have ${currentWeightKg} kg. Waiting ${waitDays} more day${waitDays > 1 ? "s" : ""} ` +
      `for ${optimalKg} kg saves ~₹${estimatedExtraSavingsRs} on transport costs.`
    : `${currentWeightKg} kg is a good batch size. Sell now.`;

  const adviceHi = shouldWait
    ? `आपके पास ${currentWeightKg} किलो है। ${waitDays} दिन और रुककर ${optimalKg} किलो करने से ` +
      `परिवहन खर्च में ~₹${estimatedExtraSavingsRs} की बचत होगी।`
    : `${currentWeightKg} किलो का लॉट अच्छा है। अभी बेचें।`;

  const adviceMr = shouldWait
    ? `तुमच्याकडे ${currentWeightKg} किलो आहे. आणखी ${waitDays} दिवस थांबून ${optimalKg} किलो केल्यास ` +
      `वाहतूक खर्चात ~₹${estimatedExtraSavingsRs} बचत होईल.`
    : `${currentWeightKg} किलोचा लॉट चांगला आहे. आत्ता विका.`;

  return {
    currentWeightKg,
    recommendedWeightKg: optimalKg,
    waitDays,
    estimatedExtraSavingsRs,
    advice,
    adviceHi,
    adviceMr,
    shouldWait,
  };
}

// ─── C: Multi-stop Route Optimizer (Nearest-Neighbor Heuristic) ───────────────

export interface RouteStop {
  id: string;
  label: string;
  coords: GeoCoordinates;
  material?: Material;
  weightKg?: number;
}

export interface OptimizedRoute {
  stops: RouteStop[];
  totalDistanceKm: number;
  estimatedTotalMinutes: number;
  estimatedFuelCostRs: number;
  savingsVsNaiveRs: number;
}

/** ₹8/km fuel cost */
const FUEL_COST_PER_KM = 8;

export function optimizeRoute(
  startCoords: GeoCoordinates,
  stops: RouteStop[]
): OptimizedRoute {
  if (stops.length === 0) {
    return { stops: [], totalDistanceKm: 0, estimatedTotalMinutes: 0, estimatedFuelCostRs: 0, savingsVsNaiveRs: 0 };
  }

  // Nearest-neighbor from start
  const remaining = [...stops];
  const route: RouteStop[] = [];
  let current = startCoords;
  let totalDist = 0;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = calculateDistanceKm(
        current.latitude, current.longitude,
        remaining[i]!.coords.latitude, remaining[i]!.coords.longitude
      );
      if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
    }
    const next = remaining.splice(nearestIdx, 1)[0]!;
    route.push(next);
    totalDist += nearestDist;
    current = next.coords;
  }

  // Naive distance (fixed order)
  let naiveDist = 0;
  let cur = startCoords;
  for (const stop of stops) {
    naiveDist += calculateDistanceKm(cur.latitude, cur.longitude, stop.coords.latitude, stop.coords.longitude);
    cur = stop.coords;
  }
  const savedDist = Math.max(0, naiveDist - totalDist);
  const savingsVsNaiveRs = Math.round(savedDist * FUEL_COST_PER_KM);

  return {
    stops: route,
    totalDistanceKm: Math.round(totalDist * 10) / 10,
    estimatedTotalMinutes: estimateETAMinutes(totalDist),
    estimatedFuelCostRs: Math.round(totalDist * FUEL_COST_PER_KM),
    savingsVsNaiveRs,
  };
}

// ─── D: ETA Estimator ─────────────────────────────────────────────────────────

// Average speed by time-of-day bucket (urban Indian roads)
const SPEED_BY_HOUR: Record<number, number> = {
  0: 40, 1: 42, 2: 44, 3: 44, 4: 42, 5: 38,
  6: 28, 7: 22, 8: 18, 9: 24, 10: 30, 11: 32,
  12: 28, 13: 30, 14: 32, 15: 28, 16: 22, 17: 18,
  18: 20, 19: 25, 20: 30, 21: 35, 22: 38, 23: 40,
};

export function estimateETAMinutes(distKm: number, atHour?: number): number {
  const hour = atHour ?? new Date().getHours();
  const speed = SPEED_BY_HOUR[hour] ?? 30;
  return Math.round((distKm / speed) * 60);
}
