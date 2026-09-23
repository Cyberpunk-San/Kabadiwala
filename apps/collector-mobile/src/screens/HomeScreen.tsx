// src/screens/HomeScreen.tsx
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useEffect, useState } from "react";
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

      {/* Hero card */}
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>✦ {t("opportunity")}</Text>
        <Text style={styles.heroTitle}>{t("collectSmarter")}</Text>
        <Text style={styles.heroDescription}>{t("copperDemand")}</Text>
        <View style={styles.pills}>
          <Text style={styles.pill}>↗ +12% price up</Text>
          <Text style={styles.pill}>● {t("highDemand")}</Text>
        </View>
        <TouchableOpacity
          style={styles.heroButton}
          onPress={() =>
            navigation.navigate("Market", {
              material: "Copper cable",
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

      {/* Nearby demand */}
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
            material: "Copper cable",
            quality: "medium",
            weightKg: 35,
          })
        }
      >
        <MaterialCard
          material="Copper cable"
          price="₹612"
          note="EcoCycle · 2.4 km away"
          badge={t("highDemand").toUpperCase()}
        />
      </TouchableOpacity>

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
});