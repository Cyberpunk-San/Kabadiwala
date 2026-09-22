import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { LotCard } from "../components/LotCard";
import { MaterialCard } from "../components/MaterialCard";
import { VoiceButton } from "../components/VoiceButton";
import { colors } from "../constants/theme";
import { useTranslation } from "../hooks/useTranslation";
import type { RootTabParamList } from "../navigation/types";
import { speak } from "../services/voice/speech";
import { useAppStore } from "../store/appStore";
import { currency } from "../utils/format";

type Props = BottomTabScreenProps<RootTabParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const { language, t } = useTranslation();
  const lots = useAppStore((s) => s.lots);
  const isOnline = useAppStore((s) => s.isOnline);
  const profile = useAppStore((s) => s.profile);
  const role = useAppStore((s) => s.role);
  const weeklyEarnings = useAppStore((s) => s.weeklyEarnings);
  const weeklyWeight = useAppStore((s) => s.weeklyWeight);
  const weeklyGoalProgress = useAppStore((s) => s.weeklyGoalProgress);
  const adminStats = useAppStore((s) => s.adminStats);

  const totalEarnings = weeklyEarnings();
  const totalWeight = weeklyWeight();
  const progress = weeklyGoalProgress();
  const remaining = Math.max(0, (profile.weeklyGoal || 12000) - totalEarnings);
  const recentLots = lots.slice(0, 3);

  // ── Admin view ─────────────────────────────────────────────────────────────
  if (role === "admin") {
    const stats = adminStats;
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <View>
            <Text style={styles.roleTag}>🛡 ADMIN DASHBOARD</Text>
            <Text style={styles.greeting}>Namaskar, {profile.name}</Text>
            <Text style={styles.subgreeting}>{profile.jurisdiction}</Text>
          </View>
          <TouchableOpacity style={[styles.avatar, styles.avatarAdmin]} onPress={() => navigation.navigate("Profile")}>
            <Text style={styles.avatarText}>{profile.initials}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.adminGrid}>
          <AdminTile icon="👷" label="Active Collectors" value={stats.totalCollectors.toLocaleString()} accent="#3B82F6" />
          <AdminTile icon="📦" label="Lots Today" value={stats.totalLotsToday.toLocaleString()} accent={colors.green} />
          <AdminTile icon="⚖️" label="kg Today" value={`${stats.totalKgToday.toLocaleString()} kg`} accent="#F59E0B" />
          <AdminTile icon="💰" label="Flow Today" value={currency(stats.totalEarningsToday)} accent="#8B5CF6" />
          <AdminTile icon="⚠️" label="Hazard Open" value={stats.hazardLotsOpen.toString()} accent="#EF4444" />
          <AdminTile icon="🔄" label="Pending Sync" value={stats.pendingSyncLots.toString()} accent="#F97316" />
          <AdminTile icon="🌿" label="EPR Tonnage/mo" value={`${stats.eprTonnageMonth} T`} accent="#10B981" />
          <AdminTile icon="📍" label="Top Cluster" value={stats.topCluster.split(",")[0] ?? stats.topCluster} accent="#6366F1" />
        </View>

        <Text style={styles.sectionTitle}>Live Lot Feed — All Collectors</Text>
        {lots.length ? lots.map((lot) => (
          <LotCard key={lot.id} lot={lot} syncedLabel={t("synced")} pendingLabel={t("pendingSync")} />
        )) : (
          <View style={styles.emptyLots}>
            <Text style={styles.emptyText}>No lots collected yet today. Demo lots visible after first sync.</Text>
          </View>
        )}
      </ScrollView>
    );
  }

  // ── User (household) view ──────────────────────────────────────────────────
  if (role === "user") {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <View>
            <Text style={styles.roleTag}>🏠 CITIZEN PORTAL</Text>
            <Text style={styles.greeting}>Namaskar, {profile.name}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.dot, !isOnline && styles.dotOffline]} />
              <Text style={styles.status}>{isOnline ? "Online" : "Offline"}</Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.avatar, styles.avatarUser]} onPress={() => navigation.navigate("Profile")}>
            <Text style={styles.avatarText}>{profile.initials}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>✦ SCHEDULE E-WASTE PICKUP</Text>
          <Text style={styles.heroTitle}>Dispose responsibly</Text>
          <Text style={styles.heroDescription}>
            A verified Kabadiwala will collect your old electronics safely from your doorstep.
          </Text>
          <View style={styles.pills}>
            <Text style={styles.pill}>✓ Free Pickup</Text>
            <Text style={styles.pill}>● CPCB Certified</Text>
            <Text style={styles.pill}>🌱 Zero Landfill</Text>
          </View>
          <TouchableOpacity style={styles.heroButton} onPress={() => navigation.navigate("BazarBhav")}>
            <Text style={styles.heroButtonText}>Check Scrap Rates</Text>
            <Text style={styles.arrow}>→</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.userCards}>
          <View style={styles.userCard}>
            <Text style={styles.userCardIcon}>📅</Text>
            <Text style={styles.userCardTitle}>Last Pickup</Text>
            <Text style={styles.userCardValue}>{profile.lastPickupDate ?? "—"}</Text>
          </View>
          <View style={styles.userCard}>
            <Text style={styles.userCardIcon}>🌍</Text>
            <Text style={styles.userCardTitle}>CO₂ Saved</Text>
            <Text style={styles.userCardValue}>34 kg</Text>
          </View>
          <View style={styles.userCard}>
            <Text style={styles.userCardIcon}>♻️</Text>
            <Text style={styles.userCardTitle}>Items Recycled</Text>
            <Text style={styles.userCardValue}>12 items</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Nearby Kabadiwala Availability</Text>
        <MaterialCard material="Copper cable" price="₹612" note="Ramesh Kumar · 1.2 km away" badge="AVAILABLE" />
        <MaterialCard material="Mixed e-waste" price="₹85" note="Santosh Patil · 2.8 km away" badge="FREE PICKUP" />
      </ScrollView>
    );
  }

  // ── Kabadiwala (collector) view ────────────────────────────────────────────
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topbar}>
        <View>
          <Text style={styles.roleTag}>♻️ KABADIWALA</Text>
          <Text style={styles.greeting}>{t("welcome")}, {profile.name.split(" ")[0]}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, !isOnline && styles.dotOffline]} />
            <Text style={styles.status}>{isOnline ? t("online") : t("offline")}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.avatar} accessibilityLabel="Profile" onPress={() => navigation.navigate("Profile")}>
          <Text style={styles.avatarText}>{profile.initials}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>✦ {t("opportunity")}</Text>
        <Text style={styles.heroTitle}>{t("collectSmarter")}</Text>
        <Text style={styles.heroDescription}>{t("copperDemand")}</Text>
        <View style={styles.pills}>
          <Text style={styles.pill}>↗ +12% price up</Text>
          <Text style={styles.pill}>● {t("highDemand")}</Text>
        </View>
        <TouchableOpacity style={styles.heroButton} onPress={() => navigation.navigate("Market", { material: "Copper cable", quality: "medium", weightKg: 35 })}>
          <Text style={styles.heroButtonText}>{t("viewOpportunities")}</Text>
          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.action, styles.primaryAction]} onPress={() => navigation.navigate("Collect")}>
          <Text style={styles.actionIcon}>⌑</Text>
          <Text style={styles.actionText}>{t("sellMaterial")}</Text>
          <Text style={styles.actionHint}>{t("takePhoto")}</Text>
        </TouchableOpacity>
        <VoiceButton label={t("speakEntry")} onPress={() => speak("Tell me the material and approximate weight.", language)} />
        <TouchableOpacity style={styles.priceAction} onPress={() => (navigation as any).navigate("BazarBhav")}>
          <Text style={styles.rupee}>₹</Text>
          <Text style={styles.priceActionText}>{t("bazarBhav")}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.kicker}>SMART FOR YOU</Text>
          <Text style={styles.sectionTitle}>{t("nearbyDemand")}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate("Market")}>
          <Text style={styles.link}>See all</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={() => navigation.navigate("Market", { material: "Copper cable", quality: "medium", weightKg: 35 })}>
        <MaterialCard material="Copper cable" price="₹612" note="EcoCycle · 2.4 km away" badge={t("highDemand").toUpperCase()} />
      </TouchableOpacity>

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
          <Text style={styles.statValue}>{currency(totalEarnings)}</Text>
          <Text style={styles.statHint}>↑ {lots.length > 0 ? `${lots.length} lots` : "18% vs last week"}</Text>
        </View>
        <View style={[styles.stat, styles.amberStat]}>
          <Text style={styles.statLabel}>{t("collected")}</Text>
          <Text style={styles.statValue}>{totalWeight} kg</Text>
          <Text style={styles.statHint}>Top: {lots[0]?.material ?? "Copper"}</Text>
        </View>
      </View>

      <View style={styles.goal}>
        <View style={styles.goalHeader}>
          <Text style={styles.goalText}>{t("weeklyGoal")}</Text>
          <Text style={styles.goalAmount}>{currency(totalEarnings)} / {currency(profile.weeklyGoal ?? 12000)}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.progress, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.goalHint}>
          {remaining > 0
            ? <>Just <Text style={styles.goalStrong}>{currency(remaining)}</Text> more to reach your goal!</>
            : <Text style={styles.goalStrong}>🎉 Weekly goal achieved!</Text>}
        </Text>
      </View>

      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.kicker}>{t("traceability").toUpperCase()}</Text>
          <Text style={styles.sectionTitle}>{t("myLots")}</Text>
        </View>
      </View>
      {recentLots.length
        ? recentLots.map((lot) => <LotCard key={lot.id} lot={lot} syncedLabel={t("synced")} pendingLabel={t("pendingSync")} />)
        : <View style={styles.emptyLots}><Text style={styles.emptyText}>{t("noLots")}</Text></View>}
    </ScrollView>
  );
}

