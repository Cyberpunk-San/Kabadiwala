import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";

import { LotCard } from "../components/LotCard";
import { colors } from "../constants/theme";
import { useTranslation } from "../hooks/useTranslation";
import type { RootTabParamList } from "../navigation/types";
import { getCurrentCoordinates } from "../services/location/gpsService";
import { DEMO_PROFILES, useAppStore } from "../store/appStore";
import { currency } from "../utils/format";
import type { Language, UserRole } from "../types/domain";
import { speak } from "../services/voice/speech";

type Props = BottomTabScreenProps<RootTabParamList, "Profile">;

const languages: Array<{ id: Language; native: string; name: string }> = [
  { id: "en", native: "English", name: "English" },
  { id: "hi", native: "हिन्दी", name: "Hindi" },
  { id: "mr", native: "मराठी", name: "Marathi" }
];

const ROLES: Array<{ id: UserRole; label: string; icon: string; desc: string; color: string }> = [
  { id: "kabadiwala", label: "Kabadiwala", icon: "♻️", desc: "Scrap collector / micro-entrepreneur", color: colors.green },
  { id: "user", label: "Citizen / User", icon: "🏠", desc: "Household e-waste generator", color: "#7C3AED" },
  { id: "admin", label: "Admin / Authority", icon: "🛡", desc: "CPCB / Municipal oversight", color: "#1E3A8A" }
];

const TIER_COLORS: Record<string, string> = {
  bronze: "#A96532",
  silver: "#8897A2",
  gold: "#D97706",
  platinum: "#4C51BF"
};

