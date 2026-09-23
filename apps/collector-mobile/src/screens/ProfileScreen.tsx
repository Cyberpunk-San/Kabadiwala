// src/screens/ProfileScreen.tsx
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { colors } from "../constants/theme";
import { useTranslation } from "../hooks/useTranslation";
import type { RootTabParamList } from "../navigation/types";
import { getCollectorStats, type CollectorStats } from "../services/api/client";
import { getCurrentCoordinates } from "../services/location/gpsService";
import { useAuthStore } from "../store/authStore";
import { useAppStore } from "../store/appStore";
import { currency } from "../utils/format";

type Props = BottomTabScreenProps<RootTabParamList, "Profile">;

const TIER_COLORS: Record<string, string> = {
  bronze:   "#A96532",
  silver:   "#8897A2",
  gold:     "#D97706",
  platinum: "#4C51BF",
};

export function ProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const collector = useAuthStore((s) => s.collector);
  const signOut = useAuthStore((s) => s.signOut);
  const setOnline = useAppStore((s) => s.setOnline);
  const isOnline = useAppStore((s) => s.isOnline);

  const [stats, setStats] = useState<CollectorStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (!collector) return;
    setLoadingStats(true);
    getCollectorStats(collector.id)
      .then(setStats)
      .catch((err) => console.warn("[profile] stats fetch failed:", err))
      .finally(() => setLoadingStats(false));
  }, [collector?.id]);

  const refreshLocation = async () => {
    const loc = await getCurrentCoordinates();
    if (!loc) {
      Alert.alert(
        "Location",
        "Location permission not granted. Your exact location is never shown to buyers."
      );
      return;
    }
    Alert.alert(
      "Location refreshed",
      `Lat: ${loc.latitude.toFixed(4)}\nLng: ${loc.longitude.toFixed(4)}`
    );
  };

  const handleSignOut = () => {
    Alert.alert("Sign out?", "You can log back in with your phone number.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          // App.tsx will detect the missing collector and route to Onboarding
        },
      },
    ]);
  };

  if (!collector) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  const tierColor = TIER_COLORS[collector.tier] ?? TIER_COLORS.bronze;
  const initials = collector.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Identity */}
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.identityCopy}>
          <Text style={styles.name}>{collector.name}</Text>
          <Text style={styles.id}>
            {collector.id} · {collector.operating_area ?? "No area set"}
          </Text>
          <View
            style={[
              styles.kycBadge,
              collector.kyc_status === "VERIFIED"
                ? styles.kycVerified
                : styles.kycPending,
            ]}
          >
            <Text
              style={[
                styles.kycBadgeText,
                collector.kyc_status === "VERIFIED"
                  ? styles.kycVerifiedText
                  : styles.kycPendingText,
              ]}
            >
              {collector.kyc_status === "VERIFIED"
                ? "✓ KYC Verified"
                : collector.kyc_status === "IN_PROGRESS"
                ? "⏳ KYC in progress"
                : "⚠ KYC pending"}
            </Text>
          </View>
        </View>
      </View>

      {/* Aamdani Card */}
      <Text style={styles.kicker}>COLLECTOR ID CARD</Text>
      <View style={styles.aamdaniCard}>
        <View style={styles.aamdaniHeader}>
          <View>
            <Text style={styles.cardOrg}>MAI HU KABADIWALA</Text>
            <Text style={styles.cardMission}>NATIONAL E-WASTE ENTREPRENEUR NETWORK</Text>
          </View>
          <View style={styles.chipVisual}>
            <Text style={styles.chipText}>💳 CHIP</Text>
          </View>
        </View>

        <View style={styles.cardMiddle}>
          <View style={styles.cardPhotoBox}>
            <Text style={styles.cardPhotoInitials}>{initials}</Text>
            {collector.kyc_status === "VERIFIED" && (
              <View style={styles.photoShield}>
                <Text style={styles.photoShieldText}>✓</Text>
              </View>
            )}
          </View>
          <View style={styles.cardDetails}>
            <Text style={styles.cardHolderName}>{collector.name.toUpperCase()}</Text>
            <Text style={styles.cardId}>ID: {collector.id}</Text>
            <View style={[styles.tierBadge, { backgroundColor: tierColor }]}>
              <Text style={styles.tierBadgeText}>
                🏆 {collector.tier.toUpperCase()} TIER
              </Text>
            </View>
            {collector.kyc_status === "VERIFIED" && (
              <Text style={styles.cardGovtVerify}>✓ E-Shram & Social Security linked</Text>
            )}
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardBottom}>
          <View>
            <Text style={styles.statKicker}>TOTAL EARNINGS</Text>
            <Text style={styles.statValue}>
              {currency(collector.total_earnings)}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.statKicker}>LIFETIME WEIGHT</Text>
            <Text style={styles.statGreen}>
              🌱 {collector.total_weight_kg.toFixed(0)} kg
            </Text>
          </View>
        </View>
      </View>

      {/* Stats grid */}
      <Text style={styles.kicker}>YOUR STATS</Text>
      {loadingStats ? (
        <ActivityIndicator color={colors.green} style={{ marginVertical: 16 }} />
      ) : stats ? (
        <View style={styles.statsGrid}>
          <StatTile label="Total Lots"       value={String(stats.total_lots)} />
          <StatTile label="Rating"           value={`★ ${stats.rating.toFixed(1)}`} />
          <StatTile label="Avg / Lot"        value={currency(stats.avg_earnings_per_lot)} />
          <StatTile label="Avg / kg"         value={currency(stats.avg_price_per_kg)} />
          <StatTile
            label="Next Tier At"
            value={
              stats.next_tier_at_kg
                ? `${stats.next_tier_at_kg.toFixed(0)} kg`
                : "Top tier 🎉"
            }
            wide
          />
        </View>
      ) : (
        <Text style={styles.rowDescription}>Stats unavailable</Text>
      )}

      {/* KYC details (if provided) */}
      {collector.kyc_aadhaar_last4 && (
        <>
          <Text style={styles.kicker}>KYC DETAILS (SIMULATED)</Text>
          <View style={styles.card}>
            <Row label="Aadhaar" value={`**** **** ${collector.kyc_aadhaar_last4}`} />
            <Row label="PAN"     value={collector.kyc_pan_masked ?? "—"} />
            <Row
              label="Bank"
              value={collector.kyc_bank_account_last4 ? `****${collector.kyc_bank_account_last4}` : "—"}
            />
            <Row
              label="Verified On"
              value={collector.kyc_verified_at
                ? new Date(collector.kyc_verified_at).toDateString()
                : "—"}
            />
          </View>
        </>
      )}
            {/* Accessibility */}
      <Text style={styles.kicker}>ACCESSIBILITY</Text>
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate("Accessibility" as never)}
      >
        <View style={styles.row}>
          <View>
            <Text style={styles.rowTitle}>Voice, text size & simple mode</Text>
            <Text style={styles.rowDescription}>
              Turn on voice-guided navigation, larger fonts, and more
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
      </TouchableOpacity>
      {/* Connectivity */}
      <Text style={styles.kicker}>CONNECTIVITY</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.row}
          onPress={() => setOnline(!isOnline)}
        >
          <View>
            <Text style={styles.rowTitle}>
              {isOnline ? "🟢 Online" : "🟠 Offline"}
            </Text>
            <Text style={styles.rowDescription}>
              {isOnline
                ? "Lots auto-sync to the backend."
                : "New lots are queued locally."}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Location */}
      <Text style={styles.kicker}>LOCATION</Text>
      <TouchableOpacity style={styles.card} onPress={refreshLocation}>
        <View style={styles.row}>
          <View>
            <Text style={styles.rowTitle}>
              {collector.operating_area ?? "Set your operating area"}
            </Text>
            <Text style={styles.rowDescription}>
              Tap to refresh GPS
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
      </TouchableOpacity>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOut} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function StatTile({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.statTile, wide && styles.statTileWide]}>
      <Text style={styles.statTileLabel}>{label}</Text>
      <Text style={styles.statTileValue}>{value}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 19, paddingBottom: 40 },

  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream },

  identity: { flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 20 },
  avatar: {
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: "#9C6A4B", alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: colors.white,
  },
  avatarText: { color: colors.white, fontSize: 18, fontWeight: "900" },
  identityCopy: { flex: 1 },
  name: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  id: { marginTop: 2, color: colors.muted, fontSize: 10 },

  kycBadge: { alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  kycVerified: { backgroundColor: "#DCFCE7" },
  kycPending: { backgroundColor: "#FFF7ED" },
  kycBadgeText: { fontSize: 10, fontWeight: "800" },
  kycVerifiedText: { color: "#166534" },
  kycPendingText: { color: "#C2410C" },

  kicker: { marginTop: 8, marginBottom: 8, color: "#84948B", fontSize: 9, fontWeight: "800", letterSpacing: 1 },

  // Aamdani card
  aamdaniCard: {
    backgroundColor: "#164E3D", borderRadius: 20, padding: 18,
    marginBottom: 16, borderWidth: 1, borderColor: "#286D58",
  },
  aamdaniHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  cardOrg: { color: "#F6DE8F", fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  cardMission: { color: "#A8D8BA", fontSize: 7, fontWeight: "700", marginTop: 2 },
  chipVisual: { backgroundColor: "#C59A4E", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  chipText: { color: "#2B1A00", fontSize: 8, fontWeight: "900" },

  cardMiddle: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardPhotoBox: {
    width: 52, height: 58, backgroundColor: "#8C5839", borderRadius: 10,
    borderWidth: 2, borderColor: "#EAD6B8",
    alignItems: "center", justifyContent: "center", position: "relative",
  },
  cardPhotoInitials: { color: colors.white, fontSize: 15, fontWeight: "900" },
  photoShield: {
    position: "absolute", bottom: -4, right: -4, width: 16, height: 16, borderRadius: 8,
    backgroundColor: "#48BB78", alignItems: "center", justifyContent: "center",
  },
  photoShieldText: { color: colors.white, fontSize: 10, fontWeight: "900" },

  cardDetails: { flex: 1 },
  cardHolderName: { color: colors.white, fontSize: 14, fontWeight: "900", letterSpacing: 0.5 },
  cardId: { color: "#C2E8CB", fontSize: 9, fontWeight: "700", marginTop: 2 },
  tierBadge: { alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  tierBadgeText: { color: colors.white, fontSize: 8, fontWeight: "800" },
  cardGovtVerify: { color: "#9AE6B4", fontSize: 8, fontWeight: "700", marginTop: 4 },

  cardDivider: { height: 1, backgroundColor: "#266952", marginVertical: 12 },
  cardBottom: { flexDirection: "row", justifyContent: "space-between" },
  statKicker: { color: "#A8D8BA", fontSize: 8, fontWeight: "700" },
  statValue: { color: "#F6DE8F", fontSize: 16, fontWeight: "900", marginTop: 2 },
  statGreen: { color: colors.white, fontSize: 13, fontWeight: "800", marginTop: 2 },

  // Stats
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  statTile: {
    width: "48%", padding: 12, borderRadius: 14, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.line,
  },
  statTileWide: { width: "100%" },
  statTileLabel: { fontSize: 10, color: colors.muted, fontWeight: "700" },
  statTileValue: { fontSize: 16, color: colors.ink, fontWeight: "900", marginTop: 4 },

  card: {
    marginBottom: 16, padding: 14, borderWidth: 1, borderColor: colors.line,
    borderRadius: 16, backgroundColor: colors.white,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  rowTitle: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  rowDescription: { marginTop: 3, color: colors.muted, fontSize: 10, lineHeight: 14 },
  chevron: { color: colors.green, fontSize: 27, lineHeight: 28 },

  detailRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  detailLabel: { fontSize: 11, color: colors.muted, fontWeight: "700" },
  detailValue: { fontSize: 12, color: colors.ink, fontWeight: "800" },

  signOut: {
    marginTop: 8, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: "#FEB2B2", backgroundColor: "#FFF5F5",
    alignItems: "center",
  },
  signOutText: { color: "#C53030", fontSize: 13, fontWeight: "800" },
});