function AdminTile({ icon, label, value, accent }: { icon: string; label: string; value: string; accent: string }) {
  return (
    <View style={[styles.adminTile, { borderLeftColor: accent }]}>
      <Text style={styles.adminTileIcon}>{icon}</Text>
      <Text style={styles.adminTileLabel}>{label}</Text>
      <Text style={[styles.adminTileValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 19, paddingBottom: 32 },

  topbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 17 },
  roleTag: { color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: 1, marginBottom: 2 },
  greeting: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  subgreeting: { color: colors.muted, fontSize: 10, marginTop: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#42A866" },
  dotOffline: { backgroundColor: "#D98B38" },
  status: { color: colors.muted, fontSize: 10 },
  avatar: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: "#9C6A4B", borderWidth: 2, borderColor: colors.white },
  avatarAdmin: { backgroundColor: "#1E3A8A" },
  avatarUser: { backgroundColor: "#7C3AED" },
  avatarText: { color: colors.white, fontSize: 11, fontWeight: "800" },

  hero: { padding: 23, borderRadius: 25, backgroundColor: colors.green, overflow: "hidden" },
  eyebrow: { color: "#C2E8CB", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  heroTitle: { marginTop: 9, color: colors.white, fontSize: 32, lineHeight: 35, fontWeight: "800", letterSpacing: -1 },
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

  // Admin styles
  adminGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  adminTile: { width: "47%", padding: 12, backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.line, borderLeftWidth: 4 },
  adminTileIcon: { fontSize: 20, marginBottom: 4 },
  adminTileLabel: { color: colors.muted, fontSize: 9, fontWeight: "700" },
  adminTileValue: { fontSize: 15, fontWeight: "900", marginTop: 3 },

  // User styles
  userCards: { flexDirection: "row", gap: 8, marginVertical: 16 },
  userCard: { flex: 1, padding: 12, backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.line, alignItems: "center" },
  userCardIcon: { fontSize: 22 },
  userCardTitle: { color: colors.muted, fontSize: 9, fontWeight: "700", marginTop: 4 },
  userCardValue: { color: colors.ink, fontSize: 12, fontWeight: "800", marginTop: 2 }
});
