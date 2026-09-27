// src/features/notifications/useNotifications.ts — one feed built from live data:
// nearby pickup requests, open buyer demands, paid lots and server risk alerts.
// Read state is kept on the phone.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useTranslation } from "../../hooks/useTranslation";
import { useCollectorLocation } from "../../hooks/useCollectorLocation";
import { listDemands, listNearbyPickups, listRiskAlerts } from "../../services/api/client";
import { useAppStore } from "../../store/appStore";
import { useAuthStore } from "../../store/authStore";
import { isMaterial, materialName } from "../../types/domain";
import type { IconName } from "../../ui/primitives";
import { currency } from "../../utils/format";

export type NotificationKind = "pickup" | "demand" | "payment" | "alert";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  at: string; // ISO time
  icon: IconName;
  /** Target to open when tapped. */
  target: { screen: "PickupDetail"; pickupId: string } | { screen: "Demands" } | { screen: "Handover"; lotId: string } | { screen: "None" };
}

const READ_KEY = "@mhk_notifications_read_v1";
const iso = (s: string) => (s.endsWith("Z") || s.includes("+") ? s : `${s}Z`);

export function useNotifications() {
  const { t, language } = useTranslation();
  const collector = useAuthStore((s) => s.collector);
  const lots = useAppStore((s) => s.lots);
  const [read, setRead] = useState<Set<string>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem(READ_KEY)
      .then((raw) => raw && setRead(new Set(JSON.parse(raw) as string[])))
      .catch(() => {});
  }, []);

  const { lat, lon } = useCollectorLocation();
  const pickups = useQuery({ queryKey: ["pickups-near-alerts", lat, lon, 25], queryFn: () => listNearbyPickups(lat, lon, 25), enabled: !!collector, staleTime: 30_000 });
  const demands = useQuery({ queryKey: ["demands"], queryFn: () => listDemands(), staleTime: 60_000 });
  const alerts = useQuery({ queryKey: ["risk-alerts"], queryFn: () => listRiskAlerts(), staleTime: 60_000 });

  const mat = useCallback((m: string) => (isMaterial(m) ? materialName(m, language) : m), [language]);

  const items = useMemo(() => {
    const out: AppNotification[] = [];
    for (const p of pickups.data ?? []) {
      out.push({
        id: `pk:${p.id}`, kind: "pickup", icon: "bicycle-outline", at: iso(p.created_at),
        title: t("nPickupTitle"),
        body: t("nPickupBody", { name: p.requester_name, kg: p.estimated_weight_kg, material: mat(p.material), km: p.distance_km ?? "?" }),
        target: { screen: "PickupDetail", pickupId: p.id },
      });
    }
    for (const d of demands.data ?? []) {
      out.push({
        id: `dm:${d.id}`, kind: "demand", icon: "megaphone-outline", at: iso(d.created_at),
        title: t("nDemandTitle"),
        body: t("nDemandBody", { buyer: d.recycler_name, kg: Math.round(d.quantity_kg - d.filled_kg), material: mat(d.material), price: currency(d.offered_price_per_kg) }),
        target: { screen: "Demands" },
      });
    }
    for (const l of lots) {
      if (l.status !== "PAID" && l.status !== "SOLD") continue;
      out.push({
        id: `pd:${l.id}`, kind: "payment", icon: "wallet-outline", at: l.createdAt,
        title: t("nPaidTitle"),
        body: t("nPaidBody", { amount: currency(l.expectedNetEarnings ?? 0), kg: l.weightKg, material: materialName(l.material, language) }),
        target: { screen: "Handover", lotId: l.id },
      });
    }
    for (const a of alerts.data ?? []) {
      if (collector && a.collector_id && a.collector_id !== collector.id) continue;
      out.push({
        id: `rk:${a.id}`, kind: "alert", icon: "shield-outline", at: iso(a.created_at),
        title: t("nRiskTitle"), body: a.message,
        target: a.lot_id ? { screen: "Handover", lotId: a.lot_id } : { screen: "None" },
      });
    }
    return out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [pickups.data, demands.data, alerts.data, lots, collector, t, mat, language]);

  const persist = (next: Set<string>) => {
    setRead(next);
    void AsyncStorage.setItem(READ_KEY, JSON.stringify([...next].slice(-500))).catch(() => {});
  };
  const markRead = (id: string) => persist(new Set(read).add(id));
  const markAllRead = () => persist(new Set([...read, ...items.map((i) => i.id)]));

  return {
    items,
    isUnread: (id: string) => !read.has(id),
    unreadCount: items.filter((i) => !read.has(i.id)).length,
    markRead,
    markAllRead,
    isLoading: pickups.isLoading || demands.isLoading,
    isError: pickups.isError && demands.isError && alerts.isError,
    refetch: () => Promise.all([pickups.refetch(), demands.refetch(), alerts.refetch()]),
  };
}
