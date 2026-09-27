// src/screens/MarketScreen.tsx — live buyer offers ranked by take-home money.
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "../ui/Text";
import Animated, { FadeInDown, Layout } from "react-native-reanimated";

import { colors, radius, space, type } from "../constants/theme";
import { calculateNetEarnings, sortOffersByNetEarnings } from "../features/lots/lotCalculator";
import { valuateLot } from "../features/lots/valuationEngine";
import { useScreenNarration } from "../hooks/useScreenNarration";
import { useTranslation } from "../hooks/useTranslation";
import { go } from "../navigation/ref";
import type { RootTabParamList } from "../navigation/types";
import { localOffers } from "../services/ai/demandOffers";
import { ApiError, createLotRemote, getOffers, setLotOffer } from "../services/api/client";
import { enqueue, makeIdempotencyKey } from "../services/sync/syncService";
import { makeId } from "../database/sqlite";
import { useAppStore } from "../store/appStore";
import { useAuthStore } from "../store/authStore";
import { materialName, type RecyclerOffer } from "../types/domain";
import { dialog, EmptyState, toast } from "../ui/feedback";
import { MaterialAvatar } from "../ui/materials";
import { AnimatedNumber, SkeletonCard } from "../ui/motion";
import { Badge, Button, Card, enter, InkTitle, PressScale, Screen, textStyles } from "../ui/primitives";
import { currency } from "../utils/format";

import { P } from "../constants/palette";
type Props = BottomTabScreenProps<RootTabParamList, "Market">;

