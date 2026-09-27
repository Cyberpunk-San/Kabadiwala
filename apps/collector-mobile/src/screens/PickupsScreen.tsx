// src/screens/PickupsScreen.tsx — kabadiwala: doorstep pickup requests nearby + jobs they accepted.
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Linking, RefreshControl, StyleSheet, View } from "react-native";
import { Text } from "../ui/Text";
import Animated from "react-native-reanimated";

import { PickupCard } from "../components/PickupCard";
import { colors, space, type } from "../constants/theme";
import { mapsDirectionsUrl, pickupToJob, planRoute } from "../features/day/dayPlan";
import { useCollectorLocation } from "../hooks/useCollectorLocation";
import { useTranslation } from "../hooks/useTranslation";
import { go, goBack } from "../navigation/ref";
import type { RootStackParamList } from "../navigation/types";
import { acceptPickup, ApiError, listAcceptedPickups, listNearbyPickups, type Pickup } from "../services/api/client";
import { useAuthStore } from "../store/authStore";
import { dialog, EmptyState, ErrorState, toast } from "../ui/feedback";
import { SkeletonCard } from "../ui/motion";
import { Button, Chip, enter, Screen, TopBar } from "../ui/primitives";
import { currency } from "../utils/format";

type Tab = "nearby" | "mine";

