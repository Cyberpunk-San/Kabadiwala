// src/screens/OpportunityScreen.tsx
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { colors } from "../constants/theme";
import { useTranslation } from "../hooks/useTranslation";
import type { RootTabParamList } from "../navigation/types";
import { getOpportunityFeed } from "../services/api/client";
import { speak } from "../services/voice/speech";
import { useAuthStore } from "../store/authStore";
import { useAppStore } from "../store/appStore";
import { currency } from "../utils/format";

type Props = {
  navigation: any;
};

export function OpportunityScreen({ navigation }: Props) {
  const { language, t } = useTranslation();
  const collector = useAuthStore((s) => s.collector);

  const feedQuery = useQuery({
    queryKey: ["opportunity-feed", collector?.latitude, collector?.longitude],
    queryFn: () =>
      getOpportunityFeed({
        latitude: collector?.latitude ?? undefined,
        longitude: collector?.longitude ?? undefined,
      }),
  });

  const onRefresh = useCallback(() => {
    feedQuery.refetch();
  }, [feedQuery]);

  // ─── Loading / error ─────────────────────────────────────────────────────
  if (feedQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.green} />
        <Text style={styles.loadingText}>Analysing live demand…</Text>
      </View>
    );
  }

  if (feedQuery.isError || !feedQuery.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>⚠</Text>
        <Text style={styles.errorTitle}>Could not load opportunities</Text>
        <Text style={styles.errorBody}>
          Check that the backend is running.
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const feed = feedQuery.data;
  const topItem = feed.items[0];

  const narrateTop = () => {
    if (!topItem) return;
    speak(
      `Top opportunity: ${topItem.material}. Score ${Math.round(topItem.opportunity_score)}. ${topItem.reasoning}`,
      language
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={feedQuery.isFetching} onRefresh={onRefresh} />}
    >
      <View style={styles.topRow}>
        <View>
          <Text style={styles.kicker}>OPPORTUNITY ENGINE</Text>
          <Text style={styles.title}>What should I collect?</Text>
          <Text style={styles.subtitle}>
            Based on live demand · {feed.location_label}
          </Text>
        </View>
        <TouchableOpacity style={styles.speakBtn} onPress={narrateTop}>
          <Text style={styles.speakIcon}>🔊</Text>
        </TouchableOpacity>
      </View>

      {/* Top recommendation hero */}
      {topItem && (
        <View style={styles.hero}>
          <Text style={styles.heroKicker}>🏆 #1 RECOMMENDATION</Text>
          <Text style={styles.heroMaterial}>{topItem.material}</Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>SCORE</Text>
              <Text style={styles.heroStatValue}>{Math.round(topItem.opportunity_score)}</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>BEST NET/kg</Text>
              <Text style={styles.heroStatValue}>{currency(topItem.best_net_per_kg)}</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>DEMAND</Text>
              <Text style={styles.heroStatValue}>{Math.round(topItem.demand_kg_open)} kg</Text>
            </View>
          </View>
          <Text style={styles.heroReason}>{topItem.reasoning}</Text>
          <Text style={styles.heroEstimate}>
            Collect ~{Math.round(topItem.recommended_weight_kg)} kg → earn ~{currency(topItem.expected_payout)}
          </Text>
          <TouchableOpacity
            style={styles.heroCta}
            onPress={() =>
              navigation.navigate("Collect", {
                prefillMaterial: topItem.material,
                prefillWeightKg: Math.round(topItem.recommended_weight_kg),
              })
            }
          >
            <Text style={styles.heroCtaText}>Start collecting →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Full ranked list */}
      <Text style={styles.sectionTitle}>All opportunities ranked</Text>
      {feed.items.map((item, idx) => (
        <TouchableOpacity
          key={item.material}
          style={styles.card}
          onPress={() =>
            navigation.navigate("Collect", {
              prefillMaterial: item.material,
              prefillWeightKg: Math.round(item.recommended_weight_kg),
            })
          }
        >
          <View style={styles.cardHeader}>
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>#{idx + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardMaterial}>{item.material}</Text>
              <Text style={styles.cardMeta}>
                {item.active_demand_count > 0
                  ? `${item.active_demand_count} buyer${item.active_demand_count > 1 ? "s" : ""} · ${Math.round(item.demand_kg_open)} kg needed`
                  : "Steady demand"}
              </Text>
            </View>
            <View style={styles.scoreCol}>
              <Text style={styles.scoreValue}>{Math.round(item.opportunity_score)}</Text>
              <Text style={styles.scoreLabel}>score</Text>
            </View>
          </View>

          {/* Score bar */}
          <View style={styles.track}>
            <View
              style={[
                styles.progress,
                { width: `${Math.min(100, item.opportunity_score)}%` },
              ]}
            />
          </View>

          <View style={styles.cardStatsRow}>
            <View style={styles.cardStat}>
              <Text style={styles.cardStatLabel}>NET/kg</Text>
              <Text style={styles.cardStatValue}>{currency(item.best_net_per_kg)}</Text>
            </View>
            <View style={styles.cardStat}>
              <Text style={styles.cardStatLabel}>REC. WEIGHT</Text>
              <Text style={styles.cardStatValue}>{Math.round(item.recommended_weight_kg)} kg</Text>
            </View>
            <View style={styles.cardStat}>
              <Text style={styles.cardStatLabel}>EST. PAYOUT</Text>
              <Text style={styles.cardStatValueGreen}>{currency(item.expected_payout)}</Text>
            </View>
          </View>

          <Text style={styles.cardReasoning}>{item.reasoning}</Text>
        </TouchableOpacity>
      ))}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Feed regenerates every time you refresh. Pull down to refresh.
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
  heroKicker: { color: "#C2E8CB", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  heroMaterial: { marginTop: 8, color: colors.white, fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  heroStats: { flexDirection: "row", gap: 10, marginTop: 14 },
  heroStat: {
    flex: 1, padding: 10, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  heroStatLabel: { color: "#B8DFC2", fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  heroStatValue: { marginTop: 4, color: colors.white, fontSize: 15, fontWeight: "900" },
  heroReason: { marginTop: 14, color: "#D0E6D7", fontSize: 11, lineHeight: 16 },
  heroEstimate: { marginTop: 8, color: "#F8E5AE", fontSize: 12, fontWeight: "800" },
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
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  rankBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.greenLight,
    alignItems: "center", justifyContent: "center",
  },
  rankText: { color: colors.green, fontSize: 11, fontWeight: "900" },
  cardMaterial: { fontSize: 14, fontWeight: "800", color: colors.ink },
  cardMeta: { fontSize: 10, color: colors.muted, marginTop: 2 },
  scoreCol: { alignItems: "center" },
  scoreValue: { color: colors.orange, fontSize: 18, fontWeight: "900" },
  scoreLabel: { color: colors.muted, fontSize: 8, fontWeight: "700", letterSpacing: 0.5 },

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

  cardReasoning: { fontSize: 10, color: colors.muted, lineHeight: 14, fontStyle: "italic" },

  footer: { marginTop: 16, alignItems: "center" },
  footerText: { fontSize: 10, color: colors.muted, textAlign: "center" },
});