export function MarketScreen({ route, navigation }: Props) {
  const { t, language } = useTranslation();
  useScreenNarration("Market");
  const addLot = useAppStore((s) => s.addLot);
  const refreshLots = useAppStore((s) => s.refreshLots);
  const collector = useAuthStore((s) => s.collector);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [showLoss, setShowLoss] = useState(false);

  const material = route.params?.material;
  const quality = route.params?.quality ?? "medium";
  const weightKg = route.params?.weightKg ?? 35;
  const imageUri = route.params?.imageUri;
  const imageUris = route.params?.imageUris;
  const existingLotId = route.params?.lotId;
  const coords = collector?.latitude && collector?.longitude ? { latitude: collector.latitude, longitude: collector.longitude } : undefined;

  const offersQuery = useQuery({
    queryKey: ["offers", material, weightKg, coords?.latitude, coords?.longitude],
    queryFn: () => getOffers({ material: material!, weightKg, ...coords }),
    enabled: !!material,
    retry: 0,
  });

  if (!material) {
    return (
      <Screen withTabBar contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
        <EmptyState icon="storefront-outline" title={t("noItemTitle")} message={t("noItemMsg")} action={t("startScan")} onAction={() => navigation.navigate("Collect")} />
      </Screen>
    );
  }

  // Offline → show clearly-labelled estimates from the on-device model.
  const offline = offersQuery.isError;
  const offers: RecyclerOffer[] = sortOffersByNetEarnings(
    offline ? localOffers(material, weightKg, coords) : offersQuery.data ?? [],
    weightKg
  );
  const best = offers[0];
  const bestNet = best ? calculateNetEarnings(best, weightKg).net : 0;
  const valuation = valuateLot(material, quality, weightKg, best?.listedPricePerKg);

  // Typical informal-market leakage, shown so collectors see what they save.
  const scaleLoss = best ? Math.round(weightKg * 0.08 * best.listedPricePerKg) : 0;
  const commission = Math.round(weightKg * 35);
  const transport = 150;
  const middlemanTotal = Math.max(0, bestNet - scaleLoss - commission - transport);

  const choose = async (offer: RecyclerOffer) => {
    if (!collector) return;
    setChoosing(offer.id);
    const { net } = calculateNetEarnings(offer, weightKg);
    const base = { material, quality, weightKg, imageUri, imageUris, expectedNetEarnings: net, recyclerId: offer.id, recyclerName: offer.recyclerName };
    try {
      let lotId: string;
      let savedOffline = false;
      if (existingLotId) {
        // Selling a lot that already exists (e.g. from a completed pickup) — don't create another.
        try {
          await setLotOffer(existingLotId, net);
        } catch (err) {
          toast.error(t("serverDown"), err instanceof ApiError ? err.message : t("serverDownMsg"));
          return;
        }
        await refreshLots(collector.id);
        useAppStore.setState((s) => ({
          lots: s.lots.map((l) => (l.id === existingLotId ? { ...l, expectedNetEarnings: net, recyclerId: offer.id, recyclerName: offer.recyclerName } : l)),
        }));
        lotId = existingLotId;
      } else {
        try {
          const remote = await createLotRemote({
            material, quality, weightKg,
            collectorId: collector.id, collectorName: collector.name,
            latitude: coords?.latitude, longitude: coords?.longitude,
            expectedNetEarnings: net,
          });
          const lot = await addLot({ ...base, id: remote.id, status: "AVAILABLE", syncState: "SYNCED", createdAt: remote.created_at.endsWith("Z") ? remote.created_at : `${remote.created_at}Z` });
          lotId = lot.id;
        } catch {
          // No server: keep it on the phone and let the sync loop create it later — same id.
          const id = makeId("lot_off");
          await enqueue({
            entity: "lot",
            entity_id: id,
            idempotency_key: makeIdempotencyKey("lot"),
            payload: {
              material, quality, weight_kg: weightKg,
              collector_id: collector.id, collector_name: collector.name,
              latitude: coords?.latitude, longitude: coords?.longitude,
              expected_net_earnings: net,
            },
            client_created_at: new Date().toISOString(),
          });
          await addLot({ ...base, id, status: "AVAILABLE", syncState: "PENDING" });
          useAppStore.setState((s) => ({ pendingSync: s.pendingSync + 1 }));
          lotId = id;
          savedOffline = true;
        }
      }

      dialog.show({
        icon: savedOffline ? "cloud-offline" : "checkmark-circle",
        tone: savedOffline ? "warn" : "primary",
        title: savedOffline ? t("savedOffline") : t("offerAccepted"),
        message: savedOffline ? t("savedOfflineMsg") : t("offerAcceptedMsg", { recycler: offer.recyclerName }),
        actions: [
          { label: t("viewPass"), onPress: () => go("Handover", { lotId }) },
          { label: t("goHome"), variant: "ghost", onPress: () => navigation.navigate("Home") },
        ],
      });
      navigation.setParams({ material: undefined, weightKg: undefined, imageUri: undefined, imageUris: undefined, quality: undefined, lotId: undefined });
    } finally {
      setChoosing(null);
    }
  };

  return (
    <Screen withTabBar>
      <Animated.View entering={enter(0)}>
        <Text style={textStyles.kicker}>{t("marketKicker")}</Text>
        <InkTitle style={styles.title}>{t("marketTitle")}</InkTitle>
      </Animated.View>

      {/* Item summary */}
      <Animated.View entering={enter(1)}>
        <Card style={styles.summary}>
          <MaterialAvatar material={material} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryTitle} numberOfLines={1}>{materialName(material, language)}</Text>
            <Text style={textStyles.small}>{weightKg} {t("kg")} · {t(quality)}</Text>
          </View>
          <Button label={t("changeItem")} variant="secondary" size="md" onPress={() => navigation.navigate("Collect")} />
        </Card>
      </Animated.View>

      {offline ? (
        <Animated.View entering={FadeInDown}>
          <Card tone="warn" style={{ marginTop: space.md, flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Ionicons name="cloud-offline" size={20} color={P("#E5B86A")} />
            <Text style={[textStyles.body, { flex: 1, color: P("#E5B86A") }]}>{t("estimatedOffers")}</Text>
          </Card>
        </Animated.View>
      ) : null}

      {offersQuery.isLoading ? (
        <View style={{ marginTop: space.lg }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : !best ? (
        <View style={{ marginTop: space.lg }}>
          <EmptyState icon="search" title={t("noOffers")} message={t("noOffersMsg")} action={t("changeItem")} onAction={() => navigation.navigate("Collect")} />
        </View>
      ) : (
        <>
          {/* Fair price vs best offer */}
          <Animated.View entering={enter(2)}>
            <Card tone={valuation.warningBelowFair ? "warn" : "soft"} style={{ marginTop: space.md }}>
              <View style={{ flexDirection: "row" }}>
                <View style={{ flex: 1 }}>
                  <Text style={textStyles.kicker}>{t("fairPrice")}</Text>
                  <Text style={styles.metric}>{currency(valuation.fairPricePerKg)}{t("perKg")}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={textStyles.kicker}>{t("bestOffer")}</Text>
                  <Text style={[styles.metric, { color: colors.primary }]}>{currency(best.listedPricePerKg)}{t("perKg")}</Text>
                </View>
              </View>
              <Badge label={valuation.warningBelowFair ? t("belowFair") : t("fairOk")} tone={valuation.warningBelowFair ? "warn" : "primary"} icon={valuation.warningBelowFair ? "alert-circle" : "checkmark-circle"} />
            </Card>
          </Animated.View>

          {/* Middleman comparison */}
          <Animated.View entering={enter(3)}>
            <PressScale onPress={() => setShowLoss((v) => !v)} style={[styles.lossCard]} accessibilityRole="button">
              <Text style={styles.lossTitle}>{t("lossTitle")}</Text>
              <View style={styles.vsRow}>
                <View style={[styles.vsBox, { backgroundColor: colors.dangerSoft }]}>
                  <Text style={styles.vsLabel}>{t("middleman")}</Text>
                  <Text style={[styles.vsValue, { color: colors.danger }]}>{currency(middlemanTotal)}</Text>
                </View>
                <View style={styles.vsCircle}><Text style={styles.vsText}>VS</Text></View>
                <View style={[styles.vsBox, { backgroundColor: colors.primarySoft }]}>
                  <Text style={styles.vsLabel}>{t("withUs")}</Text>
                  <AnimatedNumber value={bestNet} format={currency} style={[styles.vsValue, { color: colors.primary }]} />
                </View>
              </View>
              <Text style={styles.gain}>{t("youGetMore", { amount: currency(bestNet - middlemanTotal) })}</Text>
              {showLoss ? (
                <Animated.View entering={FadeInDown} style={{ marginTop: space.md, gap: 6 }}>
                  {[
                    [t("scaleCheating"), scaleLoss],
                    [t("commission"), commission],
                    [t("transportCut"), transport],
                  ].map(([label, amt]) => (
                    <View key={String(label)} style={styles.lossRow}>
                      <Text style={textStyles.small}>{label}</Text>
                      <Text style={styles.lossAmt}>− {currency(Number(amt))}</Text>
                    </View>
                  ))}
                </Animated.View>
              ) : null}
              <Ionicons name={showLoss ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} style={{ alignSelf: "center", marginTop: 4 }} />
            </PressScale>
          </Animated.View>

          <Text style={[textStyles.small, { marginTop: space.lg, marginBottom: space.sm }]}>
            <Ionicons name="sparkles" size={12} color={colors.primary} /> {t("rankedByNet")}
          </Text>

          {offers.map((offer, i) => {
            const { net, costs } = calculateNetEarnings(offer, weightKg);
            const isBest = i === 0;
            return (
              <Animated.View key={offer.id} entering={enter(4 + i)} layout={Layout.springify()}>
                <View style={[styles.offer, isBest && styles.offerBest]}>
                  {isBest ? (
                    <View style={styles.bestRibbon}>
                      <Ionicons name="trophy" size={12} color={colors.white} />
                      <Text style={styles.bestText}>{t("best")}</Text>
                    </View>
                  ) : null}
                  <View style={styles.offerHead}>
                    <View style={styles.logo}><Ionicons name="business-outline" size={20} color={P("#A8E8C9")} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.offerName} numberOfLines={1}>{offer.recyclerName} {offer.verified ? "✓" : ""}</Text>
                      <Text style={textStyles.small}>★ {offer.rating} · {t("kmAway", { n: offer.distanceKm })} · {t("reliable", { n: offer.paymentReliability })}</Text>
                    </View>
                  </View>
                  <View style={styles.offerGrid}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.gridLabel}>{t("listedPrice")}</Text>
                      <Text style={styles.gridValue}>{currency(offer.listedPricePerKg)}{t("perKg")}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.gridLabel}>{t("pickupCosts")}</Text>
                      <Text style={[styles.gridValue, { color: colors.danger }]}>−{currency(costs)}</Text>
                    </View>
                    <View style={{ flex: 1, alignItems: "flex-end" }}>
                      <Text style={styles.gridLabel}>{t("takeHome")}</Text>
                      <Text style={[styles.gridValue, styles.net]}>{currency(net)}</Text>
                    </View>
                  </View>
                  <Button
                    label={t("choose")}
                    icon="checkmark-circle"
                    variant={isBest ? "primary" : "secondary"}
                    size="md"
                    loading={choosing === offer.id}
                    disabled={!!choosing && choosing !== offer.id}
                    onPress={() => void choose(offer)}
                    style={{ marginTop: space.md }}
                  />
                </View>
              </Animated.View>
            );
          })}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...type.h1, color: colors.ink, marginTop: 2 },
  summary: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.lg },
  summaryTitle: { fontSize: 17, fontWeight: "800", color: colors.ink },
  metric: { marginTop: 4, marginBottom: space.sm, fontSize: 20, fontWeight: "800", color: colors.ink },

  lossCard: { marginTop: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  lossTitle: { fontSize: 15, fontWeight: "800", color: colors.ink },
  vsRow: { flexDirection: "row", alignItems: "center", marginTop: space.md },
  vsBox: { flex: 1, padding: space.md, borderRadius: radius.md, alignItems: "center" },
  vsLabel: { fontSize: 12, fontWeight: "700", color: colors.inkSoft },
  vsValue: { marginTop: 4, fontSize: 20, fontWeight: "800" },
  vsCircle: { width: 34, height: 34, borderRadius: 17, marginHorizontal: -8, zIndex: 1, alignItems: "center", justifyContent: "center", backgroundColor: P("#020705"), borderWidth: 1, borderColor: P("rgba(248,250,247,0.14)") },
  vsText: { color: P("#A8E8C9"), fontSize: 11, fontWeight: "700" },
  gain: { marginTop: space.md, textAlign: "center", fontSize: 14, fontWeight: "800", color: colors.primary },
  lossRow: { flexDirection: "row", justifyContent: "space-between" },
  lossAmt: { fontSize: 13, fontWeight: "800", color: colors.danger },

  offer: { padding: space.lg, marginBottom: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  offerBest: { borderWidth: 2, borderColor: colors.primary },
  bestRibbon: { position: "absolute", top: -11, right: 16, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.primary },
  bestText: { color: colors.white, fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  offerHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  logo: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  offerName: { fontSize: 15, fontWeight: "800", color: colors.ink },
  offerGrid: { flexDirection: "row", marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.line },
  gridLabel: { fontSize: 11, fontWeight: "700", color: colors.muted },
  gridValue: { marginTop: 3, fontSize: 15, fontWeight: "800", color: colors.ink },
  net: { fontSize: 19, color: colors.primary },
});
