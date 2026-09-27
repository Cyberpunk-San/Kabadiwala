// src/data/livePrices.ts — server price rows → the app's BazarPriceItem (pure; unit-tested).
import type { DailyPriceRow } from "../services/api/client";
import type { BazarPriceItem, MaterialCategory } from "../types/domain";
import { BAZAR_PRICES } from "./prices";

const CATEGORIES: MaterialCategory[] = ["Metals", "Electronics", "Batteries", "Heavy Scrap", "Paper", "Plastic"];

export function toBazarItem(row: DailyPriceRow): BazarPriceItem {
  const known = BAZAR_PRICES.find((p) => p.material === row.material);
  const history = row.history_7d.length >= 2 ? row.history_7d : [row.previous_price, row.current_price];
  return {
    id: `live_${row.material}`,
    material: row.material,
    category: (CATEGORIES as string[]).includes(row.category) ? (row.category as MaterialCategory) : known?.category ?? "Metals",
    currentPrice: row.current_price,
    previousPrice: row.previous_price,
    changePercent: row.change_percent,
    trend: row.trend,
    demand: row.demand,
    history7Days: history.map((price, i) => ({ day: i === history.length - 1 ? "Today" : `Day ${i + 1}`, price })),
    // Advice text is curated per material; new materials fall back to where the rate comes from.
    advice: known?.advice ?? `Local rate from the ${row.source}.`,
    adviceHi: known?.adviceHi ?? `स्थानीय भाव: ${row.source}`,
    adviceMr: known?.adviceMr ?? `स्थानिक दर: ${row.source}`,
    live: {
      marketPrice: row.market_price,
      premiumPct: row.local_premium_pct,
      reasons: row.premium_reasons,
      doorstepPrice: row.doorstep_price,
      basis: row.basis,
      source: row.source,
    },
  };
}

