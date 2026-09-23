// src/screens/HomeScreen.tsx
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { LotCard } from "../components/LotCard";
import { MaterialCard } from "../components/MaterialCard";
import { VoiceButton } from "../components/VoiceButton";
import { colors } from "../constants/theme";
import { useTranslation } from "../hooks/useTranslation";
import type { RootTabParamList } from "../navigation/types";
import { getCollectorStats, type CollectorStats } from "../services/api/client";
import { getTopOpportunities } from "../services/ai/opportunityScorer";
import { findOptimalCluster } from "../services/logistics/routeOptimizer";
import { speak } from "../services/voice/speech";
import { useAuthStore } from "../store/authStore";
import { useAppStore } from "../store/appStore";
import { currency } from "../utils/format";

type Props = BottomTabScreenProps<RootTabParamList, "Home">;

const TIER_COLORS: Record<string, string> = {
  bronze:   "#A96532",
  silver:   "#8897A2",
  gold:     "#D97706",
  platinum: "#4C51BF",
};

export function HomeScreen({ navigation }: Props) {
  const { language, t } = useTranslation();
  const lots = useAppStore((s) => s.lots);
  const isOnline = useAppStore((s) => s.isOnline);
  const collector = useAuthStore((s) => s.collector);
  const refreshAuth = useAuthStore((s) => s.refresh);

  const [stats, setStats] = useState<CollectorStats | null>(null);

  // Refresh collector profile + stats on mount
  useEffect(() => {
    if (!collector) return;
    void refreshAuth();
    getCollectorStats(collector.id)
      .then(setStats)
      .catch((err) => console.warn("[home] stats fetch failed:", err));
  }, [collector?.id]);

  if (!collector) {
    return (
      <View style={styles.screen}>
        <Text style={{ padding: 20, color: colors.muted }}>Loading collector…</Text>
      </View>
    );
  }

  const initials = collector.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const firstName = collector.name.split(" ")[0];
  const tierColor = TIER_COLORS[collector.tier] ?? TIER_COLORS.bronze;

  // Prefer backend stats; fall back to collector totals
  const weeklyEarnings = stats?.total_earnings ?? collector.total_earnings;
  const weeklyWeight = stats?.total_weight_kg ?? collector.total_weight_kg;
  const totalLots = stats?.total_lots ?? collector.total_lots;

  const weeklyGoal = 12000;
  const progress = Math.min(100, Math.round((weeklyEarnings / weeklyGoal) * 100));
  const remaining = Math.max(0, weeklyGoal - weeklyEarnings);

  const recentLots = lots.slice(0, 3);

  // ── ML signals ─────────────────────────────────────────────────────────────
  // Top gainer from ML opportunity scorer
  const topOpps = useMemo(() => getTopOpportunities(3), []);
  const topGainer = topOpps[0];

  // Best drop-off cluster from regional intel engine
  const collectorCoords = collector.latitude && collector.longitude
    ? { latitude: collector.latitude, longitude: collector.longitude }
    : { latitude: 18.5204, longitude: 73.8567 }; // Pune default

  const clusterScores = useMemo(
    () => topGainer ? findOptimalCluster(topGainer.material, collectorCoords) : [],
    [collector.latitude, collector.longitude, topGainer?.material]
  );
  const bestCluster = clusterScores[0];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Top bar */}
      <View style={styles.topbar}>
        <View>
          <Text style={styles.roleTag}>
            ♻️ KABADIWALA · <Text style={{ color: tierColor }}>{collector.tier.toUpperCase()}</Text>
          </Text>
          <Text style={styles.greeting}>
            {t("welcome")}, {firstName}
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, !isOnline && styles.dotOffline]} />
            <Text style={styles.status}>
              {isOnline ? t("online") : t("offline")} · {collector.operating_area ?? "Pune"}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.avatar}
          accessibilityLabel="Profile"
          onPress={() => navigation.navigate("Profile")}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </TouchableOpacity>
      </View>

      {/* Hero card — ML opportunity */}
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>✦ {t("opportunity")}</Text>
        <Text style={styles.heroTitle}>
          {topGainer
            ? (language === "hi" ? "आज क्या बेचें?" : language === "mr" ? "आज काय विकायचे?" : "What to sell today?")
            : t("collectSmarter")}
        </Text>
        <Text style={styles.heroDescription}>
          {topGainer
            ? (language === "hi"
                ? `${topGainer.material} — स्कोर ${topGainer.score}/100, मांग ${topGainer.demand === "HIGH" ? "उच्च" : "सामान्य"}`
                : language === "mr"
                ? `${topGainer.material} — स्कोर ${topGainer.score}/100, मागणी ${topGainer.demand === "HIGH" ? "जास्त" : "सामान्य"}`
                : `${topGainer.material} — AI score ${topGainer.score}/100, ${topGainer.demand} demand`)
            : t("copperDemand")}
        </Text>
        <View style={styles.pills}>
          {topGainer ? (
            <>
              <Text style={styles.pill}>
                {topGainer.trend === "up" ? "↗" : topGainer.trend === "down" ? "↘" : "→"} {topGainer.changePercent > 0 ? "+" : ""}{topGainer.changePercent}%
              </Text>
              <Text style={styles.pill}>Grade {topGainer.grade}</Text>
              <Text style={styles.pill}>₹{topGainer.currentPricePerKg}/kg</Text>
            </>
          ) : (
            <>
              <Text style={styles.pill}>↗ +12% price up</Text>
              <Text style={styles.pill}>● {t("highDemand")}</Text>
            </>
          )}
        </View>
        <TouchableOpacity
          style={styles.heroButton}
          onPress={() =>
            navigation.navigate("Market", {
              material: (topGainer?.material ?? "Copper cable") as any,
              quality: "medium",
              weightKg: 35,
            })
          }
        >
          <Text style={styles.heroButtonText}>{t("viewOpportunities")}</Text>
          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.action, styles.primaryAction]}
          onPress={() => navigation.navigate("Collect")}
        >
          <Text style={styles.actionIcon}>⌑</Text>
          <Text style={styles.actionText}>{t("sellMaterial")}</Text>
          <Text style={styles.actionHint}>{t("takePhoto")}</Text>
        </TouchableOpacity>

        <VoiceButton
          label={t("speakEntry")}
          onPress={() =>
            speak("Tell me the material and approximate weight.", language)
          }
        />

        <TouchableOpacity
          style={styles.priceAction}
          onPress={() => (navigation as any).navigate("BazarBhav")}
        >
          <Text style={styles.rupee}>₹</Text>
          <Text style={styles.priceActionText}>{t("bazarBhav")}</Text>
        </TouchableOpacity>
      </View>

      {/* Nearby demand — ML powered */}
      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.kicker}>SMART FOR YOU</Text>
          <Text style={styles.sectionTitle}>{t("nearbyDemand")}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate("Market")}>
          <Text style={styles.link}>See all</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        onPress={() =>
          navigation.navigate("Market", {
            material: (topGainer?.material ?? "Copper cable") as any,
            quality: "medium",
            weightKg: 35,
          })
        }
      >
        <MaterialCard
          material={topGainer?.material ?? "Copper cable"}
          price={`₹${topGainer?.currentPricePerKg ?? 612}`}
          note={`Grade ${topGainer?.grade ?? "A"} · ${topGainer?.demand ?? "HIGH"} demand`}
          badge={topGainer?.demand === "HIGH" ? t("highDemand").toUpperCase() : "ACTIVE DEMAND"}
        />
      </TouchableOpacity>

      {/* Regional Intelligence: Best Drop-off Hub */}
      {bestCluster && (
        <View style={styles.clusterCard}>
          <View style={styles.clusterHeader}>
            <Text style={styles.clusterKicker}>📍 REGIONAL INTELLIGENCE</Text>
            <View style={styles.clusterScorePill}>
              <Text style={styles.clusterScoreText}>{bestCluster.score}/100</Text>
            </View>
          </View>
          <Text style={styles.clusterTitle}>
            {language === "hi" ? "आज का सबसे अच्छा हब:" :
             language === "mr" ? "आजचा सर्वोत्तम हब:" :
             "Best Drop-off Hub Today:"}
          </Text>
          <Text style={styles.clusterName}>{bestCluster.cluster.name}</Text>
          <View style={styles.clusterStats}>
            <View style={styles.clusterStat}>
              <Text style={styles.clusterStatLabel}>DISTANCE</Text>
              <Text style={styles.clusterStatValue}>{bestCluster.distanceKm} km</Text>
            </View>
            <View style={styles.clusterStat}>
              <Text style={styles.clusterStatLabel}>ETA</Text>
              <Text style={styles.clusterStatValue}>~{bestCluster.estimatedETAMinutes} min</Text>
            </View>
            <View style={styles.clusterStat}>
              <Text style={styles.clusterStatLabel}>DEMAND</Text>
              <Text style={styles.clusterStatValue}>{(bestCluster.demandPressure * 100).toFixed(0)}%</Text>
            </View>
            <View style={styles.clusterStat}>
              <Text style={styles.clusterStatLabel}>ACCEPTS</Text>
              <Text style={[styles.clusterStatValue, { color: bestCluster.acceptsMaterial ? colors.green : colors.orange }]}>
                {bestCluster.acceptsMaterial ? "✓ Yes" : "≠ Check"}
              </Text>
            </View>
          </View>
          <Text style={styles.clusterReason} numberOfLines={2}>
            {language === "hi" ? bestCluster.reasoningHi :
             language === "mr" ? bestCluster.reasoningMr :
             bestCluster.reasoning}
          </Text>
        </View>
      )}

      {/* Business stats */}
      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.kicker}>THIS WEEK</Text>
          <Text style={styles.sectionTitle}>{t("yourBusiness")}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate("Earnings")}>
          <Text style={styles.link}>Details</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.stats}>
        <View style={[styles.stat, styles.greenStat]}>
          <Text style={styles.statLabel}>{t("earned")}</Text>
          <Text style={styles.statValue}>{currency(weeklyEarnings)}</Text>
          <Text style={styles.statHint}>
            ↑ {totalLots} lots lifetime
          </Text>
        </View>
        <View style={[styles.stat, styles.amberStat]}>
          <Text style={styles.statLabel}>{t("collected")}</Text>
          <Text style={styles.statValue}>{weeklyWeight.toFixed(0)} kg</Text>
          <Text style={styles.statHint}>
            Top: {lots[0]?.material ?? "Copper"}
          </Text>
        </View>
      </View>

      {/* Goal */}
      <View style={styles.goal}>
        <View style={styles.goalHeader}>
          <Text style={styles.goalText}>{t("weeklyGoal")}</Text>
          <Text style={styles.goalAmount}>
            {currency(weeklyEarnings)} / {currency(weeklyGoal)}
          </Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.progress, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.goalHint}>
          {remaining > 0 ? (
            <>
              Just <Text style={styles.goalStrong}>{currency(remaining)}</Text> more to reach your goal!
            </>
          ) : (
            <Text style={styles.goalStrong}>🎉 Weekly goal achieved!</Text>
          )}
        </Text>
      </View>

      {/* My lots */}
      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.kicker}>{t("traceability").toUpperCase()}</Text>
          <Text style={styles.sectionTitle}>{t("myLots")}</Text>
        </View>
      </View>
      {recentLots.length ? (
        recentLots.map((lot) => (
          <LotCard
            key={lot.id}
            lot={lot}
            syncedLabel={t("synced")}
            pendingLabel={t("pendingSync")}
          />
        ))
      ) : (
        <View style={styles.emptyLots}>
          <Text style={styles.emptyText}>{t("noLots")}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 19, paddingBottom: 32 },

  topbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 17 },
  roleTag: { color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: 1, marginBottom: 2 },
  greeting: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#42A866" },
  dotOffline: { backgroundColor: "#D98B38" },
  status: { color: colors.muted, fontSize: 10 },
  avatar: {
    width: 42, height: 42,
    alignItems: "center", justifyContent: "center",
    borderRadius: 21, backgroundColor: "#9C6A4B",
    borderWidth: 2, borderColor: colors.white,
  },
  avatarText: { color: colors.white, fontSize: 12, fontWeight: "900" },

  hero: { padding: 23, borderRadius: 25, backgroundColor: colors.green, overflow: "hidden" },
  eyebrow: { color: "#C2E8CB", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  heroTitle: { marginTop: 9, color: colors.white, fontSize: 30, lineHeight: 34, fontWeight: "800", letterSpacing: -1 },
  heroDescription: { marginTop: 8, maxWidth: 270, color: "#D0E6D7", fontSize: 13, lineHeight: 19 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },
  pill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, overflow: "hidden", backgroundColor: "#286652", color: "#F6DE8F", fontSize: 9, fontWeight: "700" },
  heroButton: { flexDirection: "row", justifyContent: "space-between", marginTop: 18, padding: 12, borderRadius: 12, backgroundColor: "#F8E5AE" },
  heroButtonText: { color: colors.green, fontSize: 12, fontWeight: "800" },
  arrow: { color: colors.green, fontSize: 16, fontWeight: "800" },

  actions: { flexDirection: "row", gap: 8, marginTop: 14, alignItems: "stretch" },
  action: { flex: 1, padding: 11, borderRadius: 16 },
  primaryAction: { backgroundColor: colors.orange },
  actionIcon: { color: colors.white, fontSize: 23 },
  actionText: { marginTop: 8, color: colors.white, fontSize: 11, fontWeight: "800" },
  actionHint: { marginTop: 3, color: "#FFE6D0", fontSize: 8 },
  priceAction: { flex: 0.67, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.white },
  rupee: { color: colors.green, fontSize: 20, fontWeight: "800" },
  priceActionText: { marginTop: 4, color: colors.ink, fontSize: 10, fontWeight: "700" },

  sectionHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 27, marginBottom: 11 },
  kicker: { color: "#84948B", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  sectionTitle: { marginTop: 3, color: colors.ink, fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  link: { color: colors.green, fontSize: 11, fontWeight: "800" },

  stats: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, padding: 14, borderRadius: 17 },
  greenStat: { backgroundColor: colors.greenLight },
  amberStat: { backgroundColor: "#FFF0C8" },
  statLabel: { color: colors.ink, fontSize: 10 },
  statValue: { marginTop: 8, color: colors.green, fontSize: 19, fontWeight: "800" },
  statHint: { marginTop: 4, color: "#5A8868", fontSize: 9 },

  goal: { marginTop: 10, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.white },
  goalHeader: { flexDirection: "row", justifyContent: "space-between" },
  goalText: { color: colors.ink, fontSize: 11 },
  goalAmount: { color: colors.green, fontSize: 11, fontWeight: "700" },
  track: { height: 7, marginVertical: 11, overflow: "hidden", borderRadius: 4, backgroundColor: "#E6EDE7" },
  progress: { height: "100%", borderRadius: 4, backgroundColor: "#49A36B" },
  goalHint: { color: colors.muted, fontSize: 10 },
  goalStrong: { color: colors.orange, fontWeight: "800" },

  emptyLots: { padding: 15, borderWidth: 1, borderStyle: "dashed", borderColor: "#C6D8CB", borderRadius: 15 },
  emptyText: { color: colors.muted, fontSize: 11, lineHeight: 16 },

  // Regional Intelligence cluster card
  clusterCard: {
    marginTop: 10, padding: 14, borderRadius: 18,
    backgroundColor: "#EFF6FF",
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  clusterHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  clusterKicker: { fontSize: 8, fontWeight: "900", color: "#1D4ED8", letterSpacing: 0.8 },
  clusterScorePill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: "#1D4ED8" },
  clusterScoreText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  clusterTitle: { fontSize: 10, color: "#374151", marginBottom: 2 },
  clusterName: { fontSize: 16, fontWeight: "900", color: "#1E3A5F", marginBottom: 8 },
  clusterStats: { flexDirection: "row", gap: 6, marginBottom: 8 },
  clusterStat: { flex: 1, padding: 7, borderRadius: 9, backgroundColor: "rgba(255,255,255,.7)" },
  clusterStatLabel: { fontSize: 7, fontWeight: "800", color: "#6B7280", letterSpacing: 0.5 },
  clusterStatValue: { marginTop: 3, fontSize: 11, fontWeight: "900", color: "#1E3A5F" },
  clusterReason: { fontSize: 9, color: "#4B5563", lineHeight: 13, fontStyle: "italic" },
});