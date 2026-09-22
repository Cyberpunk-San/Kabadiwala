import React, { useMemo } from "react";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";


import { colors } from "../constants/theme";
import { useTranslation } from "../hooks/useTranslation";
import type { RootTabParamList } from "../navigation/types";
import { useAppStore } from "../store/appStore";
import { currency } from "../utils/format";

type Props = BottomTabScreenProps<RootTabParamList, "Earnings"> & {
  navigation: {
    navigate: (screen: any, params?: any) => void;
  };
};

const materialColors: Record<string, string> = {
  "Copper cable": "#E3823D",
  "Server boards": "#46A572",
  "Aluminium": "#96AEB0",
  "Mixed e-waste": "#8C68CB",
  "Lithium-ion batteries": "#E53E3E",
  "Brass fittings": "#D69E2E",
  "Printed Circuit Boards (PCB)": "#319795",
  "Electric motors": "#DD6B20",
  "Iron & steel scrap": "#718096"
};

export function EarningsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const lots = useAppStore((state) => state.lots);

  // Dynamic calculations from live SQLite lots
  const baselineEarnings = 8460;
  const baselineWeight = 142;

  const lotEarnings = lots.reduce((acc, lot) => acc + (lot.expectedNetEarnings || 0), 0);
  const lotWeight = lots.reduce((acc, lot) => acc + (lot.weightKg || 0), 0);

  const totalEarnings = lots.length > 0 ? lotEarnings : baselineEarnings;
  const totalWeight = lots.length > 0 ? lotWeight : baselineWeight;
  const salesCount = lots.length > 0 ? lots.length : 6;
  const avgNetPerKg = Math.round(totalEarnings / (totalWeight || 1));

  // Dynamic aggregation by material
  const materialAggregates = React.useMemo(() => {
    if (!lots.length) {
      return [
        { material: "Copper cable", amount: 3560, percentage: "42%" as `${number}%`, color: "#E3823D" },
        { material: "Server boards", amount: 2140, percentage: "25%" as `${number}%`, color: "#46A572" },
        { material: "Aluminium", amount: 1470, percentage: "17%" as `${number}%`, color: "#96AEB0" }
      ];
    }

    const byMaterial: Record<string, number> = {};
    for (const lot of lots) {
      byMaterial[lot.material] = (byMaterial[lot.material] || 0) + (lot.expectedNetEarnings || 0);
    }

    const sorted = Object.entries(byMaterial).sort((a, b) => b[1] - a[1]);
    const total = totalEarnings || 1;

    return sorted.map(([mat, amt]) => {
      const pctNum = Math.min(100, Math.round((amt / total) * 100));
      const percentage: `${number}%` = `${pctNum}%`;
      return {
        material: mat,
        amount: amt,
        percentage,
        color: materialColors[mat] || "#48BB78"
      };
    });
  }, [lots, totalEarnings]);

  const bars = [35, 55, 45, 75, 60, 95, Math.min(100, 40 + lots.length * 15)];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.kicker}>LIVE SQLITE LEDGER</Text>
      <Text style={styles.title}>{t("earnings")}</Text>

      {/* Main Net Earnings Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>NET EARNINGS (VERIFIED)</Text>
        <Text style={styles.heroValue}>{currency(totalEarnings)}</Text>
        <Text style={styles.heroHint}>
          ↑ {lots.length > 0 ? `${lots.length} active lots in SQLite` : "18% vs last week"}
        </Text>

        <View style={styles.chart}>
          {bars.map((height, index) => (
            <View
              key={index}
              style={[styles.bar, { height: `${height}%` }, index === 6 && styles.highlightBar]}
            />
          ))}
        </View>

        <View style={styles.days}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"].map((day) => (
            <Text key={day} style={styles.dayLabel}>{day}</Text>
          ))}
        </View>
      </View>

      {/* Growth Insight */}
      <View style={styles.insight}>
        <View style={styles.insightIcon}>
          <Text style={styles.insightIconText}>↗</Text>
        </View>
        <View style={styles.insightCopy}>
          <Text style={styles.insightKicker}>SMART RECYCLING INSIGHT</Text>
          <Text style={styles.insightTitle}>{t("growthInsight")}</Text>
          <Text style={styles.insightText}>{t("growthText")}</Text>
        </View>
      </View>

      {/* Metrics Row */}
      <View style={styles.grid}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Total Collections</Text>
          <Text style={styles.metricValue}>{salesCount}</Text>
          <Text style={styles.metricHint}>↑ {lots.length} live records</Text>
        </View>

        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Avg. Net / kg</Text>
          <Text style={styles.metricValue}>{currency(avgNetPerKg)}</Text>
          <Text style={styles.metricHint}>Total: {totalWeight} kg</Text>
        </View>
      </View>

      {/* Top Materials Breakdown */}
      <Text style={styles.sectionTitle}>Material Earnings Breakdown</Text>
      {materialAggregates.map((item) => (
        <PerformanceRow
          key={item.material}
          color={item.color}
          material={item.material}
          amount={currency(item.amount)}
          percentage={item.percentage}
          width={item.percentage}
        />
      ))}

      {/* Live Lots List with direct link to HandoverScreen */}
      <View style={styles.recentLotsHeader}>
        <Text style={styles.sectionTitle}>Active Lots & Handover Passes</Text>
      </View>
      {lots.length > 0 ? (
        lots.map((lot) => (
          <TouchableOpacity
            key={lot.id}
            style={styles.lotItemCard}
            onPress={() =>
              navigation.navigate("Handover", {
                lotId: lot.id,
                material: lot.material,
                weightKg: lot.weightKg,
                netAmount: lot.expectedNetEarnings
              })
            }
          >
            <View style={styles.lotItemLeft}>
              <Text style={styles.lotItemTitle}>{lot.material}</Text>
              <Text style={styles.lotItemMeta}>
                {lot.weightKg} kg · {lot.id.slice(0, 14)}... · {lot.status}
              </Text>
            </View>
            <View style={styles.lotItemRight}>
              <Text style={styles.lotItemPrice}>{currency(lot.expectedNetEarnings || 0)}</Text>
              <Text style={styles.lotPassLink}>View QR Pass ›</Text>
            </View>
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{t("noLots")}</Text>
        </View>
      )}
    </ScrollView>
  );
}

