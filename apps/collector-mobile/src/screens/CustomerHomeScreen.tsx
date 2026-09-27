// src/screens/CustomerHomeScreen.tsx — home for households and companies.
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Linking, RefreshControl, StyleSheet, View } from "react-native";
import { Text } from "../ui/Text";
import Animated from "react-native-reanimated";

import { PickupCard } from "../components/PickupCard";
import { colors, gradients, radius, space, type } from "../constants/theme";
import { useTranslation } from "../hooks/useTranslation";
import { go, goCustomerTab } from "../navigation/ref";
import { listMyPickups } from "../services/api/client";
import { useAppStore } from "../store/appStore";
import { useAccount, useAuthStore } from "../store/authStore";
import { EmptyState, ErrorState } from "../ui/feedback";
import { AnimatedNumber, Float, PulseDot, SkeletonCard } from "../ui/motion";
import { Badge, Button, Card, enter, InkTitle, GradientCard, type IconName, PressScale, Screen, SectionHeader } from "../ui/primitives";
import { currency } from "../utils/format";

import { P } from "../constants/palette";
const PORTAL_HINT = "apps/recycler-web/index.html";

export function CustomerHomeScreen() {
  const { t } = useTranslation();
  const { role, id, name } = useAccount();
  const household = useAuthStore((s) => s.household);
  const company = useAuthStore((s) => s.company);
  const refreshAuth = useAuthStore((s) => s.refresh);
  const isOnline = useAppStore((s) => s.isOnline);
  const [refreshing, setRefreshing] = useState(false);

  const pickups = useQuery({
    queryKey: ["my-pickups", id],
    queryFn: () => listMyPickups(id!),
    enabled: !!id,
    refetchInterval: 15_000, // live status: "kabadiwala is coming" appears without pulling
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([pickups.refetch(), refreshAuth()]);
    setRefreshing(false);
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("goodMorning") : hour < 17 ? t("goodAfternoon") : t("goodEvening");
  const active = (pickups.data ?? []).filter((p) => p.status === "OPEN" || p.status === "ACCEPTED");
  const past = (pickups.data ?? []).filter((p) => p.status === "COMPLETED" || p.status === "CANCELLED");
  const received = (pickups.data ?? []).reduce((s, p) => s + (p.amount_paid ?? 0), 0);
  const doneCount = (pickups.data ?? []).filter((p) => p.status === "COMPLETED").length;
  const isBuyer = company && company.company_type !== "seller";

  const quick: Array<{ icon: IconName; label: string; color: string; onPress: () => void }> = [
    { icon: "stats-chart", label: t("quickRates"), color: colors.accent, onPress: () => go("BazarBhav") },
    { icon: "sparkles", label: t("quickAssistant"), color: colors.purple, onPress: () => go("Assistant") },
  ];

  return (
    <Screen withTabBar refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
      <Animated.View entering={enter(0)} style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{greeting}</Text>
          <InkTitle style={styles.name} numberOfLines={1}>{name}</InkTitle>
          <View style={styles.statusRow}>
            <PulseDot color={isOnline ? colors.primaryGlow : colors.accent} size={7} />
            <Text style={styles.status}>{isOnline ? t("online") : t("offline")} · {role === "company" ? t("roleCompany") : t("roleHousehold")}</Text>
          </View>
        </View>
        <View style={[styles.avatar, { backgroundColor: role === "company" ? colors.info : colors.orange }]}>
          <Ionicons name={role === "company" ? "business" : "home"} size={24} color={colors.white} />
        </View>
      </Animated.View>

      {company ? (
        <Animated.View entering={enter(1)}>
          <Card tone={company.approved ? "soft" : "warn"} style={{ marginBottom: space.md, flexDirection: "row", gap: space.md, alignItems: "center" }}>
            <Ionicons name={company.approved ? "shield-checkmark" : "hourglass"} size={24} color={company.approved ? colors.primary : P("#E5B86A")} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>{company.approved ? t("companyApproved") : t("companyPending")}</Text>
              {isBuyer ? <Text style={styles.bannerText}>{t("companyPortalHint")} ({PORTAL_HINT})</Text> : null}
            </View>
          </Card>
        </Animated.View>
      ) : null}

      <Animated.View entering={enter(2)}>
        <GradientCard colorsList={gradients.hero}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>{t("custHeroTitle")}</Text>
              <Text style={styles.heroMsg}>{t("custHeroMsg")}</Text>
            </View>
            <Float><Ionicons name="bicycle-outline" size={48} color={P("#A8E8C9")} /></Float>
          </View>
          <Button label={t("requestPickup")} icon="add-circle" variant="light" onPress={() => goCustomerTab("Request")} style={{ marginTop: space.lg }} />
        </GradientCard>
      </Animated.View>

      <View style={styles.statsRow}>
        <Animated.View entering={enter(3)} style={[styles.stat, { backgroundColor: colors.primarySoft }]}>
          <Text style={styles.statLabel}>{t("totalReceived")}</Text>
          <AnimatedNumber value={household?.total_received ?? received} format={currency} style={[styles.statValue, { color: colors.primary }]} />
        </Animated.View>
        <Animated.View entering={enter(4)} style={[styles.stat, { backgroundColor: colors.accentSoft }]}>
          <Text style={styles.statLabel}>{t("pickupsDone")}</Text>
          <AnimatedNumber value={doneCount} style={[styles.statValue, { color: P("#E5B86A") }]} />
        </Animated.View>
      </View>

      <View style={styles.quickRow}>
        {quick.map((q, i) => (
          <Animated.View key={q.label} entering={enter(5 + i)} style={{ flex: 1 }}>
            <PressScale onPress={q.onPress} style={styles.quick} accessibilityRole="button">
              <View style={[styles.quickIcon, { backgroundColor: q.color }]}>
                <Ionicons name={q.icon} size={20} color={colors.white} />
              </View>
              <Text style={styles.quickLabel}>{q.label}</Text>
            </PressScale>
          </Animated.View>
        ))}
      </View>

      <SectionHeader title={t("myRequests")} />
      {pickups.isLoading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : pickups.isError ? (
        <ErrorState title={t("serverDown")} message={t("serverDownMsg")} onRetry={() => void pickups.refetch()} retryLabel={t("retry")} />
      ) : !pickups.data?.length ? (
        <EmptyState icon="cube-outline" title={t("noRequests")} message={t("noRequestsMsg")} action={t("requestPickup")} onAction={() => goCustomerTab("Request")} />
      ) : (
        <>
          {active.map((p, i) => (
            <PickupCard
              key={p.id}
              pickup={p}
              index={i}
              onPress={() => go("PickupDetail", { pickupId: p.id })}
              footer={
                p.pickup_pin ? (
                  <View style={styles.pinStrip}>
                    <Text style={styles.pinLabel}>{t("yourPin")}</Text>
                    <Text style={styles.pinValue}>{p.pickup_pin}</Text>
                    {p.status === "ACCEPTED" && p.collector_phone ? (
                      <PressScale onPress={() => void Linking.openURL(`tel:${p.collector_phone}`)} style={styles.callBtn} accessibilityLabel={t("call")}>
                        <Ionicons name="call" size={16} color={colors.white} />
                      </PressScale>
                    ) : null}
                  </View>
                ) : null
              }
            />
          ))}
          {past.map((p, i) => (
            <PickupCard key={p.id} pickup={p} index={active.length + i} onPress={() => go("PickupDetail", { pickupId: p.id })} />
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", marginBottom: space.lg },
  greeting: { fontSize: 14, color: colors.muted, fontWeight: "600" },
  name: { ...type.h1, color: colors.ink },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  status: { fontSize: 12, color: colors.muted },
  avatar: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  bannerTitle: { fontSize: 14, fontWeight: "800", color: colors.ink },
  bannerText: { marginTop: 2, fontSize: 12, color: colors.inkSoft },
  heroTitle: { ...type.h2, fontSize: 24, lineHeight: 30, color: colors.white },
  heroMsg: { marginTop: 6, fontSize: 14, lineHeight: 20, color: P("rgba(248,250,247,0.62)") },
  statsRow: { flexDirection: "row", gap: space.md, marginTop: space.md },
  stat: { flex: 1, padding: space.lg, borderRadius: radius.lg },
  statLabel: { fontSize: 12, fontWeight: "700", color: colors.inkSoft },
  statValue: { marginTop: 4, fontSize: 24, fontWeight: "800" },
  quickRow: { flexDirection: "row", gap: space.md, marginTop: space.md },
  quick: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  quickIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  quickLabel: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.ink },
  pinStrip: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: P("#020705"), borderWidth: 1, borderColor: P("rgba(168,232,201,0.18)") },
  pinLabel: { flex: 1, color: P("#A8E8C9"), fontSize: 12, fontWeight: "700" },
  pinValue: { color: P("#F8FAF7"), fontSize: 24, fontWeight: "800", letterSpacing: 6 },
  callBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
});
