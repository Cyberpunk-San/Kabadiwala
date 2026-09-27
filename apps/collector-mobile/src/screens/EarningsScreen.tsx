// src/screens/EarningsScreen.tsx — real income from the collector's lots.
import { useMemo, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { Text } from "../ui/Text";
import Animated from "react-native-reanimated";

import { InsightsCard } from "../components/InsightsCard";
import { LotRow } from "../components/LotRow";
import { colors, radius, space, type } from "../constants/theme";
import { useScreenNarration } from "../hooks/useScreenNarration";
import { useTranslation } from "../hooks/useTranslation";
import { go, goTab } from "../navigation/ref";
import { useAppStore } from "../store/appStore";
import { useAuthStore } from "../store/authStore";
import { materialName, type Lot } from "../types/domain";
import { EmptyState } from "../ui/feedback";
import { materialStyle } from "../ui/materials";
import { AnimatedNumber, GrowBar, ProgressBar } from "../ui/motion";
import { Card, Chip, enter, InkTitle, GradientCard, Screen, SectionHeader, textStyles } from "../ui/primitives";
import { compactCurrency, currency } from "../utils/format";

import { P } from "../constants/palette";
const DAY_NAMES = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  hi: ["रवि", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि"],
  mr: ["रवि", "सोम", "मंगळ", "बुध", "गुरु", "शुक्र", "शनि"],
};

const isPaid = (l: Lot) => l.status === "PAID" || l.status === "SOLD";

export function EarningsScreen() {
  const { t, language } = useTranslation();
  useScreenNarration("Earnings");
  const lots = useAppStore((s) => s.lots);
  const syncNow = useAppStore((s) => s.syncNow);
  const collectorId = useAuthStore((s) => s.collector?.id);
  const [filter, setFilter] = useState<"all" | "paid" | "open">("all");
  const [refreshing, setRefreshing] = useState(false);

  const stats = useMemo(() => {
    const paid = lots.filter(isPaid).reduce((s, l) => s + (l.expectedNetEarnings ?? 0), 0);
    const expected = lots.filter((l) => !isPaid(l)).reduce((s, l) => s + (l.expectedNetEarnings ?? 0), 0);
    const kg = lots.reduce((s, l) => s + l.weightKg, 0);

    // Last 7 calendar days, oldest → today.
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      return { date: d, total: 0 };
    });
    for (const l of lots) {
      const created = new Date(l.createdAt);
      created.setHours(0, 0, 0, 0);
      const day = days.find((d) => d.date.getTime() === created.getTime());
      if (day) day.total += l.expectedNetEarnings ?? 0;
    }

    const byMaterial = new Map<string, number>();
    for (const l of lots) byMaterial.set(l.material, (byMaterial.get(l.material) ?? 0) + (l.expectedNetEarnings ?? 0));
    const materials = [...byMaterial.entries()].sort((a, b) => b[1] - a[1]);

    return { paid, expected, kg, days, materials, total: paid + expected };
  }, [lots]);

  const maxDay = Math.max(1, ...stats.days.map((d) => d.total));
  const shown = lots.filter((l) => (filter === "all" ? true : filter === "paid" ? isPaid(l) : !isPaid(l)));

  const onRefresh = async () => {
    setRefreshing(true);
    await syncNow(collectorId);
    setRefreshing(false);
  };

  return (
    <Screen withTabBar refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
      <Animated.View entering={enter(0)}>
        <Text style={textStyles.kicker}>{t("earningsKicker")}</Text>
        <InkTitle style={styles.title}>{t("earningsTitle")}</InkTitle>
      </Animated.View>

      {lots.length === 0 ? (
        <View style={{ marginTop: space.xl }}>
          <EmptyState icon="wallet-outline" title={t("noEarnings")} message={t("noEarningsMsg")} action={t("quickScan")} onAction={() => goTab("Collect")} />
        </View>
      ) : (
        <>
          <Animated.View entering={enter(1)}>
            <GradientCard style={{ marginTop: space.lg }}>
              <Text style={styles.heroLabel}>{t("paidOut")}</Text>
              <AnimatedNumber value={stats.paid} format={currency} style={styles.heroValue} />
              <Text style={styles.heroSub}>+ {currency(stats.expected)} {t("expected").toLowerCase()}</Text>

              <Text style={[styles.heroLabel, { marginTop: space.xl }]}>{t("last7")}</Text>
              <View style={styles.chart}>
                {stats.days.map((d, i) => (
                  <View key={i} style={styles.barCol}>
                    <Text style={styles.barValue}>{d.total ? compactCurrency(d.total) : ""}</Text>
                    <View style={styles.barTrack}>
                      <GrowBar ratio={d.total / maxDay} color={i === 6 ? P("#E5B86A") : P("rgba(168,232,201,0.8)")} delay={150 + i * 70} />
                    </View>
                    <Text style={[styles.dayLabel, i === 6 && { color: P("#F8FAF7") }]}>{DAY_NAMES[language][d.date.getDay()]}</Text>
                  </View>
                ))}
              </View>
            </GradientCard>
          </Animated.View>

          <View style={styles.metrics}>
            {[
              [t("lotsCount"), String(lots.length)],
              [t("collected"), `${Math.round(stats.kg)} ${t("kg")}`],
              [t("avgPerKg"), currency(stats.kg ? stats.total / stats.kg : 0)],
            ].map(([label, value], i) => (
              <Animated.View key={label} entering={enter(2 + i)} style={styles.metric}>
                <Text style={styles.metricLabel}>{label ? label.charAt(0).toUpperCase() + label.slice(1) : ""}</Text>
                <Text style={styles.metricValue}>{value}</Text>
              </Animated.View>
            ))}
          </View>

          {collectorId ? <InsightsCard collectorId={collectorId} /> : null}

          <SectionHeader title={t("byMaterial")} />
          <Card>
            {stats.materials.map(([m, amt], i) => (
              <View key={m} style={{ marginBottom: i === stats.materials.length - 1 ? 0 : space.md }}>
                <View style={styles.matHead}>
                  <View style={[styles.dot, { backgroundColor: materialStyle(m).tint }]} />
                  <Text style={styles.matName} numberOfLines={1}>{materialName(m as Lot["material"], language)}</Text>
                  <Text style={styles.matAmt}>{currency(amt)}</Text>
                </View>
                <ProgressBar progress={stats.total ? amt / stats.total : 0} color={materialStyle(m).tint} delay={200 + i * 80} />
              </View>
            ))}
          </Card>

          <SectionHeader title={t("allLots")} />
          <View style={styles.filters}>
            <Chip label={t("all")} active={filter === "all"} onPress={() => setFilter("all")} />
            <Chip label={t("statusPAID")} active={filter === "paid"} onPress={() => setFilter("paid")} icon="checkmark-circle" />
            <Chip label={t("expected")} active={filter === "open"} onPress={() => setFilter("open")} icon="time" />
          </View>
          {shown.map((lot, i) => (
            <LotRow key={lot.id} lot={lot} index={i} onPress={() => go("Handover", { lotId: lot.id })} />
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...type.h1, color: colors.ink, marginTop: 2 },
  heroLabel: { color: P("#A8E8C9"), fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  heroValue: { marginTop: 4, fontSize: 38, fontWeight: "800", color: P("#F8FAF7"), letterSpacing: -1 },
  heroSub: { marginTop: 2, color: P("rgba(248,250,247,0.62)"), fontSize: 14, fontWeight: "600" },
  chart: { flexDirection: "row", gap: 6, marginTop: space.md, height: 150 },
  barCol: { flex: 1, alignItems: "center" },
  barValue: { fontSize: 9, color: P("rgba(248,250,247,0.62)"), fontWeight: "700", height: 14 },
  barTrack: { flex: 1, width: "100%", justifyContent: "flex-end", borderRadius: 8, backgroundColor: P("rgba(255,255,255,0.08)") },
  dayLabel: { marginTop: 6, fontSize: 11, fontWeight: "700", color: P("#A8E8C9") },

  metrics: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  metric: { flex: 1, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  metricLabel: { fontSize: 11, fontWeight: "700", color: colors.muted },
  metricValue: { marginTop: 4, fontSize: 17, fontWeight: "800", color: colors.ink },

  matHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  matName: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.ink },
  matAmt: { fontSize: 14, fontWeight: "800", color: colors.ink },
  filters: { flexDirection: "row", gap: space.sm, marginBottom: space.md, flexWrap: "wrap" },
});