export function PickupsScreen({ route: nav }: NativeStackScreenProps<RootStackParamList, "Pickups">) {
  const { t } = useTranslation();
  const collector = useAuthStore((s) => s.collector);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>(nav.params?.tab ?? "nearby");
  const [paramTab, setParamTab] = useState(nav.params?.tab);
  if (nav.params?.tab !== paramTab) {
    setParamTab(nav.params?.tab);
    if (nav.params?.tab) setTab(nav.params.tab);
  }
  const [accepting, setAccepting] = useState<string | null>(null);

  // Every open request, nearest to where the kabadiwala is right now on top.
  const { lat, lon, source } = useCollectorLocation();

  const nearby = useQuery({
    queryKey: ["pickups-nearby", lat, lon],
    queryFn: () => listNearbyPickups(lat, lon),
    refetchInterval: 20_000,
    placeholderData: keepPreviousData,
  });
  const mine = useQuery({
    queryKey: ["pickups-mine", collector?.id],
    queryFn: () => listAcceptedPickups(collector!.id),
    enabled: !!collector,
  });

  const acceptedJobs = (mine.data ?? []).filter((p) => p.status === "ACCEPTED");
  const route = useMemo(() => {
    const jobs = (mine.data ?? []).flatMap((p) => {
      if (p.status !== "ACCEPTED") return [];
      const job = pickupToJob(p);
      return job ? [job] : [];
    });
    return planRoute({ latitude: lat, longitude: lon }, jobs);
  }, [mine.data, lat, lon]);
  const stopOf = useMemo(() => new Map(route?.stops.map((s) => [s.id, s]) ?? []), [route]);

  const active = tab === "nearby" ? nearby : mine;
  const list = tab === "mine" && route
    ? [...(active.data ?? [])].sort((a, b) => (stopOf.get(a.id)?.order ?? 99) - (stopOf.get(b.id)?.order ?? 99))
    : (active.data ?? []);
  const openJobs = acceptedJobs.length;

  const accept = async (p: Pickup) => {
    if (!collector) return;
    setAccepting(p.id);
    try {
      const updated = await acceptPickup(p.id, collector.id);
      await queryClient.invalidateQueries({ queryKey: ["pickups-nearby"] });
      await queryClient.invalidateQueries({ queryKey: ["pickups-mine"] });
      setTab("mine");
      const door = updated.latitude != null && updated.longitude != null
        ? mapsDirectionsUrl({ latitude: lat, longitude: lon }, [{ latitude: updated.latitude, longitude: updated.longitude }])
        : "";
      dialog.show({
        icon: "navigate",
        tone: "primary",
        title: t("accepted"),
        message: t("acceptedMsg"),
        actions: [
          door
            ? { label: t("goToDoor"), onPress: () => { void Linking.openURL(door); go("PickupDetail", { pickupId: updated.id }); } }
            : { label: t("details"), onPress: () => go("PickupDetail", { pickupId: updated.id }) },
        ],
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) toast.warn(t("kycNeeded"));
      else toast.error(t("serverDown"), err instanceof ApiError ? err.message : t("serverDownMsg"));
      void nearby.refetch();
    } finally {
      setAccepting(null);
    }
  };

  return (
    <Screen refreshControl={<RefreshControl refreshing={active.isRefetching} onRefresh={() => void active.refetch()} tintColor={colors.primary} />}>
      <TopBar kicker={t("pickupsKicker")} title={t("pickupsTitle")} onBack={goBack} />

      <Animated.View entering={enter(1)} style={styles.tabs}>
        <Chip label={`${t("nearby")}${nearby.data ? ` (${nearby.data.length})` : ""}`} icon="navigate" active={tab === "nearby"} onPress={() => setTab("nearby")} />
        <Chip label={`${t("myJobs")}${openJobs ? ` (${openJobs})` : ""}`} icon="briefcase" active={tab === "mine"} onPress={() => setTab("mine")} />
      </Animated.View>

      {tab === "nearby" ? (
        <View style={styles.sortNote}>
          <Ionicons name={source === "gps" ? "locate" : "location-outline"} size={14} color={colors.primaryDark} />
          <Text style={styles.sortText}>{t(source === "gps" ? "sortedFromGps" : source === "saved" ? "sortedFromSaved" : "sortedFromDefault")}</Text>
        </View>
      ) : route ? (
        <Animated.View entering={enter(2)} style={styles.route}>
          <View style={styles.routeHead}>
            <Ionicons name="navigate" size={16} color={colors.primaryDark} />
            <Text style={styles.routeTitle}>{t("routeStops", { n: route.stops.length })}</Text>
          </View>
          <Text style={styles.sortText}>{t("routeMeta", { km: route.totalDistanceKm, min: route.estimatedTotalMinutes, fuel: route.estimatedFuelCostRs })}</Text>
          {route.savingsVsNaiveRs >= 8 ? <Text style={styles.routeSave}>{t("routeSave", { n: route.savingsVsNaiveRs })}</Text> : null}
          <Button label={t("openMaps")} icon="map-outline" size="md" variant="secondary" onPress={() => void Linking.openURL(route.mapsUrl)} style={{ marginTop: space.sm }} />
        </Animated.View>
      ) : null}

      {active.isLoading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : active.isError ? (
        <ErrorState title={t("serverDown")} message={t("serverDownMsg")} onRetry={() => void active.refetch()} retryLabel={t("retry")} />
      ) : !list.length ? (
        <EmptyState icon="bicycle-outline" title={t("noNearby")} message={t("noNearbyMsg")} />
      ) : (
        list.map((p, i) => {
          const payRate = Math.round(p.estimated_value / Math.max(p.estimated_weight_kg, 0.001));
          return (
            <PickupCard
              key={p.id}
              pickup={p}
              index={i}
              showRequester
              kicker={tab === "mine" && stopOf.get(p.id) ? t("stopLeg", { n: stopOf.get(p.id)!.order, km: stopOf.get(p.id)!.legKm }) : undefined}
              onPress={() => go("PickupDetail", { pickupId: p.id })}
              footer={
                tab === "nearby" && p.status === "OPEN" ? (
                  <View style={styles.footer}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.footLabel}>{t("youPay")}</Text>
                      <Text style={styles.footValue}>{currency(payRate)}{t("perKg")}</Text>
                    </View>
                    <Button label={t("accept")} icon="checkmark" size="md" loading={accepting === p.id} onPress={() => void accept(p)} />
                  </View>
                ) : null
              }
            />
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: space.sm, marginBottom: space.md },
  sortNote: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: space.md },
  sortText: { fontSize: 13, color: colors.muted },
  route: { marginBottom: space.md, padding: space.md, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: 4 },
  routeHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  routeTitle: { ...type.h3, color: colors.ink, flex: 1 },
  routeSave: { fontSize: 13, color: colors.ink, marginTop: 2 },
  footer: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.line },
  footLabel: { fontSize: 11, fontWeight: "700", color: colors.muted },
  footValue: { ...type.h3, color: colors.ink },
});
