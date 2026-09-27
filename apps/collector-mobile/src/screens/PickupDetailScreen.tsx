// src/screens/PickupDetailScreen.tsx — one pickup, seen by the customer (PIN, cancel)
// or by the kabadiwala (accept, then PIN + real weight to complete).
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Linking, StyleSheet, TextInput, View } from "react-native";
import { Text } from "../ui/Text";
import Animated from "react-native-reanimated";

import { PickupCard } from "../components/PickupCard";
import { ScheduleChips, SLOT_KEY } from "../components/ScheduleChips";
import { colors, radius, space, type } from "../constants/theme";
import { mapsDirectionsUrl, nextAfter, pickupToJob, planRoute } from "../features/day/dayPlan";
import { useCollectorLocation } from "../hooks/useCollectorLocation";
import { useTranslation } from "../hooks/useTranslation";
import { go, goBack, goTab } from "../navigation/ref";
import type { RootStackParamList } from "../navigation/types";
import { acceptPickup, ApiError, cancelPickup, completePickup, getPickup, listAcceptedPickups, reschedulePickup, type Pickup, type PickupSlot } from "../services/api/client";
import { useAppStore } from "../store/appStore";
import { useAccount, useAuthStore } from "../store/authStore";
import { dialog, ErrorState, toast } from "../ui/feedback";
import { SkeletonCard } from "../ui/motion";
import { Button, Card, enter, PressScale, Screen, TopBar } from "../ui/primitives";
import { currency, localDateISO, scheduleLabel } from "../utils/format";

import { P } from "../constants/palette";
type Props = NativeStackScreenProps<RootStackParamList, "PickupDetail">;

