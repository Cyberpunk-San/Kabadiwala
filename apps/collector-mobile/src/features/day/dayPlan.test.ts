jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import { adviseStock, alongTheWay, buildDayPlan, nextAfter, planRoute, type RouteJob } from "./dayPlan";

const start = { latitude: 18.5, longitude: 73.8 };

function job(partial: Partial<RouteJob> & Pick<RouteJob, "id" | "latitude" | "longitude">): RouteJob {
  return {
    label: partial.id,
    material: "Copper cable",
    weightKg: 5,
    valueRs: 1000,
    ...partial,
  };
}

describe("day route", () => {
  const nearA = job({ id: "a", latitude: 18.52, longitude: 73.82, valueRs: 800 });
  const nearB = job({ id: "b", latitude: 18.54, longitude: 73.84, valueRs: 900 });
  const far = job({ id: "far", latitude: 19.1, longitude: 72.8, label: "Across the city", valueRs: 2000 });

  it("rides the nearest door first, even if that job was accepted last", () => {
    const route = planRoute(start, [far, nearB, nearA]);
    expect(route).not.toBeNull();
    expect(route!.stops.map((s) => s.id)).toEqual(["a", "b", "far"]);
    expect(route!.stops[0]!.order).toBe(1);
    expect(route!.savingsVsNaiveRs).toBeGreaterThan(50);
    expect(route!.mapsUrl).toContain("https://www.google.com/maps/dir/?");
    expect(route!.mapsUrl).toContain("waypoints=");
    expect(route!.mapsUrl).toContain("18.52");
  });

  it("names the door after the one just finished", () => {
    const route = planRoute(start, [far, nearB, nearA])!;
    expect(nextAfter(route, "a")?.id).toBe("b");
    expect(nextAfter(route, "far")).toBeNull();
    expect(nextAfter(route, "missing")).toBeNull();
  });

  it("still gives a one-stop trip a map link", () => {
    const route = planRoute(start, [nearA]);
    expect(route!.stops).toHaveLength(1);
    expect(route!.savingsVsNaiveRs).toBe(0);
    expect(route!.mapsUrl).toContain("destination=18.52");
    expect(route!.mapsUrl).not.toContain("waypoints=");
  });

  it("notices an open pickup sitting beside a stop", () => {
    const route = planRoute(start, [nearA, far])!;
    const side = job({ id: "side", latitude: 18.521, longitude: 73.821, material: "Brass fittings", valueRs: 1500 });
    const detour = alongTheWay(route, [side, job({ id: "nowhere", latitude: 28.6, longitude: 77.2, valueRs: 9000 })]);
    expect(detour?.job.id).toBe("side");
    expect(detour!.detourKm).toBeLessThanOrEqual(2.5);
    expect(detour!.nearStop).toBe(1);
  });
});

describe("hold or sell", () => {
  const now = Date.parse("2026-09-27T09:00:00Z");
  const lot = (ageDays: number, weightKg = 10, value = 6000) => ({
    material: "Copper cable" as const,
    weightKg,
    status: "AVAILABLE",
    createdAt: new Date(now - ageDays * 86_400_000).toISOString(),
    expectedNetEarnings: value,
  });

  it("sells when the week's price is falling", () => {
    const advice = adviseStock([lot(1)], [{ material: "Copper cable", currentPrice: 600, changePercent: -3 }], now);
    expect(advice).toMatchObject({ action: "SELL_NOW", reason: "falling", material: "Copper cable" });
  });

  it("holds a young lot when the rise beats the cost of keeping it", () => {
    const advice = adviseStock([lot(1, 15, 8000)], [{ material: "Copper cable", currentPrice: 530, changePercent: 5 }], now);
    expect(advice).toMatchObject({ action: "HOLD", reason: "rising" });
  });

  it("sells stock that has sat for a week, even if the price ticked up", () => {
    const advice = adviseStock([lot(10)], [{ material: "Copper cable", currentPrice: 600, changePercent: 4 }], now);
    expect(advice).toMatchObject({ action: "SELL_NOW", reason: "stale", ageDays: 10 });
  });

  it("asks for a fuller load before paying for a trip to the yard", () => {
    const advice = adviseStock(
      [lot(1, 5, 400)],
      [{ material: "Copper cable", currentPrice: 80, changePercent: 0.4 }],
      now,
    );
    expect(advice).toMatchObject({ action: "AGGREGATE", reason: "small_batch", targetKg: 25 });
    expect(advice!.saveRs).toBeGreaterThan(80);
  });

  it("ignores lots that are already paid", () => {
    const advice = adviseStock(
      [{ ...lot(1), status: "PAID" }],
      [{ material: "Copper cable", currentPrice: 600, changePercent: -5 }],
      now,
    );
    expect(advice).toBeNull();
  });
});

describe("the day's plan", () => {
  it("puts the route ahead of extra pickups, and still flags one on the way", () => {
    const plan = buildDayPlan({
      start,
      accepted: [job({ id: "a", latitude: 18.52, longitude: 73.82 })],
      open: [job({ id: "side", latitude: 18.522, longitude: 73.822, valueRs: 1400, material: "Newspaper" })],
      lots: [],
      prices: [],
    });
    expect(plan.route?.stops[0]?.id).toBe("a");
    expect(plan.nearby).toBeNull();
    expect(plan.along?.job.id).toBe("side");
  });
});
