import type { MaterialPrediction } from "../../types/domain";
import { combinePredictions } from "./photoConsensus";

const pred = (material: MaterialPrediction["material"], confidence: number, extra: Partial<MaterialPrediction> = {}): MaterialPrediction => ({
  material, confidence, category: "x", quality: "medium", hazard: false, source: "local", alternatives: [], ...extra,
});

describe("multi-photo consensus", () => {
  it("returns nothing for no photos", () => {
    expect(combinePredictions([])).toBeUndefined();
  });

  it("keeps a single photo's own confidence", () => {
    const c = combinePredictions([pred("Copper cable", 0.82)])!;
    expect(c.prediction.material).toBe("Copper cable");
    expect(c.prediction.confidence).toBe(0.82);
    expect(c.conflicting).toEqual([]);
  });

  it("lets agreeing photos outvote one unsure photo", () => {
    const c = combinePredictions([pred("Aluminium", 0.7), pred("Aluminium", 0.6), pred("Brass fittings", 0.3)])!;
    expect(c.prediction.material).toBe("Aluminium");
    expect(c.prediction.alternatives?.[0]?.material).toBe("Brass fittings");
    expect(c.conflicting).toEqual([]);
    expect(c.photoCount).toBe(3);
  });

  it("flags a mixed lot when photos confidently disagree", () => {
    const c = combinePredictions([pred("Copper cable", 0.8), pred("Lithium-ion batteries", 0.75, { hazard: true })])!;
    expect(c.conflicting.sort()).toEqual(["Copper cable", "Lithium-ion batteries"]);
  });

  it("ignores fallback guesses when a real AI result exists", () => {
    const c = combinePredictions([pred("Mixed e-waste", 0.9, { source: "fallback" }), pred("Server boards", 0.55)])!;
    expect(c.prediction.material).toBe("Server boards");
    expect(c.prediction.source).toBe("local");
  });
});
