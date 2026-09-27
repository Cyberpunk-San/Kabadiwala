// src/features/lots/photoConsensus.ts — combine AI results from several photos of one lot.
import type { Material, MaterialPrediction } from "../../types/domain";

/** A photo's top guess must be at least this sure to count as "this photo shows X". */
export const CONFIDENT = 0.5;

export interface PhotoConsensus {
  /** Combined best guess, with confidence = its share of the total vote. */
  prediction: MaterialPrediction;
  /** Materials that photos confidently disagree on (2+ entries ⇒ the lot looks mixed). */
  conflicting: Material[];
  photoCount: number;
}

/**
 * Confidence-weighted vote across photos. Each photo votes for its top material and
 * its alternatives, weighted by confidence; fallback results (no real AI) get no vote
 * unless nothing better exists.
 */
export function combinePredictions(predictions: MaterialPrediction[]): PhotoConsensus | undefined {
  if (!predictions.length) return undefined;
  const real = predictions.filter((p) => p.source !== "fallback" && p.confidence > 0);
  const voters = real.length ? real : predictions;

  const votes = new Map<Material, number>();
  const add = (m: Material, w: number) => votes.set(m, (votes.get(m) ?? 0) + w);
  for (const p of voters) {
    add(p.material, p.confidence);
    for (const a of p.alternatives ?? []) add(a.material, a.confidence);
  }

  const total = [...votes.values()].reduce((s, v) => s + v, 0) || 1;
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  const [bestMaterial, bestVote] = ranked[0]!;

  // Quality/hazard/safety come from the most confident photo of the winning material.
  const lead =
    [...voters].filter((p) => p.material === bestMaterial).sort((a, b) => b.confidence - a.confidence)[0] ??
    [...voters].sort((a, b) => b.confidence - a.confidence)[0]!;

  const conflicting = [...new Set(voters.filter((p) => p.confidence >= CONFIDENT).map((p) => p.material))];

  // A single photo keeps its own numbers; several photos report their agreement.
  const confidence = voters.length === 1 ? lead.confidence : Math.min(0.99, bestVote / total);

  return {
    prediction: {
      ...lead,
      material: bestMaterial,
      confidence: Math.round(confidence * 100) / 100,
      alternatives: ranked.slice(1, 4).map(([material, v]) => ({ material, confidence: Math.round((v / total) * 100) / 100 })),
      source: real.length ? lead.source : "fallback",
    },
    conflicting: conflicting.length > 1 ? conflicting : [],
    photoCount: predictions.length,
  };
}
