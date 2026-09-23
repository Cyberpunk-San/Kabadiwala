/**
 * src/services/ai/demandOffers.ts
 *
 * Local intelligent offer generation engine.
 * Fixes the runtime crash caused by removal of demoOffers from client.ts.
 *
 * Generates realistic RecyclerOffer[] seeded from BAZAR_PRICES base price +
 * stochastic per-recycler variation. Distances are computed via Haversine
 * against KNOWN_SCRAP_CLUSTERS.
 *
 * Also provides localDemands() for DemandsScreen when backend is offline.
 */

import type { Material, RecyclerOffer } from "../../types/domain";
import { MATERIAL_METADATA } from "../../types/domain";
import { getAllBazarPrices } from "../../data/prices";
import {
  KNOWN_SCRAP_CLUSTERS,
  calculateDistanceKm,
  type GeoCoordinates,
} from "../location/gpsService";

// ─── Recycler roster (demo-grade but realistic) ────────────────────────────────
interface RecyclerProfile {
  id: string;
  name: string;
  verified: boolean;
  rating: number;
  paymentReliability: number;
  clusterIds: string[];         // which clusters this recycler operates
  categorySpecialty: string[];  // preferred material categories
  platformFeePct: number;       // platform fee as % of gross
  handlingFeePerKg: number;
}

const RECYCLERS: RecyclerProfile[] = [
  {
    id: "REC-ECOCYCLE-01",
    name: "EcoCycle Recyclers Pvt Ltd",
    verified: true, rating: 4.7, paymentReliability: 0.97,
    clusterIds: ["pune-bhosari", "mumbai-dharavi"],
    categorySpecialty: ["Electronics", "Metals"],
    platformFeePct: 0.04, handlingFeePerKg: 2.0
  },
  {
    id: "REC-GREENTEK-02",
    name: "GreenTek E-Waste Solutions",
    verified: true, rating: 4.5, paymentReliability: 0.95,
    clusterIds: ["pune-bhosari", "bangalore-peenya"],
    categorySpecialty: ["Electronics", "Batteries"],
    platformFeePct: 0.035, handlingFeePerKg: 2.5
  },
  {
    id: "REC-METALMAX-03",
    name: "MetalMax Scrap Industries",
    verified: true, rating: 4.2, paymentReliability: 0.92,
    clusterIds: ["mumbai-dharavi", "delhi-mayapuri"],
    categorySpecialty: ["Metals", "Heavy Scrap"],
    platformFeePct: 0.05, handlingFeePerKg: 1.5
  },
  {
    id: "REC-PRITHVI-04",
    name: "Prithvi Recycling Hub",
    verified: false, rating: 3.8, paymentReliability: 0.80,
    clusterIds: ["delhi-mandoli", "delhi-mayapuri"],
    categorySpecialty: ["Electronics", "Batteries", "Metals"],
    platformFeePct: 0.06, handlingFeePerKg: 3.0
  },
  {
    id: "REC-HARITAM-05",
    name: "Haritam Waste Management",
    verified: true, rating: 4.6, paymentReliability: 0.96,
    clusterIds: ["bangalore-peenya"],
    categorySpecialty: ["Heavy Scrap", "Metals"],
    platformFeePct: 0.03, handlingFeePerKg: 1.8
  },
];

// ─── Deterministic seeded pseudo-random (for reproducible offers) ─────────────

function seededRand(seed: number, index: number): number {
  const x = Math.sin(seed * 127 + index * 31) * 43758.5453;
  return x - Math.floor(x);
}

