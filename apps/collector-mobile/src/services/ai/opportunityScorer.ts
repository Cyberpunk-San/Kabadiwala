/**
 * src/services/ai/opportunityScorer.ts
 *
 * Multi-factor ML opportunity scoring engine.
 * Replaces editorial changePercent-based ranking with a
 * composite score (0–100) across 5 independent signals.
 *
 * Score = price_momentum × 0.30
 *       + demand_urgency × 0.25
 *       + capacity_match × 0.20
 *       + logistics_net  × 0.15
 *       + scarcity_prem  × 0.10
 *
 * All signals are normalized to [0, 100] before weighting.
 */

import type { Material } from "../../types/domain";
import { MATERIAL_METADATA } from "../../types/domain";
import { getAllBazarPrices } from "../../data/prices";
import type { BazarPriceItem } from "../../types/domain";

// ─── Weights ──────────────────────────────────────────────────────────────────
const W_MOMENTUM = 0.30;
const W_URGENCY  = 0.25;
const W_CAPACITY = 0.20;
const W_LOGISTICS = 0.15;
const W_SCARCITY  = 0.10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** OLS slope of price over 7 days */
function priceSlope(history: { price: number }[]): number {
  const n = history.length;
  if (n < 2) return 0;
  const xs = history.map((_, i) => i);
  const ys = history.map((d) => d.price);
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i]! - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  return den === 0 ? 0 : num / den;
}

/** Coefficient of variation (spread / mean) */
function priceCV(history: { price: number }[]): number {
  if (history.length < 2) return 0;
  const prices = history.map((d) => d.price);
  const mean = prices.reduce((s, p) => s + p, 0) / prices.length;
  const variance = prices.reduce((s, p) => s + (p - mean) ** 2, 0) / prices.length;
  return Math.sqrt(variance) / (mean || 1);
}

/** Normalize a value from [min, max] to [0, 100] */
function norm(val: number, min: number, max: number): number {
  if (max === min) return 50;
  return Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
}

// ─── Scoring signals ──────────────────────────────────────────────────────────

function scoreMomentum(item: BazarPriceItem): number {
  // Positive slope normalized. Max plausible slope: 20/day. Min: -20/day.
  const slope = priceSlope(item.history7Days);
  return norm(slope, -20, 20);
}

function scoreUrgency(item: BazarPriceItem): number {
  // Demand: HIGH → 100, MODERATE → 60, LOW → 20
  // Also factor in changePercent as proxy for time pressure
  const demandBase = item.demand === "HIGH" ? 100 : item.demand === "MODERATE" ? 60 : 20;
  // If price is rising fast, urgency goes up
  const momentumBoost = Math.max(0, item.changePercent * 2);
  return Math.min(100, demandBase + momentumBoost);
}

function scoreCapacityMatch(item: BazarPriceItem): number {
  // Heavier materials (iron, aluminium) require truck capacity → lower score
  // unless collector handles heavy scrap. Light + high-value = best capacity match.
  const meta = MATERIAL_METADATA[item.material];
  const pricePerKg = item.currentPrice;
  // High price/kg = better value density = better capacity match for solo collectors
  return norm(pricePerKg, 18, 620);
}

function scoreLogisticsNet(item: BazarPriceItem): number {
  // Estimate logistics cost as function of weight class and category
  // Electronics / batteries → small & light → low logistics cost → high net
  const meta = MATERIAL_METADATA[item.material];
  const logisticsCostIndex =
    meta.category === "Electronics" ? 10 :
    meta.category === "Batteries"   ? 15 :
    meta.category === "Metals"      ? 25 :
    /* Heavy Scrap */                 40;
  // Net quality = price × density proxy
  const netScore = (item.currentPrice - logisticsCostIndex) / (item.currentPrice || 1) * 100;
  return Math.max(0, Math.min(100, netScore));
}

