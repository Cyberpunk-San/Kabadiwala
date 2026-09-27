// Home: the single most useful thing to do next — a route, a doorstep, or the stock.
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import { cinematic as C, space } from "../constants/theme";
import { P } from "../constants/palette";
import type { DayPlan, StockAdvice } from "../features/day/dayPlan";
import { useTranslation } from "../hooks/useTranslation";
import { go, goTab } from "../navigation/ref";
import { scoreAllOpportunities } from "../services/ai/opportunityScorer";
import { materialName, type Material } from "../types/domain";
import { Text } from "../ui/Text";
import { currency } from "../utils/format";

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export function TodayPlanCard({ plan }: { plan: DayPlan }) {
  const { t, language } = useTranslation();
  const top = scoreAllOpportunities()[0];
  const name = (m: Material) => materialName(m, language);

  const stockLine = plan.stock ? stockCopy(plan.stock, name, t) : null;
  const collectLine = top
    ? {
        title: t("collectNext", { material: name(top.material) }),
        msg: t("collectNextMsg", { price: currency(top.currentPricePerKg) }),
        onPress: () => go("Opportunity"),
      }
    : null;

  let accent = C.mint;
  let icon: keyof typeof Ionicons.glyphMap = "sunny-outline";
  let title = collectLine?.title ?? t("doThisNext");
  let msg = collectLine?.msg ?? "";
  let onPress = collectLine?.onPress ?? (() => go("Opportunity"));
  let action: { label: string; onPress: () => void } | null = null;
  let note: { title: string; msg: string; onPress: () => void } | null = null;

  if (plan.route) {
    const r = plan.route;
    accent = C.emerald;
    icon = "navigate-outline";
    const first = r.stops[0]!;
    title = t("firstDoor", { name: first.label, km: first.legKm });
    msg = t("routeMeta", { km: r.totalDistanceKm, min: r.estimatedTotalMinutes, fuel: r.estimatedFuelCostRs });
    if (r.savingsVsNaiveRs >= 8) msg = `${msg} ${t("routeSave", { n: r.savingsVsNaiveRs })}`;
    onPress = () => go("PickupDetail", { pickupId: first.id });
    action = { label: t("openMaps"), onPress: () => void Linking.openURL(r.mapsUrl) };
    if (plan.along) {
      const d = plan.along;
      note = {
        title: t("alongWay"),
        msg: t("alongWayMsg", { material: name(d.job.material), km: d.detourKm, n: d.nearStop, value: currency(d.job.valueRs) }),
        onPress: () => go("PickupDetail", { pickupId: d.job.id }),
      };
    } else if (stockLine) {
      note = stockLine;
    }
  } else if (plan.nearby) {
    const p = plan.nearby;
    accent = C.amber;
    icon = "home-outline";
    title = t("doorstepJob", { material: name(p.material) });
    msg = t("doorstepJobMsg", { kg: p.weightKg, km: p.distanceKm, value: currency(p.valueRs) });
    onPress = () => go("PickupDetail", { pickupId: p.id });
    note = stockLine;
  } else if (stockLine) {
    accent = plan.stock?.action === "HOLD" ? C.teal : C.amber;
    icon = plan.stock?.action === "HOLD" ? "time-outline" : plan.stock?.action === "AGGREGATE" ? "layers-outline" : "cash-outline";
    title = stockLine.title;
    msg = stockLine.msg;
    onPress = stockLine.onPress;
    note = collectLine;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>{t("doThisNext")}</Text>
      <LinearGradient colors={[rgba(accent, 0.16), P("rgba(248,250,247,0.03)")]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${msg}`} style={styles.cardPress}>
          <View style={[styles.icon, { borderColor: rgba(accent, 0.35) }]}>
            <Ionicons name={icon} size={20} color={accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.msg}>{msg}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
        </Pressable>
        {action ? (
          <Pressable onPress={action.onPress} hitSlop={8} accessibilityRole="button" style={styles.action}>
            <Ionicons name="map-outline" size={14} color={C.mint} />
            <Text style={styles.actionText}>{action.label}</Text>
          </Pressable>
        ) : null}
      </LinearGradient>
      {note ? (
        <Pressable onPress={note.onPress} accessibilityRole="button" style={styles.note}>
          <Text style={styles.noteTitle}>{note.title}</Text>
          <Text style={styles.noteMsg} numberOfLines={2}>{note.msg}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function stockCopy(
  stock: StockAdvice,
  name: (m: Material) => string,
  t: ReturnType<typeof useTranslation>["t"],
): { title: string; msg: string; onPress: () => void } {
  const material = name(stock.material);
  const vars = {
    material,
    kg: stock.weightKg,
    value: currency(stock.valueRs),
    pct: Math.abs(stock.pct).toFixed(1),
    days: stock.ageDays,
    target: stock.targetKg ?? 25,
    save: stock.saveRs ?? 0,
  };
  const open = () => {
    if (stock.action === "AGGREGATE") goTab("Collect", { prefillMaterial: stock.material });
    else if (stock.action === "HOLD") go("MaterialDetail", { material: stock.material });
    else goTab("Market", { material: stock.material, quality: "medium", weightKg: stock.weightKg });
  };
  if (stock.reason === "falling") return { title: t("sellFalling", vars), msg: t("sellFallingMsg", vars), onPress: open };
  if (stock.reason === "stale") return { title: t("sellStale", vars), msg: t("sellStaleMsg", vars), onPress: open };
  if (stock.reason === "rising") return { title: t("holdRising", vars), msg: t("holdRisingMsg", vars), onPress: open };
  return { title: t("waitBatch", vars), msg: t("waitBatchMsg", vars), onPress: open };
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.xl },
  kicker: { fontSize: 13, fontWeight: "600", letterSpacing: 0.2, color: C.mint, marginBottom: space.sm },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    paddingBottom: space.md,
  },
  cardPress: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    padding: space.lg,
    paddingBottom: space.sm,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: P("#020705"),
    borderWidth: 1,
    marginTop: 2,
  },
  title: { fontSize: 16, fontWeight: "600", color: C.text },
  msg: { fontSize: 13, lineHeight: 19, color: C.textSoft, marginTop: 3 },
  action: { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 40 + space.md + space.lg, alignSelf: "flex-start", paddingBottom: space.xs },
  actionText: { fontSize: 13, fontWeight: "600", color: C.mint },
  note: {
    marginTop: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: 12,
    backgroundColor: P("rgba(248,250,247,0.04)"),
    borderWidth: 1,
    borderColor: C.border,
  },
  noteTitle: { fontSize: 13, fontWeight: "600", color: C.text },
  noteMsg: { fontSize: 12, lineHeight: 17, color: C.textSoft, marginTop: 2 },
});
