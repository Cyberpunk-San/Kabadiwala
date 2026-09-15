import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { colors } from "../constants/theme";
import { useTranslation } from "../hooks/useTranslation";
import type { RootTabParamList } from "../navigation/types";

type Props = BottomTabScreenProps<RootTabParamList, "Earnings">;

const bars = [37, 55, 43, 78, 58, 95, 70];

export function EarningsScreen(_: Props) {
  const { t } = useTranslation();
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Text style={styles.kicker}>YOUR BUSINESS</Text><Text style={styles.title}>{t("earnings")}</Text>
    <View style={styles.hero}><Text style={styles.heroLabel}>NET EARNINGS</Text><Text style={styles.heroValue}>₹8,460</Text><Text style={styles.heroHint}>↑ 18% vs last week</Text><View style={styles.chart}>{bars.map((height, index) => <View key={index} style={[styles.bar, { height: `${height}%` }, index === 5 && styles.highlightBar]} />)}</View><View style={styles.days}>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <Text key={day}>{day}</Text>)}</View></View>
    <View style={styles.insight}><View style={styles.insightIcon}><Text>↗</Text></View><View style={styles.insightCopy}><Text style={styles.insightKicker}>GROWTH INSIGHT</Text><Text style={styles.insightTitle}>{t("growthInsight")}</Text><Text style={styles.insightText}>{t("growthText")}</Text></View></View>
    <View style={styles.grid}><View style={styles.metric}><Text style={styles.metricLabel}>Sales</Text><Text style={styles.metricValue}>6</Text><Text style={styles.metricHint}>↑ 2 this week</Text></View><View style={styles.metric}><Text style={styles.metricLabel}>Avg. net / kg</Text><Text style={styles.metricValue}>₹488</Text><Text style={styles.metricHint}>↑ ₹34 this week</Text></View></View>
    <Text style={styles.sectionTitle}>Top materials</Text>
    <PerformanceRow color="#E3823D" material="Copper" amount="₹3,560" percentage="42%" width="42%" />
    <PerformanceRow color="#46A572" material="Server boards" amount="₹2,140" percentage="25%" width="25%" />
    <PerformanceRow color="#96AEB0" material="Aluminium" amount="₹1,470" percentage="17%" width="17%" />
  </ScrollView>;
}

function PerformanceRow({ color, material, amount, percentage, width }: { color: string; material: string; amount: string; percentage: string; width: `${number}%` }) {
  return <View style={styles.performance}><View style={styles.performanceHead}><View style={styles.materialName}><View style={[styles.materialDot, { backgroundColor: color }]} /><Text style={styles.materialText}>{material}</Text></View><Text style={styles.amount}>{amount}</Text><Text style={styles.percentage}>{percentage}</Text></View><View style={styles.performanceTrack}><View style={[styles.performanceFill, { width, backgroundColor: color }]} /></View></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream }, content: { padding: 19, paddingBottom: 31 }, kicker: { color: "#84948B", fontSize: 9, fontWeight: "800", letterSpacing: 1 }, title: { marginTop: 3, marginBottom: 14, color: colors.ink, fontSize: 25, fontWeight: "800", letterSpacing: -.5 },
  hero: { padding: 20, borderRadius: 21, backgroundColor: colors.green }, heroLabel: { color: "#BEE4C7", fontSize: 10, fontWeight: "800", letterSpacing: .8 }, heroValue: { marginTop: 2, color: colors.white, fontSize: 35, fontWeight: "800" }, heroHint: { color: "#C2EACB", fontSize: 10 }, chart: { height: 86, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 9, marginTop: 15 }, bar: { flex: 1, maxWidth: 24, borderRadius: 5, backgroundColor: "#70B57B" }, highlightBar: { backgroundColor: "#EABD56" }, days: { flexDirection: "row", justifyContent: "space-between", marginTop: 5 },
  insight: { flexDirection: "row", gap: 11, marginTop: 17, padding: 14, borderRadius: 17, backgroundColor: "#FFF0CA" }, insightIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "#F2C968" }, insightCopy: { flex: 1 }, insightKicker: { color: "#8A6616", fontSize: 8, fontWeight: "800", letterSpacing: .8 }, insightTitle: { marginTop: 4, color: colors.ink, fontSize: 13, fontWeight: "800" }, insightText: { marginTop: 4, color: "#756641", fontSize: 10, lineHeight: 14 },
  grid: { flexDirection: "row", gap: 10, marginTop: 18 }, metric: { flex: 1, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.white }, metricLabel: { color: colors.muted, fontSize: 10 }, metricValue: { marginTop: 7, color: colors.ink, fontSize: 20, fontWeight: "800" }, metricHint: { marginTop: 4, color: "#46825E", fontSize: 9 }, sectionTitle: { marginTop: 25, marginBottom: 7, color: colors.ink, fontSize: 19, fontWeight: "800" },
  performance: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line }, performanceHead: { flexDirection: "row", alignItems: "center" }, materialName: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }, materialDot: { width: 8, height: 8, borderRadius: 4 }, materialText: { color: colors.ink, fontSize: 11, fontWeight: "700" }, amount: { width: 58, color: colors.ink, fontSize: 11, fontWeight: "700", textAlign: "right" }, percentage: { width: 35, color: colors.muted, fontSize: 10, textAlign: "right" }, performanceTrack: { height: 5, marginTop: 8, overflow: "hidden", borderRadius: 4, backgroundColor: "#E8EEE8" }, performanceFill: { height: "100%", borderRadius: 4 }
});
