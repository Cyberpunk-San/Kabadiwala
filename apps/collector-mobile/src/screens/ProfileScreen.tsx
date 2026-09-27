// src/screens/ProfileScreen.tsx — who I am, what I've done, and where my things are.
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { colors, hues, radius, space, type } from "../constants/theme";
import { useTranslation } from "../hooks/useTranslation";
import { go, goCustomerTab, goTab } from "../navigation/ref";
import { useAuthStore } from "../store/authStore";
import { Badge, Card, enter, InkTitle, ListRow, PressScale, Screen } from "../ui/primitives";
import { Text } from "../ui/Text";
import { currency } from "../utils/format";

const initialsOf = (name: string) => name.split(" ").filter(Boolean).map((p) => p[0]).join("").toUpperCase().slice(0, 2);

export function ProfileScreen() {
  const { t } = useTranslation();
  const collector = useAuthStore((s) => s.collector);
  const household = useAuthStore((s) => s.household);
  const company = useAuthStore((s) => s.company);
  const profile = collector ?? household ?? company;
  if (!profile) return null;

  const since = new Date(profile.created_at.endsWith("Z") ? profile.created_at : `${profile.created_at}Z`).getFullYear();
  const stats: Array<[string, string]> = collector
    ? [[t("recycled"), `${Math.round(collector.total_weight_kg).toLocaleString("en-IN")} ${t("kg")}`], [t("salesCount"), String(collector.total_lots)], [t("memberSince"), String(since)]]
    : household
      ? [[t("pickupsDone"), String(household.total_pickups)], [t("totalReceived"), currency(household.total_received)], [t("memberSince"), String(since)]]
      : [[t("pickupsDone"), String(company!.total_pickups)], [t("memberSince"), String(since)]];

  return (
    <Screen withTabBar>
      <View style={styles.topRow}>
        <InkTitle>{t("tabProfile")}</InkTitle>
        <PressScale onPress={() => go("Settings")} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={t("settings")}>
          <Ionicons name="settings-outline" size={20} color={colors.ink} />
        </PressScale>
      </View>

      <Animated.View entering={enter(0)} style={styles.identity}>
        <View style={styles.avatar}>
          {company ? <Ionicons name="business-outline" size={28} color={colors.primaryDark} /> : <Text style={styles.avatarText}>{initialsOf(profile.name)}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{profile.name}</Text>
          <Text style={styles.meta} numberOfLines={1}>{profile.phone}</Text>
          {collector ? (
            <View style={styles.badges}>
              <Badge label={collector.kyc_status === "VERIFIED" ? t("verified") : t("pending")} tone={collector.kyc_status === "VERIFIED" ? "primary" : "warn"} icon={collector.kyc_status === "VERIFIED" ? "shield-checkmark-outline" : "time-outline"} />
              <Badge label={collector.tier.charAt(0).toUpperCase() + collector.tier.slice(1)} tone="warn" icon="ribbon-outline" />
            </View>
          ) : null}
        </View>
      </Animated.View>

      <Animated.View entering={enter(1)}>
        <Card style={styles.stats}>
          {stats.map(([label, value], i) => (
            <View key={label} style={[styles.stat, i > 0 && styles.statDivider]}>
              <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
              <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
            </View>
          ))}
        </Card>
      </Animated.View>

      <Animated.View entering={enter(2)}>
        <Card style={styles.list}>
          {collector ? (
            <>
              <ListRow icon="cube-outline" title={t("myLotsRow")} value={String(collector.total_lots)} onPress={() => go("Search")} />
              <ListRow icon="bicycle-outline" title={t("pickupJobs")} onPress={() => go("Pickups")} />
              <ListRow icon="stats-chart-outline" title={t("earningsRow")} onPress={() => goTab("Earnings")} />
              <ListRow icon="map-outline" title={t("openMap")} onPress={() => go("Regional")} />
              <ListRow icon="notifications-outline" title={t("notifications")} onPress={() => go("Notifications")} last />
            </>
          ) : (
            <>
              <ListRow icon="cube-outline" title={t("myRequests")} onPress={() => goCustomerTab("CustomerHome")} />
              <ListRow icon="add-circle-outline" title={t("requestPickup")} onPress={() => goCustomerTab("Request")} last />
            </>
          )}
        </Card>
      </Animated.View>

      {company && !company.approved ? (
        <Card tone="warn" style={{ marginTop: space.md, flexDirection: "row", gap: space.md }}>
          <Ionicons name="time-outline" size={20} color={hues.amber} />
          <Text style={styles.note}>{t("companyPending")}</Text>
        </Card>
      ) : null}

      <Card style={styles.list}>
        <ListRow icon="accessibility-outline" title={t("accessibility")} onPress={() => go("Accessibility")} />
        <ListRow icon="settings-outline" title={t("settings")} onPress={() => go("Settings")} last />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.lg },
  iconBtn: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  identity: { flexDirection: "row", alignItems: "center", gap: space.lg },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  avatarText: { ...type.h2, color: colors.primaryDark },
  name: { ...type.h2, color: colors.ink },
  meta: { ...type.small, color: colors.inkSoft, marginTop: 2 },
  badges: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
  stats: { flexDirection: "row", marginTop: space.xl, paddingVertical: space.md, paddingHorizontal: 0 },
  stat: { flex: 1, alignItems: "center", paddingHorizontal: space.sm },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.line },
  statValue: { ...type.h3, color: colors.ink },
  statLabel: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  list: { marginTop: space.lg, paddingVertical: 0 },
  note: { flex: 1, fontSize: 15, lineHeight: 22, color: colors.ink },
});