function scoreScarcity(item: BazarPriceItem): number {
  // High CV → volatile/scarce → premium opportunity
  const cv = priceCV(item.history7Days);
  return norm(cv, 0, 0.15);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface OpportunityScore {
  material: Material;
  score: number;                  // 0–100
  rank: number;
  currentPricePerKg: number;
  fairPricePerKg: number;
  signals: {
    momentum: number;             // 0–100
    urgency: number;
    capacityMatch: number;
    logisticsNet: number;
    scarcityPremium: number;
  };
  grade: "S" | "A" | "B" | "C" | "D";
  reasoning: string;
  reasoningHi: string;
  reasoningMr: string;
  trend: "up" | "down" | "stable";
  demand: "HIGH" | "MODERATE" | "LOW";
  changePercent: number;
  isHazard: boolean;
}

function gradeFromScore(score: number): "S" | "A" | "B" | "C" | "D" {
  if (score >= 80) return "S";
  if (score >= 65) return "A";
  if (score >= 50) return "B";
  if (score >= 35) return "C";
  return "D";
}

function buildReasoning(item: BazarPriceItem, signals: OpportunityScore["signals"], score: number, lang: "en" | "hi" | "mr"): string {
  const meta = MATERIAL_METADATA[item.material];
  const price = item.currentPrice;
  const demand = item.demand;
  const trend = item.trend;

  const materialName =
    lang === "hi" ? meta.hindi :
    lang === "mr" ? meta.marathi :
    item.material;

  if (lang === "hi") {
    return (
      `${materialName} आज का स्कोर: ${score}/100. ` +
      `मांग ${demand === "HIGH" ? "उच्च" : demand === "MODERATE" ? "सामान्य" : "कम"} है, ` +
      `भाव ${trend === "up" ? "बढ़ रहा" : trend === "down" ? "घट रहा" : "स्थिर"} है (₹${price}/किलो). ` +
      (signals.momentum > 65 ? "मूल्य गति मजबूत है। " : "") +
      (signals.urgency > 70 ? "तुरंत बेचें — मांग अधिक है। " : "")
    );
  }
  if (lang === "mr") {
    return (
      `${materialName} आजचा स्कोर: ${score}/100. ` +
      `मागणी ${demand === "HIGH" ? "जास्त" : demand === "MODERATE" ? "सामान्य" : "कमी"} आहे, ` +
      `दर ${trend === "up" ? "वाढत" : trend === "down" ? "घसरत" : "स्थिर"} आहे (₹${price}/किलो). ` +
      (signals.urgency > 70 ? "लवकर विका — मागणी अधिक आहे. " : "")
    );
  }
  // English
  return (
    `${item.material} opportunity score: ${score}/100. ` +
    `Demand is ${demand.toLowerCase()}, price is ${trend === "up" ? "rising" : trend === "down" ? "falling" : "stable"} at ₹${price}/kg. ` +
    (signals.momentum > 65 ? "Strong price momentum. " : "") +
    (signals.urgency > 70 ? "High urgency — sell soon. " : "") +
    (signals.scarcityPremium > 60 ? "Scarcity premium detected. " : "")
  );
}

/**
 * Score and rank all materials by composite ML opportunity score.
 * @param collectorWeightCapacityKg - optional: adjusts capacity_match signal
 */
export function scoreAllOpportunities(
  collectorWeightCapacityKg?: number
): OpportunityScore[] {
  const prices = getAllBazarPrices();

  const scored = prices.map((item) => {
    const signals = {
      momentum:       Math.round(scoreMomentum(item)),
      urgency:        Math.round(scoreUrgency(item)),
      capacityMatch:  Math.round(scoreCapacityMatch(item)),
      logisticsNet:   Math.round(scoreLogisticsNet(item)),
      scarcityPremium: Math.round(scoreScarcity(item)),
    };

    const rawScore =
      signals.momentum       * W_MOMENTUM +
      signals.urgency        * W_URGENCY  +
      signals.capacityMatch  * W_CAPACITY +
      signals.logisticsNet   * W_LOGISTICS +
      signals.scarcityPremium * W_SCARCITY;

    const score = Math.round(rawScore);
    const meta = MATERIAL_METADATA[item.material];

    return {
      material: item.material,
      score,
      rank: 0,       // set after sorting
      currentPricePerKg: item.currentPrice,
      fairPricePerKg: item.currentPrice, // valuation engine would refine this
      signals,
      grade: gradeFromScore(score),
      reasoning:   buildReasoning(item, signals, score, "en"),
      reasoningHi: buildReasoning(item, signals, score, "hi"),
      reasoningMr: buildReasoning(item, signals, score, "mr"),
      trend:        item.trend,
      demand:       item.demand,
      changePercent: item.changePercent,
      isHazard: meta.hazard,
    } satisfies OpportunityScore;
  });

  // Sort descending by score then assign rank
  return scored
    .sort((a, b) => b.score - a.score)
    .map((item, i) => ({ ...item, rank: i + 1 }));
}

/** Get top N opportunities */
export function getTopOpportunities(n = 5): OpportunityScore[] {
  return scoreAllOpportunities().slice(0, n);
}

/** Get single material score */
export function getMaterialScore(material: Material): OpportunityScore | undefined {
  return scoreAllOpportunities().find((o) => o.material === material);
}