export function PickupDetailScreen({ route }: Props) {
  const { pickupId } = route.params;
  const { t, language } = useTranslation();
  const { role, id: viewerId } = useAccount();
  const collector = useAuthStore((s) => s.collector);
  const refreshAuth = useAuthStore((s) => s.refresh);
  const refreshLots = useAppStore((s) => s.refreshLots);
  const queryClient = useQueryClient();

  const [pin, setPin] = useState("");
  const [weight, setWeight] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingTime, setEditingTime] = useState(false);
  const [newDate, setNewDate] = useState(localDateISO(0));
  const [newSlot, setNewSlot] = useState<PickupSlot>("anytime");

  const { lat, lon } = useCollectorLocation();
  const query = useQuery({
    queryKey: ["pickup", pickupId, viewerId],
    queryFn: () => getPickup(pickupId, viewerId),
    refetchInterval: 15_000,
  });
  const mine = useQuery({
    queryKey: ["pickups-mine", collector?.id],
    queryFn: () => listAcceptedPickups(collector!.id),
    enabled: !!collector && role === "kabadiwala",
  });
  const p = query.data;
  const doorUrl = p?.latitude != null && p.longitude != null
    ? mapsDirectionsUrl({ latitude: lat, longitude: lon }, [{ latitude: p.latitude, longitude: p.longitude }])
    : "";
  const following = useMemo(() => {
    const jobs = (mine.data ?? []).flatMap((item) => {
      if (item.status !== "ACCEPTED") return [];
      const job = pickupToJob(item);
      return job ? [job] : [];
    });
    const planned = planRoute({ latitude: lat, longitude: lon }, jobs);
    return planned ? nextAfter(planned, pickupId) : null;
  }, [mine.data, lat, lon, pickupId]);

  const isRequester = !!p && p.requester_id === viewerId;
  const isMyJob = !!p && !!collector && p.collector_id === collector.id;
  const kg = Number(weight.replace(",", "."));
  const weightOk = Number.isFinite(kg) && kg > 0 && kg <= 100000;

  const afterChange = async (updated: Pickup) => {
    queryClient.setQueryData(["pickup", pickupId, viewerId], updated);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["my-pickups"] }),
      queryClient.invalidateQueries({ queryKey: ["pickups-nearby"] }),
      queryClient.invalidateQueries({ queryKey: ["pickups-mine"] }),
    ]);
  };

  const run = async (action: () => Promise<Pickup>, onDone?: (p: Pickup) => void) => {
    setBusy(true);
    try {
      const updated = await action();
      await afterChange(updated);
      onDone?.(updated);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && role === "kabadiwala") toast.warn(t("kycNeeded"));
      else toast.error(t("serverDown"), err instanceof ApiError ? err.message : t("serverDownMsg"));
      void query.refetch();
    } finally {
      setBusy(false);
    }
  };

  const openDoor = (pickup: Pick<Pickup, "latitude" | "longitude">) => {
    if (pickup.latitude == null || pickup.longitude == null) return;
    void Linking.openURL(mapsDirectionsUrl({ latitude: lat, longitude: lon }, [{ latitude: pickup.latitude, longitude: pickup.longitude }]));
  };

  const accept = () =>
    run(() => acceptPickup(pickupId, collector!.id), (updated) => {
      if (updated.latitude == null || updated.longitude == null) {
        toast.success(t("accepted"), t("acceptedMsg"));
        return;
      }
      dialog.show({
        icon: "navigate",
        tone: "primary",
        title: t("accepted"),
        message: t("acceptedMsg"),
        actions: [{ label: t("goToDoor"), onPress: () => openDoor(updated) }],
      });
    });

  const complete = () =>
    run(
      () => completePickup(pickupId, collector!.id, pin.trim(), kg),
      (done) => {
        void refreshLots(collector!.id);
        void refreshAuth();
        const sell = () => goTab("Market", { lotId: done.lot_id ?? undefined, material: done.material, weightKg: done.actual_weight_kg ?? kg });
        const next = following;
        dialog.show({
          icon: next ? "navigate" : "checkmark-circle",
          tone: "primary",
          title: t("pickupDone"),
          message: next ? t("nextStopMsg", { name: next.label, km: next.legKm }) : t("pickupDoneMsg"),
          actions: next
            ? [
                { label: t("nextStop"), onPress: () => go("PickupDetail", { pickupId: next.id }) },
                { label: t("sellNow"), variant: "ghost", onPress: sell },
              ]
            : [
                { label: t("sellNow"), onPress: sell },
                { label: t("close"), variant: "ghost" },
              ],
        });
      }
    );

  const openReschedule = () => {
    // Keep the current choice if it's still bookable, else start from today.
    const current = p?.preferred_date;
    setNewDate(current && current >= localDateISO(0) ? current : localDateISO(0));
    setNewSlot(p?.preferred_slot ?? "anytime");
    setEditingTime(true);
  };

  const saveTime = () =>
    run(
      () => reschedulePickup(pickupId, viewerId!, newDate, newSlot, `${scheduleLabel(newDate, language)} · ${t(SLOT_KEY[newSlot])}`),
      () => {
        setEditingTime(false);
        toast.success(t("timeUpdated"));
      }
    );

  const cancel = () =>
    dialog.show({
      icon: "close-circle",
      tone: "danger",
      title: t("cancelRequest"),
      actions: [
        { label: t("cancelRequest"), variant: "danger", onPress: () => void run(() => cancelPickup(pickupId, viewerId!)) },
        { label: t("back"), variant: "ghost" },
      ],
    });

  const call = (phone?: string | null) => {
    if (phone) void Linking.openURL(`tel:${phone}`);
  };

  return (
    <Screen>
      <TopBar kicker={t("pickupsKicker")} title={t("details")} onBack={goBack} />

      {query.isLoading ? (
        <SkeletonCard />
      ) : query.isError || !p ? (
        <ErrorState title={t("serverDown")} message={t("serverDownMsg")} onRetry={() => void query.refetch()} retryLabel={t("retry")} />
      ) : (
        <>
          <PickupCard pickup={p} showRequester={!isRequester} />

          {/* Customer: their PIN, to hand over only after being paid. */}
          {isRequester && p.pickup_pin && (p.status === "OPEN" || p.status === "ACCEPTED") ? (
            <Animated.View entering={enter(1)} style={styles.pinCard}>
              <Text style={styles.pinLabel}>{t("yourPin")}</Text>
              <Text style={styles.pinValue}>{p.pickup_pin}</Text>
              <Text style={styles.pinHint}>{t("pinHint")}</Text>
            </Animated.View>
          ) : null}

          {/* Who is on the other side. */}
          {isRequester && p.collector_name ? (
            <Animated.View entering={enter(2)}>
              <Card style={styles.personRow}>
                <Ionicons name="bicycle" size={22} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.personLabel}>{t("kabadiwalaAssigned")}</Text>
                  <Text style={styles.personName}>{p.collector_name}</Text>
                </View>
                {p.collector_phone && p.status === "ACCEPTED" ? (
                  <PressScale onPress={() => call(p.collector_phone)} style={styles.callBtn} accessibilityLabel={t("call")}>
                    <Ionicons name="call" size={18} color={colors.white} />
                  </PressScale>
                ) : null}
              </Card>
            </Animated.View>
          ) : null}
          {isMyJob && p.status === "ACCEPTED" && (doorUrl || p.requester_phone) ? (
            <Animated.View entering={enter(2)} style={{ marginTop: space.md, gap: space.sm }}>
              {doorUrl ? <Button label={t("goToDoor")} icon="navigate" onPress={() => openDoor(p)} /> : null}
              {p.requester_phone ? <Button label={`${t("call")} ${p.requester_name}`} icon="call" variant="secondary" onPress={() => call(p.requester_phone)} /> : null}
            </Animated.View>
          ) : null}

          {/* Money summary. */}
          <Animated.View entering={enter(3)} style={styles.moneyRow}>
            <Card style={{ flex: 1 }}>
              <Text style={styles.personLabel}>{p.status === "COMPLETED" ? (isRequester ? t("paidToYou") : t("youPay")) : t("estimatedValue")}</Text>
              <Text style={styles.money}>{currency(p.amount_paid ?? p.estimated_value)}</Text>
            </Card>
            {p.offered_price_per_kg ? (
              <Card style={{ flex: 1 }}>
                <Text style={styles.personLabel}>{t("youPay")}</Text>
                <Text style={styles.money}>{currency(p.offered_price_per_kg)}{t("perKg")}</Text>
              </Card>
            ) : null}
          </Animated.View>

          {p.notes ? (
            <Card tone="info" style={{ marginTop: space.md }}>
              <Text style={styles.personLabel}>{t("notes")}</Text>
              <Text style={styles.notes}>{p.notes}</Text>
            </Card>
          ) : null}

          {/* Actions */}
          <View style={{ marginTop: space.lg, gap: space.md }}>
            {role === "kabadiwala" && p.status === "OPEN" ? (
              <Button label={t("accept")} icon="checkmark-circle" loading={busy} onPress={() => void accept()} />
            ) : null}

            {isMyJob && p.status === "ACCEPTED" ? (
              <Card>
                <Text style={styles.formTitle}>{t("completePickup")}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t("enterCustomerPin")}
                  placeholderTextColor={colors.faint}
                  keyboardType="number-pad"
                  maxLength={4}
                  value={pin}
                  onChangeText={(v) => setPin(v.replace(/\D/g, ""))}
                  accessibilityLabel={t("enterCustomerPin")}
                />
                <TextInput
                  style={styles.input}
                  placeholder={`${t("actualWeight")} · ~${p.estimated_weight_kg}`}
                  placeholderTextColor={colors.faint}
                  keyboardType="decimal-pad"
                  value={weight}
                  onChangeText={setWeight}
                  accessibilityLabel={t("actualWeight")}
                />
                {weightOk && p.offered_price_per_kg ? (
                  <Text style={styles.payHint}>{t("youPay")}: {currency(p.offered_price_per_kg * kg)}</Text>
                ) : null}
                <Button
                  label={t("completePickup")}
                  icon="lock-open"
                  loading={busy}
                  disabled={pin.length !== 4 || !weightOk}
                  onPress={() => void complete()}
                  style={{ marginTop: space.md }}
                />
              </Card>
            ) : null}

            {isMyJob && p.status === "COMPLETED" && p.lot_id ? (
              <Button
                label={t("sellNow")}
                icon="storefront"
                onPress={() => goTab("Market", { lotId: p.lot_id ?? undefined, material: p.material, weightKg: p.actual_weight_kg ?? p.estimated_weight_kg })}
              />
            ) : null}

            {isRequester && (p.status === "OPEN" || p.status === "ACCEPTED") ? (
              editingTime ? (
                <Card>
                  <ScheduleChips date={newDate} slot={newSlot} onDate={setNewDate} onSlot={setNewSlot} />
                  <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
                    <Button label={t("back")} variant="ghost" size="md" onPress={() => setEditingTime(false)} style={{ flex: 1 }} />
                    <Button label={t("saveTime")} icon="checkmark" size="md" loading={busy} onPress={() => void saveTime()} style={{ flex: 1.4 }} />
                  </View>
                </Card>
              ) : (
                <Button label={t("changeTime")} icon="calendar" variant="secondary" onPress={openReschedule} />
              )
            ) : null}

            {isRequester && (p.status === "OPEN" || p.status === "ACCEPTED") ? (
              <Button label={t("cancelRequest")} icon="close-circle" variant="ghost" loading={busy} onPress={cancel} />
            ) : null}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pinCard: { alignItems: "center", padding: space.lg, marginTop: space.sm, borderRadius: radius.lg, backgroundColor: P("#020705"), borderWidth: 1, borderColor: P("rgba(168,232,201,0.18)") },
  pinLabel: { color: P("#A8E8C9"), fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  pinValue: { marginTop: space.sm, color: P("#F8FAF7"), fontSize: 44, fontWeight: "800", letterSpacing: 12 },
  pinHint: { marginTop: space.sm, color: P("rgba(248,250,247,0.62)"), fontSize: 13, lineHeight: 18, textAlign: "center" },
  personRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.md },
  personLabel: { fontSize: 11, fontWeight: "700", color: colors.muted },
  personName: { ...type.h3, color: colors.ink },
  callBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  moneyRow: { flexDirection: "row", gap: space.md, marginTop: space.md },
  money: { marginTop: 4, ...type.h2, color: colors.primary },
  notes: { marginTop: 4, fontSize: 14, lineHeight: 20, color: colors.ink },
  formTitle: { ...type.h3, color: colors.ink, marginBottom: space.sm },
  input: { marginTop: space.sm, height: 50, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 16, color: colors.ink, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.line },
  payHint: { marginTop: space.sm, fontSize: 13, fontWeight: "700", color: colors.primary },
});
