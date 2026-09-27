// src/hooks/useLivePrices.ts — keeps today's prices for the user's location in the price store.
// Mounted once at the app root. Offline, the last prices stay on the phone (priceStore).
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { toBazarItem } from "../data/livePrices";
import { getDailyPrices } from "../services/api/client";
import { usePriceStore } from "../store/priceStore";
import { useCollectorLocation } from "./useCollectorLocation";

export function useLivePrices() {
  const { lat, lon } = useCollectorLocation();
  const setPrices = usePriceStore((s) => s.setPrices);
  const hydrate = usePriceStore((s) => s.hydrate);

  useEffect(() => { void hydrate(); }, [hydrate]);

  // ~1 km precision is plenty for prices and keeps the cache key stable while walking around.
  const key = [Math.round(lat * 100) / 100, Math.round(lon * 100) / 100] as const;
  const query = useQuery({
    queryKey: ["daily-prices", ...key],
    queryFn: () => getDailyPrices(key[0], key[1]),
    staleTime: 30 * 60_000,
    refetchInterval: 30 * 60_000,
  });

  useEffect(() => {
    if (!query.data) return;
    setPrices(query.data.prices.map(toBazarItem), {
      mode: query.data.market.mode,
      fetchedAt: query.data.market.fetched_at,
      usdInr: query.data.market.usd_inr,
      updatedAt: new Date().toISOString(),
    });
  }, [query.data, setPrices]);
}