function hashMaterial(material: string): number {
  let h = 0;
  for (let i = 0; i < material.length; i++) {
    h = ((h << 5) - h + material.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ─── Main: generate offers ─────────────────────────────────────────────────────

/**
 * Generate realistic recycler offers for a given material + weight.
 * If coords are provided, distances are computed using Haversine.
 * Results are sorted by net earnings (best first).
 */
export function localOffers(
  material: Material,
  weightKg: number,
  coords?: GeoCoordinates
): RecyclerOffer[] {
  const prices = getAllBazarPrices();
  const priceItem = prices.find((p) => p.material === material);
  const meta = MATERIAL_METADATA[material];
  const basePrice = priceItem?.currentPrice ?? meta.basePricePerKg;

  const seed = hashMaterial(material);
  const offers: RecyclerOffer[] = [];

  // Default coords: Pune (for demo)
  const defaultCoords: GeoCoordinates = { latitude: 18.5204, longitude: 73.8567 };
  const effectiveCoords = coords ?? defaultCoords;

  for (let i = 0; i < RECYCLERS.length; i++) {
    const rec = RECYCLERS[i]!;

    // Only include recyclers that handle this material category
    const handles = rec.categorySpecialty.includes(meta.category) ||
                    rec.categorySpecialty.includes("Electronics"); // catch-all
    if (!handles && i > 1) continue; // always include first 2 for diversity

    // Price variation: ±6% stochastic around base (specialty recyclers pay slightly more)
    const specialtyBoost = rec.categorySpecialty.includes(meta.category) ? 1.03 : 1.0;
    const randVariation = 0.94 + seededRand(seed, i) * 0.12; // ±6%
    const listedPricePerKg = Math.round(basePrice * randVariation * specialtyBoost);

    // Pickup cost: based on distance to nearest cluster this recycler serves
    let minDistKm = 5.0;
    for (const clusterId of rec.clusterIds) {
      const cluster = KNOWN_SCRAP_CLUSTERS.find((c) => c.id === clusterId);
      if (cluster) {
        const d = calculateDistanceKm(
          effectiveCoords.latitude, effectiveCoords.longitude,
          cluster.latitude, cluster.longitude
        );
        if (d < minDistKm) minDistKm = d;
      }
    }
    const pickupCost = Math.round(Math.max(50, minDistKm * 8)); // ₹8/km

    // Handling + platform fee
    const handlingCost = Math.round(rec.handlingFeePerKg * weightKg);
    const gross = listedPricePerKg * weightKg;
    const platformFee = Math.round(gross * rec.platformFeePct);

    offers.push({
      id: rec.id,
      recyclerName: rec.name,
      verified: rec.verified,
      rating: rec.rating,
      listedPricePerKg,
      pickupCost,
      handlingCost,
      platformFee,
      distanceKm: Math.round(minDistKm * 10) / 10,
      paymentReliability: rec.paymentReliability,
    });
  }

  // Sort by net earnings
  return offers
    .map((o) => ({
      ...o,
      _net: o.listedPricePerKg * weightKg - o.pickupCost - o.handlingCost - o.platformFee,
    }))
    .sort((a, b) => (b as any)._net - (a as any)._net)
    .map(({ _net, ...o }) => o);
}

// ─── Local demands (for DemandsScreen offline fallback) ───────────────────────

export interface LocalDemand {
  id: string;
  recycler_id: string;
  recycler_name: string;
  material: Material;
  quality_required: "low" | "medium" | "high";
  quantity_kg: number;
  offered_price_per_kg: number;
  deadline: string;
  hub: string;
  latitude: number;
  longitude: number;
  notes: string;
  status: "OPEN" | "PARTIAL" | "FULFILLED" | "EXPIRED";
  filled_kg: number;
  created_at: string;
  match_count: number;
  hours_remaining: number;
}

export function localDemands(): LocalDemand[] {
  const prices = getAllBazarPrices();
  const now = new Date();

  // Generate demands for the top 6 materials by price
  const topPrices = [...prices].sort((a, b) => b.currentPrice - a.currentPrice).slice(0, 6);

  return topPrices.map((p, i) => {
    const rec = RECYCLERS[i % RECYCLERS.length]!;
    const cluster = KNOWN_SCRAP_CLUSTERS[i % KNOWN_SCRAP_CLUSTERS.length]!;
    const seed = hashMaterial(p.material);
    const quantityKg = [250, 500, 180, 350, 120, 400][i] ?? 200;
    const filledFraction = seededRand(seed, i + 10) * 0.6; // 0–60% filled
    const hoursLeft = 24 + seededRand(seed, i + 20) * 120; // 24–144h
    const deadline = new Date(now.getTime() + hoursLeft * 3600_000);

    return {
      id: `DEMAND-${rec.id}-${p.id}`,
      recycler_id: rec.id,
      recycler_name: rec.name,
      material: p.material,
      quality_required: (["medium", "high", "medium", "low", "high", "medium"] as const)[i] ?? "medium",
      quantity_kg: quantityKg,
      offered_price_per_kg: Math.round(p.currentPrice * (1 + seededRand(seed, i + 30) * 0.06)),
      deadline: deadline.toISOString(),
      hub: cluster.name,
      latitude: cluster.latitude,
      longitude: cluster.longitude,
      notes: p.demand === "HIGH"
        ? `Urgent procurement for Q4 EPR compliance. Preferred: certified collectors.`
        : `Regular batch purchase. Monthly clearing rate applies.`,
      status: "OPEN" as const,
      filled_kg: Math.round(quantityKg * filledFraction),
      created_at: new Date(now.getTime() - seededRand(seed, i) * 48 * 3600_000).toISOString(),
      match_count: Math.floor(seededRand(seed, i + 40) * 8),
      hours_remaining: Math.round(hoursLeft),
    };
  });
}