function PerformanceRow({
  color,
  material,
  amount,
  percentage,
  width
}: {
  color: string;
  material: string;
  amount: string;
  percentage: string;
  width: `${number}%`;
}) {
  return (
    <View style={styles.performance}>
      <View style={styles.performanceHead}>
        <View style={styles.materialName}>
          <View style={[styles.materialDot, { backgroundColor: color }]} />
          <Text style={styles.materialText}>{material}</Text>
        </View>
        <Text style={styles.amount}>{amount}</Text>
        <Text style={styles.percentage}>{percentage}</Text>
      </View>
      <View style={styles.performanceTrack}>
        <View style={[styles.performanceFill, { width, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 19, paddingBottom: 36 },
  kicker: { color: "#84948B", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  title: { marginTop: 3, marginBottom: 14, color: colors.ink, fontSize: 25, fontWeight: "800", letterSpacing: -0.5 },
  hero: { padding: 20, borderRadius: 21, backgroundColor: colors.green },
  heroLabel: { color: "#BEE4C7", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  heroValue: { marginTop: 2, color: colors.white, fontSize: 35, fontWeight: "800" },
  heroHint: { color: "#C2EACB", fontSize: 10 },
  chart: {
    height: 86,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 15
  },
  bar: { flex: 1, maxWidth: 24, borderRadius: 5, backgroundColor: "#70B57B" },
  highlightBar: { backgroundColor: "#EABD56" },
  days: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  dayLabel: { fontSize: 8, color: "#BEE4C7", fontWeight: "700" },
  insight: {
    flexDirection: "row",
    gap: 11,
    marginTop: 17,
    padding: 14,
    borderRadius: 17,
    backgroundColor: "#FFF0CA"
  },
  insightIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "#F2C968"
  },
  insightIconText: { fontSize: 16, fontWeight: "900", color: colors.ink },
  insightCopy: { flex: 1 },
  insightKicker: { color: "#8A6616", fontSize: 8, fontWeight: "800", letterSpacing: 0.8 },
  insightTitle: { marginTop: 4, color: colors.ink, fontSize: 13, fontWeight: "800" },
  insightText: { marginTop: 4, color: "#756641", fontSize: 10, lineHeight: 14 },
  grid: { flexDirection: "row", gap: 10, marginTop: 18 },
  metric: {
    flex: 1,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: colors.white
  },
  metricLabel: { color: colors.muted, fontSize: 10 },
  metricValue: { marginTop: 7, color: colors.ink, fontSize: 20, fontWeight: "800" },
  metricHint: { marginTop: 4, color: "#46825E", fontSize: 9 },
  sectionTitle: { marginTop: 22, marginBottom: 8, color: colors.ink, fontSize: 18, fontWeight: "800" },
  performance: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  performanceHead: { flexDirection: "row", alignItems: "center" },
  materialName: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  materialDot: { width: 8, height: 8, borderRadius: 4 },
  materialText: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  amount: { width: 68, color: colors.ink, fontSize: 11, fontWeight: "700", textAlign: "right" },
  percentage: { width: 35, color: colors.muted, fontSize: 10, textAlign: "right" },
  performanceTrack: { height: 6, marginTop: 8, overflow: "hidden", borderRadius: 4, backgroundColor: "#E8EEE8" },
  performanceFill: { height: "100%", borderRadius: 4 },

  recentLotsHeader: { marginTop: 8 },
  lotItemCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 8
  },
  lotItemLeft: { flex: 1 },
  lotItemTitle: { fontSize: 12, fontWeight: "800", color: colors.ink },
  lotItemMeta: { fontSize: 9, color: colors.muted, marginTop: 2 },
  lotItemRight: { alignItems: "flex-end" },
  lotItemPrice: { fontSize: 12, fontWeight: "800", color: colors.green },
  lotPassLink: { fontSize: 9, fontWeight: "700", color: colors.orange, marginTop: 2 },
  emptyCard: { padding: 14, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", borderColor: "#CBD5E1" },
  emptyText: { fontSize: 10, color: colors.muted, textAlign: "center" }
});