export function ProfileScreen({ navigation }: Props) {
  const { language, t } = useTranslation();
  const setLanguage = useAppStore((s) => s.setLanguage);
  const isOnline = useAppStore((s) => s.isOnline);
  const setOnline = useAppStore((s) => s.setOnline);
  const lots = useAppStore((s) => s.lots);
  const profile = useAppStore((s) => s.profile);
  const role = useAppStore((s) => s.role);
  const setRole = useAppStore((s) => s.setRole);
  const weeklyEarnings = useAppStore((s) => s.weeklyEarnings);

  const enableLocation = async () => {
    const location = await getCurrentCoordinates();
    if (!location) {
      Alert.alert(t("location"), "Location permission was not granted. Your exact location is never shown to buyers.");
      return;
    }
    Alert.alert(t("location"), `Connected to ${profile.cluster}. Buyers can now dispatch instant pickup vehicles.`);
  };

  const callHelpline = () => {
    Alert.alert(
      "Collector Emergency Support",
      "Calling 24x7 Kabadiwala Grievance & Fair Pricing Helpline: 1800-890-3927 (Toll Free). Available in Hindi, Marathi, and English.",
      [{ text: "OK" }]
    );
  };

  // Monthly income derived from weekly × ~4.3
  const monthlyAamdani = profile.monthlyAamdani ?? Math.round(weeklyEarnings() * 4.3);
  const tierColor = TIER_COLORS[profile.tier ?? "gold"] ?? TIER_COLORS.gold;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* Identity Top */}
      <View style={styles.identity}>
        <View style={[styles.avatar, { backgroundColor: role === "admin" ? "#1E3A8A" : role === "user" ? "#7C3AED" : "#9C6A4B" }]}>
          <Text style={styles.avatarText}>{profile.initials}</Text>
        </View>
        <View style={styles.identityCopy}>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.id}>
            {role === "kabadiwala"
              ? `Collector ID · ${profile.collectorId} · ${profile.cluster}`
              : role === "admin"
              ? `Admin · ${profile.jurisdiction}`
              : `User · ${profile.cluster}`}
          </Text>
          <View style={[styles.verified, { backgroundColor: role === "admin" ? "#EFF6FF" : role === "user" ? "#F5F3FF" : colors.greenLight }]}>
            <Text style={[styles.verifiedText, { color: role === "admin" ? "#1E3A8A" : role === "user" ? "#7C3AED" : colors.green }]}>
              {role === "kabadiwala" ? "✓ Verified Micro-Entrepreneur" : role === "admin" ? "🛡 Authority Account" : "🏠 Citizen Account"}
            </Text>
          </View>
        </View>
      </View>

      {/* ── ROLE SWITCHER ──────────────────────────────────────────────── */}
      <Text style={styles.kicker}>SWITCH ROLE (DEMO)</Text>
      <View style={styles.roleList}>
        {ROLES.map((r) => (
          <TouchableOpacity
            key={r.id}
            style={[styles.roleBtn, role === r.id && { borderColor: r.color, backgroundColor: `${r.color}10` }]}
            onPress={() => setRole(r.id)}
          >
            <Text style={styles.roleIcon}>{r.icon}</Text>
            <View style={styles.roleCopy}>
              <Text style={[styles.roleLabel, role === r.id && { color: r.color }]}>{r.label}</Text>
              <Text style={styles.roleDesc}>{r.desc}</Text>
            </View>
            {role === r.id && (
              <View style={[styles.roleTick, { backgroundColor: r.color }]}>
                <Text style={styles.roleTickText}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* ── KABADIWALA: Aamdani Card ─────────────────────────────────────── */}
      {role === "kabadiwala" && (
        <>
          <Text style={styles.kicker}>{t("aamdaniCard").toUpperCase()}</Text>
          <View style={styles.aamdaniCard}>
            <View style={styles.aamdaniCardHeader}>
              <View>
                <Text style={styles.cardOrg}>MAI HU KABADIWALA</Text>
                <Text style={styles.cardMission}>NATIONAL E-WASTE ENTREPRENEUR NETWORK</Text>
              </View>
              <View style={styles.chipVisual}>
                <Text style={styles.chipText}>💳 CHIP</Text>
              </View>
            </View>

            <View style={styles.aamdaniCardMiddle}>
              <View style={styles.cardPhotoBox}>
                <Text style={styles.cardPhotoInitials}>{profile.initials}</Text>
                <View style={styles.photoShield}>
                  <Text style={styles.photoShieldText}>✓</Text>
                </View>
              </View>
              <View style={styles.cardDetails}>
                <Text style={styles.cardHolderName}>{profile.name.toUpperCase()}</Text>
                <Text style={styles.cardWarriorId}>ID: MHK-IND-{profile.collectorId?.replace("CLT-", "") ?? "00000"}</Text>
                <View style={styles.tierRow}>
                  <View style={[styles.goldBadge, { backgroundColor: tierColor }]}>
                    <Text style={styles.goldBadgeText}>🏆 {(profile.tier ?? "gold").toUpperCase()} TIER</Text>
                  </View>
                </View>
                <Text style={styles.cardGovtVerify}>✓ E-Shram & Social Security Linked</Text>
              </View>
              <View style={styles.cardQrStamp}>
                <Text style={styles.qrStampIcon}>▦</Text>
                <Text style={styles.qrStampText}>VERIFIED</Text>
              </View>
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.aamdaniBottom}>
              <View>
                <Text style={styles.statKicker}>{t("monthlyAamdani")}</Text>
                <Text style={styles.statIncome}>{currency(monthlyAamdani)} / mo</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.statKicker}>GREEN CREDITS</Text>
                <Text style={styles.statGreenScore}>🌱 {profile.greenKgSaved ?? 0} kg saved</Text>
              </View>
            </View>

            <View style={styles.carbonStrip}>
              <Text style={styles.carbonStripText}>
                🌍 CO₂ Offset: {profile.co2OffsetKg ?? 0} kg | Cluster: {profile.cluster}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.sosButton} onPress={callHelpline}>
            <Text style={styles.sosIcon}>📞</Text>
            <View style={styles.sosCopy}>
              <Text style={styles.sosTitle}>{t("emergencyHelp")}</Text>
              <Text style={styles.sosSubtitle}>Toll-Free Fair Weighing & Police Assistance</Text>
            </View>
            <Text style={styles.sosCallText}>CALL</Text>
          </TouchableOpacity>
        </>
      )}

      {/* ── USER: Pickup History ──────────────────────────────────────────── */}
      {role === "user" && (
        <>
          <Text style={styles.kicker}>MY PICKUP HISTORY</Text>
          <View style={styles.card}>
            <Text style={styles.rowTitle}>Last Pickup</Text>
            <Text style={styles.rowDescription}>{profile.lastPickupDate ?? "No pickup scheduled yet."}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.rowTitle}>Registered Address</Text>
            <Text style={styles.rowDescription}>{profile.address ?? "No address set."}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.rowTitle}>CO₂ Saved (Lifetime)</Text>
            <Text style={[styles.rowTitle, { color: colors.green }]}>34 kg offset 🌱</Text>
          </View>
        </>
      )}

      {/* ── ADMIN: System Summary ──────────────────────────────────────────── */}
      {role === "admin" && (
        <>
          <Text style={styles.kicker}>ADMIN OVERVIEW</Text>
          <View style={styles.card}>
            <Text style={styles.rowTitle}>Jurisdiction</Text>
            <Text style={styles.rowDescription}>{profile.jurisdiction}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.rowTitle}>Access Level</Text>
            <Text style={[styles.rowDescription, { color: "#1E3A8A", fontWeight: "700" }]}>Full Read + Anomaly Alerts</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.rowTitle}>CPCB Reports</Text>
            <Text style={styles.rowDescription}>EPR Form-2 & Form-3 auto-generated monthly. Last export: Sept 2026.</Text>
          </View>
        </>
      )}

      {/* Connectivity Switch */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View>
            <Text style={styles.rowTitle}>{isOnline ? t("online") : t("offline")}</Text>
            <Text style={styles.rowDescription}>
              {isOnline ? "SQLite will auto-sync lots with buyer network." : t("offline")}
            </Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={setOnline}
            trackColor={{ false: "#C5D0C7", true: "#74AF8A" }}
            thumbColor={colors.white}
          />
        </View>
      </View>

      {/* Language Preference */}
      <Text style={styles.kicker}>{t("chooseLanguage").toUpperCase()}</Text>
      <View style={styles.languageList}>
        {languages.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => { setLanguage(item.id); speak(item.name, item.id); }}
            style={[styles.language, language === item.id && styles.languageOn]}
          >
            <Text style={[styles.languageNative, language === item.id && styles.languageTextOn]}>{item.native}</Text>
            <Text style={[styles.languageName, language === item.id && styles.languageTextOn]}>
              {item.name} {language === item.id ? "✓" : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* GPS Location Area */}
      <Text style={styles.kicker}>{t("location").toUpperCase()}</Text>
      <TouchableOpacity style={styles.card} onPress={enableLocation}>
        <View style={styles.row}>
          <View>
            <Text style={styles.rowTitle}>{profile.cluster}</Text>
            <Text style={styles.rowDescription}>Tap to refresh GPS precision & nearby buyer geofence</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
      </TouchableOpacity>

      {/* My Lots (Kabadiwala only) */}
      {role === "kabadiwala" && (
        <>
          <Text style={styles.kicker}>{t("myLots").toUpperCase()}</Text>
          {lots.length ? (
            lots.slice(0, 5).map((lot) => (
              <LotCard key={lot.id} lot={lot} syncedLabel={t("synced")} pendingLabel={t("pendingSync")} />
            ))
          ) : (
            <View style={styles.card}>
              <Text style={styles.rowDescription}>{t("noLots")}</Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 19, paddingBottom: 36 },

  identity: { flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 18 },
  avatar: { width: 62, height: 62, alignItems: "center", justifyContent: "center", borderRadius: 31, borderWidth: 3, borderColor: colors.white },
  avatarText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  identityCopy: { flex: 1 },
  name: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  id: { marginTop: 2, color: colors.muted, fontSize: 10 },
  verified: { alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  verifiedText: { fontSize: 9, fontWeight: "800" },

  kicker: { marginTop: 6, marginBottom: 8, color: "#84948B", fontSize: 9, fontWeight: "800", letterSpacing: 1 },

  // Role switcher
  roleList: { gap: 8, marginBottom: 20 },
  roleBtn: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderWidth: 1.5, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.white },
  roleIcon: { fontSize: 22 },
  roleCopy: { flex: 1 },
  roleLabel: { fontSize: 12, fontWeight: "800", color: colors.ink },
  roleDesc: { fontSize: 9, color: colors.muted, marginTop: 1 },
  roleTick: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  roleTickText: { color: colors.white, fontSize: 10, fontWeight: "900" },

  // Aamdani Card
  aamdaniCard: { backgroundColor: "#164E3D", borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: "#286D58" },
  aamdaniCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  cardOrg: { color: "#F6DE8F", fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  cardMission: { color: "#A8D8BA", fontSize: 7, fontWeight: "700", marginTop: 2 },
  chipVisual: { backgroundColor: "#C59A4E", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  chipText: { color: "#2B1A00", fontSize: 8, fontWeight: "900" },
  aamdaniCardMiddle: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardPhotoBox: { width: 52, height: 58, backgroundColor: "#8C5839", borderRadius: 10, borderWidth: 2, borderColor: "#EAD6B8", alignItems: "center", justifyContent: "center", position: "relative" },
  cardPhotoInitials: { color: colors.white, fontSize: 15, fontWeight: "900" },
  photoShield: { position: "absolute", bottom: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: "#48BB78", alignItems: "center", justifyContent: "center" },
  photoShieldText: { color: colors.white, fontSize: 10, fontWeight: "900" },
  cardDetails: { flex: 1 },
  cardHolderName: { color: colors.white, fontSize: 14, fontWeight: "900", letterSpacing: 0.5 },
  cardWarriorId: { color: "#C2E8CB", fontSize: 9, fontWeight: "700", marginTop: 2 },
  tierRow: { marginTop: 4 },
  goldBadge: { alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  goldBadgeText: { color: colors.white, fontSize: 8, fontWeight: "800" },
  cardGovtVerify: { color: "#9AE6B4", fontSize: 8, fontWeight: "700", marginTop: 4 },
  cardQrStamp: { alignItems: "center", backgroundColor: colors.white, padding: 6, borderRadius: 8 },
  qrStampIcon: { fontSize: 24, color: colors.ink, lineHeight: 26 },
  qrStampText: { fontSize: 6, fontWeight: "900", color: colors.green, marginTop: 1 },
  cardDivider: { height: 1, backgroundColor: "#266952", marginVertical: 12 },
  aamdaniBottom: { flexDirection: "row", justifyContent: "space-between" },
  statKicker: { color: "#A8D8BA", fontSize: 8, fontWeight: "700" },
  statIncome: { color: "#F6DE8F", fontSize: 16, fontWeight: "900", marginTop: 2 },
  statGreenScore: { color: colors.white, fontSize: 13, fontWeight: "800", marginTop: 2 },
  carbonStrip: { marginTop: 10, backgroundColor: "rgba(0,0,0,0.25)", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, alignItems: "center" },
  carbonStripText: { color: "#D1FAE5", fontSize: 8, fontWeight: "700" },

  sosButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF5F5", borderRadius: 14, padding: 12, borderWidth: 1.5, borderColor: "#FEB2B2", marginBottom: 16, gap: 10 },
  sosIcon: { fontSize: 22 },
  sosCopy: { flex: 1 },
  sosTitle: { fontSize: 12, fontWeight: "800", color: "#C53030" },
  sosSubtitle: { fontSize: 9, color: "#9B2C2C", marginTop: 2 },
  sosCallText: { backgroundColor: "#E53E3E", color: colors.white, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, fontSize: 10, fontWeight: "900" },

  card: { marginBottom: 16, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.white },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  rowTitle: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  rowDescription: { marginTop: 3, color: colors.muted, fontSize: 10, lineHeight: 14 },
  chevron: { color: colors.green, fontSize: 27, lineHeight: 28 },

  languageList: { gap: 8, marginBottom: 18 },
  language: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 13, backgroundColor: colors.white },
  languageOn: { borderColor: "#74A98A", backgroundColor: "#E9F5EC" },
  languageNative: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  languageName: { color: colors.muted, fontSize: 10 },
  languageTextOn: { color: colors.green }
});
