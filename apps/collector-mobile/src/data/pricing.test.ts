// Price handling in the app: live → saved-on-phone → built-in reference rates, and the fair-price formula.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import AsyncStorage from "@react-native-async-storage/async-storage";

import { valuateLot } from "../features/lots/valuationEngine";
import type { DailyPriceRow } from "../services/api/client";
import { usePriceStore } from "../store/priceStore";
import { toBazarItem } from "./livePrices";
import { BAZAR_PRICES, getAllBazarPrices, getPriceByMaterial } from "./prices";

const row = (over: Partial<DailyPriceRow> = {}): DailyPriceRow => ({
  material: "Copper cable",
  category: "Metals",
  current_price: 852,
  previous_price: 845,
  change_percent: 0.83,
  trend: "up",
  market_price: 755,
  local_premium_pct: 12.8,
  premium_reasons: [{ kind: "industry", label: "Bhosari MIDC", detail: "Engineering & manufacturing", distance_km: 0, pct: 3.4 }],
  doorstep_price: 596,
  basis: "live",
  source: "Copper (COMEX) (live)",
  history_7d: [800, 820, 845, 852],
  demand: "HIGH",
  unit: "INR/kg",
  ...over,
});

beforeEach(async () => {
  usePriceStore.setState({ items: null, market: null });
  await AsyncStorage.clear();
});

describe("server price rows → app price items", () => {
  it("keeps the live price, breakdown and curated advice", () => {
    const item = toBazarItem(row());
    expect(item.currentPrice).toBe(852);
    expect(item.history7Days.map((d) => d.price)).toEqual([800, 820, 845, 852]);
    expect(item.history7Days[item.history7Days.length - 1]!.day).toBe("Today");
    expect(item.live).toEqual({
      marketPrice: 755, premiumPct: 12.8, reasons: row().premium_reasons, doorstepPrice: 596,
      basis: "live", source: "Copper (COMEX) (live)",
    });
    const curated = BAZAR_PRICES.find((p) => p.material === "Copper cable")!;
    expect(item.advice).toBe(curated.advice);
  });

  it("rate-card materials without history still chart, and get a source-based note", () => {
    const item = toBazarItem(row({
      material: "Newspaper", category: "Paper", current_price: 16, previous_price: 16, change_percent: 0, trend: "stable",
      basis: "rate_card", source: "Pune rate card", history_7d: [], premium_reasons: [],
    }));
    expect(item.category).toBe("Paper");
    expect(item.history7Days.map((d) => d.price)).toEqual([16, 16]);
    expect(item.advice).toContain("Pune rate card");
    expect(item.adviceHi).toContain("Pune rate card");
  });

  it("unknown categories fall back safely", () => {
    expect(toBazarItem(row({ category: "Weird" })).category).toBe("Metals");
  });
});

describe("where the app's prices come from", () => {
  it("uses built-in reference rates until the server has answered", () => {
    expect(getAllBazarPrices()).toBe(BAZAR_PRICES);
    expect(getPriceByMaterial("Copper cable")!.currentPrice).toBe(BAZAR_PRICES[0]!.currentPrice);
  });

  it("switches to live prices, and saves them on the phone", async () => {
    const items = [toBazarItem(row())];
    usePriceStore.getState().setPrices(items, { mode: "live", fetchedAt: "2026-09-27T05:00:00Z", usdInr: 95.8, updatedAt: "2026-09-27T05:01:00Z" });
    expect(getAllBazarPrices()).toBe(items);
    expect(getPriceByMaterial("Copper cable")!.currentPrice).toBe(852);
    await new Promise((r) => setTimeout(r, 0));
    expect(JSON.parse((await AsyncStorage.getItem("@mhk_live_prices_v1"))!).items[0].currentPrice).toBe(852);
  });

  it("after a restart offline, saved prices come back labelled as not live", async () => {
    usePriceStore.getState().setPrices([toBazarItem(row())], { mode: "live", fetchedAt: null, usdInr: 95.8, updatedAt: "2026-09-27T05:01:00Z" });
    await new Promise((r) => setTimeout(r, 0));
    usePriceStore.setState({ items: null, market: null });   // app restarted
    await usePriceStore.getState().hydrate();
    expect(getPriceByMaterial("Copper cable")!.currentPrice).toBe(852);
    expect(usePriceStore.getState().market!.mode).toBe("cached");
  });

  it("fresh server prices are not overwritten by an older saved copy", async () => {
    await AsyncStorage.setItem("@mhk_live_prices_v1", JSON.stringify({ items: [toBazarItem(row({ current_price: 700 }))], market: { mode: "live" } }));
    usePriceStore.getState().setPrices([toBazarItem(row())], { mode: "live", fetchedAt: null, usdInr: null, updatedAt: "x" });
    await usePriceStore.getState().hydrate();
    expect(getPriceByMaterial("Copper cable")!.currentPrice).toBe(852);
  });
});

describe("fair price (same formula as the server)", () => {
  const withPrice = (price: number) =>
    usePriceStore.getState().setPrices([toBazarItem(row({ current_price: price }))], { mode: "live", fetchedAt: null, usdInr: null, updatedAt: "x" });

  it("local price × quality × volume", () => {
    withPrice(1000);
    expect(valuateLot("Copper cable", "medium", 50).fairPricePerKg).toBe(1000);           // volume ×1.00 at 50 kg
    expect(valuateLot("Copper cable", "low", 50).fairPricePerKg).toBe(720);
    expect(valuateLot("Copper cable", "high", 50).fairPricePerKg).toBe(1280);
    expect(valuateLot("Copper cable", "medium", 1).fairPricePerKg).toBe(900);             // small lot ×0.90
    expect(valuateLot("Copper cable", "medium", 200).fairPricePerKg).toBe(1050);
    expect(valuateLot("Copper cable", "medium", 5000).fairPricePerKg).toBe(1100);         // capped at ×1.10
    expect(valuateLot("Copper cable", "medium", 35).fairPricePerKg).toBe(Math.round(1000 * (0.96 + (25 / 40) * 0.04)));
    expect(valuateLot("Copper cable", "medium", 35).fairPayout).toBe(Math.round(valuateLot("Copper cable", "medium", 35).fairPricePerKg * 35));
  });

  it("warns only when an offer is more than 8% under the fair price", () => {
    withPrice(1000);
    expect(valuateLot("Copper cable", "medium", 50, 930).warningBelowFair).toBe(false);
    expect(valuateLot("Copper cable", "medium", 50, 910).warningBelowFair).toBe(true);
  });

  it("follows the market: a live price change moves the fair price", () => {
    withPrice(800);
    const a = valuateLot("Copper cable", "medium", 50).fairPricePerKg;
    withPrice(1200);
    expect(valuateLot("Copper cable", "medium", 50).fairPricePerKg).toBe(a * 1.5);
  });

  it("works offline for household materials with no live price yet", () => {
    const v = valuateLot("Newspaper", "medium", 50);
    expect(v.fairPricePerKg).toBe(Math.round(14.3));
  });
});
