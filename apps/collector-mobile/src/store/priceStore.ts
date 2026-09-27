// src/store/priceStore.ts — today's prices for where the user is, from the server
// (live metals exchange / city rate cards + nearby-industry premium). Kept on the phone for offline use.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import type { BazarPriceItem } from "../types/domain";

const CACHE_KEY = "@mhk_live_prices_v1";

export type PriceMarketInfo = {
  mode: "live" | "cached" | "reference";
  fetchedAt: string | null;
  usdInr: number | null;
  updatedAt: string; // when this phone last got prices
};

type PriceState = {
  items: BazarPriceItem[] | null;
  market: PriceMarketInfo | null;
  setPrices: (items: BazarPriceItem[], market: PriceMarketInfo) => void;
  hydrate: () => Promise<void>;
};

export const usePriceStore = create<PriceState>((set) => ({
  items: null,
  market: null,
  setPrices: (items, market) => {
    set({ items, market });
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ items, market })).catch(() => {});
  },
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const { items, market } = JSON.parse(raw) as { items: BazarPriceItem[]; market: PriceMarketInfo };
        // Prices read back from the phone are, by definition, not live any more.
        const saved: PriceMarketInfo = { ...market, mode: market.mode === "reference" ? "reference" : "cached" };
        set((s) => (s.items ? s : { items, market: saved }));
      }
    } catch {
      // No cache yet — the built-in reference rates are used.
    }
  },
}));
