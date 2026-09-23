// src/screens/OpportunityScreen.tsx
import { useCallback, useMemo } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { colors } from "../constants/theme";
import { useTranslation } from "../hooks/useTranslation";
import { scoreAllOpportunities } from "../services/ai/opportunityScorer";
import { speak } from "../services/voice/speech";
import { MATERIAL_METADATA } from "../types/domain";
import { currency } from "../utils/format";

type Props = {
  navigation: any;
};

const GRADE_COLOR: Record<string, string> = {
  S: "#9333EA",
  A: "#16A34A",
  B: "#2563EB",
  C: "#EAB308",
  D: "#DC2626",
};

const GRADE_BG: Record<string, string> = {
  S: "#F3E8FF",
  A: "#DCFCE7",
  B: "#DBEAFE",
  C: "#FEF9C3",
  D: "#FEE2E2",
};

export function OpportunityScreen({ navigation }: Props) {
  const { language, t } = useTranslation();

  // Local ML engine score (synchronous, offline, 0ms)
  const scores = useMemo(() => scoreAllOpportunities(), []);
  const topItem = scores[0];

  const onRefresh = useCallback(() => {
    // No-op for local ML, but keeping for UX
  }, []);

  const narrateTop = () => {
    if (!topItem) return;
    speak(
      `Top opportunity: ${topItem.material}. Score ${Math.round(topItem.score)}. ${topItem.reasoning}`,
      language
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}
    >
      <View style={styles.topRow}>
        <View>
          <Text style={styles.kicker}>ML OPPORTUNITY ENGINE</Text>
          <Text style={styles.title}>What should I collect?</Text>
          <Text style={styles.subtitle}>
            Ranked by composite AI score · {scores.length} materials analysed
          </Text>
        </View>
        <TouchableOpacity style={styles.speakBtn} onPress={narrateTop}>
          <Text style={styles.speakIcon}>🔊</Text>
        </TouchableOpacity>
      </View>

      {/* Top recommendation hero */}
      {topItem && (
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <Text style={styles.heroKicker}>🏆 #1 RECOMMENDATION</Text>
            <View style={[styles.gradeBadge, { backgroundColor: GRADE_COLOR[topItem.grade] }]}>
              <Text style={styles.gradeText}>Grade {topItem.grade}</Text>
            </View>
          </View>
          <Text style={styles.heroMaterial}>
            {MATERIAL_METADATA[topItem.material]?.icon ?? '' }
            {language === "hi" ? MATERIAL_METADATA[topItem.material]?.hindi :
             language === "mr" ? MATERIAL_METADATA[topItem.material]?.marathi :
             topItem.material}
          </Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>AI SCORE</Text>
              <Text style={styles.heroStatValue}>{topItem.score}/100</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>PRICE/kg</Text>
              <Text style={styles.heroStatValue}>{currency(topItem.currentPricePerKg)}</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>DEMAND</Text>
              <Text style={styles.heroStatValue}>{topItem.demand}</Text>
            </View>
          </View>

          {/* Signal bars */}
          <View style={styles.signalRow}>
            {([
              ["Momentum", topItem.signals.momentum],
              ["Urgency", topItem.signals.urgency],
              ["Capacity", topItem.signals.capacityMatch],
              ["Logistics", topItem.signals.logisticsNet],
              ["Scarcity", topItem.signals.scarcityPremium],
            ] as [string, number][]).map(([label, val]) => (
              <View key={label} style={styles.signal}>
                <Text style={styles.signalLabel}>{label}</Text>
                <View style={styles.signalTrack}>
                  <View style={[styles.signalBar, { width: `${val}%` }]} />
                </View>
                <Text style={styles.signalVal}>{val}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.heroReason}>
            {language === "hi" ? topItem.reasoningHi :
             language === "mr" ? topItem.reasoningMr :
             topItem.reasoning}
          </Text>
          <TouchableOpacity
            style={styles.heroCta}
            onPress={() =>
              navigation.navigate("Collect", {
                prefillMaterial: topItem.material,
              })
            }
          >
            <Text style={styles.heroCtaText}>Start collecting →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Full ranked list */}
      <Text style={styles.sectionTitle}>All opportunities ranked</Text>
      {scores.map((item) => (
        <TouchableOpacity
          key={item.material}
          style={[styles.card, item.isHazard && styles.cardHazard]}
          onPress={() =>
            navigation.navigate("Market", {
              material: item.material,
              quality: "medium",
              weightKg: 35,
            })
          }
        >
          <View style={styles.cardHeader}>
            <View style={[styles.rankBadge, { backgroundColor: GRADE_BG[item.grade] ?? colors.greenLight }]}>
              <Text style={[styles.rankText, { color: GRADE_COLOR[item.grade] ?? colors.green }]}>#{item.rank}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardMaterial}>
                {MATERIAL_METADATA[item.material]?.icon ?? ''} {item.material}
              </Text>
              <Text style={styles.cardMeta}>
                {item.demand} demand · {item.trend === "up" ? '↗️' : item.trend === "down" ? '↘️' : '➡️'} {item.changePercent > 0 ? '+' : ''}{item.changePercent}% today
                {item.isHazard ? ' · ⚠️ Hazardous' : ''}
              </Text>
            </View>
            <View style={styles.scoreCol}>
              <Text style={[styles.scoreValue, { color: GRADE_COLOR[item.grade] ?? colors.orange }]}>{item.score}</Text>
              <View style={[styles.gradeSmall, { backgroundColor: GRADE_COLOR[item.grade] ?? colors.orange }]}>
                <Text style={styles.gradeSmallText}>{item.grade}</Text>
              </View>
            </View>
          </View>

          <View style={styles.track}>
            <View style={[styles.progress, { width: `${item.score}%` }]} />
          </View>

          <View style={styles.cardStatsRow}>
            <View style={styles.cardStat}>
              <Text style={styles.cardStatLabel}>PRICE/kg</Text>
              <Text style={styles.cardStatValue}>{currency(item.currentPricePerKg)}</Text>
            </View>
            <View style={styles.cardStat}>
              <Text style={styles.cardStatLabel}>MOMENTUM</Text>
              <Text style={styles.cardStatValue}>{item.signals.momentum}/100</Text>
            </View>
            <View style={styles.cardStat}>
              <Text style={styles.cardStatLabel}>URGENCY</Text>
              <Text style={[styles.cardStatValueGreen, { color: item.signals.urgency > 70 ? colors.green : colors.orange }]}>
                {item.signals.urgency}/100
              </Text>
            </View>
          </View>

          <Text style={styles.cardReasoning} numberOfLines={2}>
            {language === "hi" ? item.reasoningHi : language === "mr" ? item.reasoningMr : item.reasoning}
          </Text>
        </TouchableOpacity>
      ))}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          AI scores computed locally · 5 signals: Price Momentum, Demand Urgency, Capacity Match, Logistics Net, Scarcity Premium
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 19, paddingBottom: 40 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream,
    padding: 30,
  },
  loadingText: { marginTop: 10, color: colors.muted, fontSize: 12 },
  errorIcon: { fontSize: 40, marginBottom: 10 },
  errorTitle: { fontSize: 16, fontWeight: "800", color: colors.ink, marginBottom: 6 },
  errorBody: { fontSize: 12, color: colors.muted, textAlign: "center", marginBottom: 20 },
  retryBtn: {
    paddingHorizontal: 24, paddingVertical: 11,
    borderRadius: 10, backgroundColor: colors.green,
  },
  retryText: { color: colors.white, fontSize: 12, fontWeight: "800" },

  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  kicker: { color: "#84948B", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  title: { marginTop: 4, color: colors.ink, fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { marginTop: 4, color: colors.muted, fontSize: 12 },
  speakBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.greenLight,
    alignItems: "center", justifyContent: "center",
  },
  speakIcon: { fontSize: 18 },

  hero: {
    padding: 18, borderRadius: 20,
    backgroundColor: colors.green,
    marginBottom: 20,
  },
  heroTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  heroKicker: { color: "#C2E8CB", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  gradeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  gradeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  heroMaterial: { color: colors.white, fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  heroStats: { flexDirection: "row", gap: 8, marginTop: 12 },
  heroStat: {
    flex: 1, padding: 10, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  heroStatLabel: { color: "#B8DFC2", fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  heroStatValue: { marginTop: 4, color: colors.white, fontSize: 13, fontWeight: "900" },

  // Signal breakdown
  signalRow: { marginTop: 12, gap: 5 },
  signal: { flexDirection: "row", alignItems: "center", gap: 6 },
  signalLabel: { width: 55, fontSize: 8, color: "rgba(255,255,255,.65)", fontWeight: "700" },
  signalTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,.15)", overflow: "hidden" },
  signalBar: { height: "100%", borderRadius: 3, backgroundColor: "#86EFAC" },
  signalVal: { width: 22, fontSize: 8, color: "rgba(255,255,255,.65)", fontWeight: "700", textAlign: "right" },

  heroReason: { marginTop: 12, color: "#D0E6D7", fontSize: 10, lineHeight: 15 },
  heroCta: {
    marginTop: 14, padding: 12, borderRadius: 12,
    backgroundColor: "#F8E5AE",
    alignItems: "center",
  },
  heroCtaText: { color: colors.green, fontSize: 12, fontWeight: "900" },

  sectionTitle: {
    marginTop: 6, marginBottom: 10,
    color: colors.ink, fontSize: 17, fontWeight: "800",
  },

  card: {
    marginBottom: 10, padding: 14,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1, borderColor: colors.line,
  },
  cardHazard: { borderColor: "#FDBA74", backgroundColor: "#FFFBEB" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  rankBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.greenLight,
    alignItems: "center", justifyContent: "center",
  },
  rankText: { color: colors.green, fontSize: 11, fontWeight: "900" },
  cardMaterial: { fontSize: 13, fontWeight: "800", color: colors.ink },
  cardMeta: { fontSize: 9, color: colors.muted, marginTop: 2 },
  scoreCol: { alignItems: "center", gap: 3 },
  scoreValue: { color: colors.orange, fontSize: 18, fontWeight: "900" },
  scoreLabel: { color: colors.muted, fontSize: 8, fontWeight: "700", letterSpacing: 0.5 },
  gradeSmall: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  gradeSmallText: { color: "#fff", fontSize: 8, fontWeight: "900" },

  track: {
    height: 6, borderRadius: 3,
    backgroundColor: "#E6EDE7",
    overflow: "hidden",
    marginBottom: 10,
  },
  progress: {
    height: "100%",
    backgroundColor: "#49A36B",
    borderRadius: 3,
  },

  cardStatsRow: { flexDirection: "row", gap: 6, marginBottom: 8 },
  cardStat: { flex: 1, padding: 8, borderRadius: 9, backgroundColor: "#F6F9F6" },
  cardStatLabel: { fontSize: 8, fontWeight: "800", color: colors.muted, letterSpacing: 0.5 },
  cardStatValue: { marginTop: 3, fontSize: 11, fontWeight: "900", color: colors.ink },
  cardStatValueGreen: { marginTop: 3, fontSize: 11, fontWeight: "900", color: colors.green },

  cardReasoning: { fontSize: 9, color: colors.muted, lineHeight: 13, fontStyle: "italic" },

  footer: { marginTop: 16, alignItems: "center" },
  footerText: { fontSize: 9, color: colors.muted, textAlign: "center" },
});
