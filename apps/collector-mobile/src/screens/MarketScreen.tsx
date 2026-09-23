// src/screens/MarketScreen.tsx
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { MaterialCard } from "../components/MaterialCard";
import { PriceCard } from "../components/PriceCard";
import { colors } from "../constants/theme";
import { appendLotEvent } from "../database/sqlite";
import { calculateNetEarnings, sortOffersByNetEarnings } from "../features/lots/lotCalculator";
import { useTranslation } from "../hooks/useTranslation";
import type { RootTabParamList } from "../navigation/types";
import { createLotRemote, getOffers } from "../services/api/client";
import { useAuthStore } from "../store/authStore";
import { useAppStore } from "../store/appStore";
import { currency } from "../utils/format";

type Props = BottomTabScreenProps<RootTabParamList, "Market"> & {
  navigation: { navigate: (screen: any, params?: any) => void };
};

export function MarketScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const addLot = useAppStore((state) => state.addLot);
  const collector = useAuthStore((state) => state.collector);

  const material = route.params?.material ?? "Copper cable";
  const quality = route.params?.quality ?? "medium";
  const weightKg = route.params?.weightKg ?? 35;
  const imageUri = route.params?.imageUri;

  const [showLossDetails, setShowLossDetails] = useState(true);

  // ─── Live offers from backend ────────────────────────────────────────────
  const offersQuery = useQuery({
    queryKey: ["offers", material, weightKg, collector?.latitude, collector?.longitude],
    queryFn: () =>
      getOffers({
        material,
        weightKg,
        latitude: collector?.latitude ?? undefined,
        longitude: collector?.longitude ?? undefined,
      }),
  });

  // ─── Loading / error states ──────────────────────────────────────────────
  if (offersQuery.isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.green} />
        <Text style={styles.loadingText}>Fetching live offers…</Text>
      </View>
    );
  }

  if (offersQuery.isError || !offersQuery.data || offersQuery.data.length === 0) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.errorIcon}>⚠</Text>
        <Text style={styles.errorTitle}>No offers available</Text>
        <Text style={styles.errorBody}>
          {offersQuery.isError
            ? "Could not reach the backend. Is the server running?"
            : "No recyclers cover this area yet. Try a different material or check back later."}
        </Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => offersQuery.refetch()}
        >
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const offers = sortOffersByNetEarnings(offersQuery.data, weightKg);
  const bestOffer = offers[0]!;
  const bestNetEarnings = calculateNetEarnings(bestOffer, weightKg).net;

  // Middleman loss calculator
  const scaleTamperKg = Math.round(weightKg * 0.08 * 10) / 10;
  const scaleTamperLoss = Math.round(scaleTamperKg * bestOffer.listedPricePerKg);
  const middlemanMarginCut = Math.round(weightKg * 35);
  const middlemanInformalDeduction = 150;
  const totalMiddlemanLoss = scaleTamperLoss + middlemanMarginCut + middlemanInformalDeduction;
  const middlemanEstimatedPayout = Math.max(0, bestNetEarnings - totalMiddlemanLoss);

  // ─── Choose offer handler ────────────────────────────────────────────────
  const chooseOffer = async (offerId: string) => {
    const offer = offers.find((candidate) => candidate.id === offerId);
    if (!offer) return;

    const { net } = calculateNetEarnings(offer, weightKg);

    // 1. Save locally (offline-first)
    const lot = await addLot({
      material,
      quality,
      weightKg,
      imageUri,
      expectedNetEarnings: net,
      status: "PICKUP_SCHEDULED",
    });
    await appendLotEvent(lot.id, "OFFER_ACCEPTED", {
      offerId: offer.id,
      recyclerName: offer.recyclerName,
      expectedNetEarnings: net,
    });

    // 2. Push to backend (best-effort — don't block local flow)
    if (collector) {
      try {
        await createLotRemote({
          material,
          quality,
          weightKg,
          collectorId: collector.id,
          collectorName: collector.name,
          latitude: collector.latitude ?? undefined,
          longitude: collector.longitude ?? undefined,
          imageUri,
          expectedNetEarnings: net,
        });
      } catch (err) {
        console.warn("[market] backend lot sync failed:", err);
      }
    }

    Alert.alert(
      t("upcoming"),
      `${offer.recyclerName} will confirm the pickup. Digital Handover Pass created!`,
      [
        {
          text: "View Handover Pass",
          onPress: () =>
            navigation.navigate("Handover", {
              lotId: lot.id,
              material: lot.material,
              weightKg: lot.weightKg,
              netAmount: net,
            }),
        },
        { text: "Go to Home", onPress: () => navigation.navigate("Home") },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.kicker}>MARKETPLACE</Text>
      <Text style={styles.title}>{t("buyerOffers")}</Text>

      <View style={styles.summary}>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryTitle}>{material}</Text>
          <Text style={styles.summaryMeta}>
            {weightKg} kg · {quality} quality
          </Text>
        </View>
        <TouchableOpacity
          style={styles.bazarShortcut}
          onPress={() => navigation.navigate("BazarBhav")}
        >
          <Text style={styles.bazarShortcutText}>📊 {t("bazarBhav")}</Text>
        </TouchableOpacity>
      </View>

      {/* Loss calculator */}
      <View style={styles.lossCard}>
        <View style={styles.lossHeader}>
          <View style={styles.lossBadgeWrap}>
            <Text style={styles.lossBadgeText}>⚠ TRAP ALERT</Text>
          </View>
          <TouchableOpacity onPress={() => setShowLossDetails(!showLossDetails)}>
            <Text style={styles.toggleText}>
              {showLossDetails ? "Hide breakdown ▲" : "Show details ▼"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.lossTitle}>{t("lossCalculator")}</Text>
        <Text style={styles.lossSubtitle}>{t("lossCalculatorSubtitle")}</Text>

        <View style={styles.comparisonRow}>
          <View style={[styles.comparisonBox, styles.middlemanBox]}>
            <Text style={styles.compLabel}>Local Middleman</Text>
            <Text style={styles.middlemanValue}>{currency(middlemanEstimatedPayout)}</Text>
            <Text style={styles.middlemanDiff}>- {currency(totalMiddlemanLoss)} lost</Text>
          </View>

          <View style={styles.vsCircle}>
            <Text style={styles.vsText}>VS</Text>
          </View>

          <View style={[styles.comparisonBox, styles.appBox]}>
            <Text style={styles.compLabelGreen}>Mai Hu Kabadiwala</Text>
            <Text style={styles.appValue}>{currency(bestNetEarnings)}</Text>
            <Text style={styles.appDiff}>+ {currency(totalMiddlemanLoss)} extra!</Text>
          </View>
        </View>

        {showLossDetails && (
          <View style={styles.lossBreakdown}>
            <Text style={styles.breakdownHeader}>Where you lose money with informal buyers:</Text>
            <View style={styles.lossRow}>
              <Text style={styles.lossRowLabel}>⚖️ {t("scaleCheating")}</Text>
              <Text style={styles.lossRowVal}>- {currency(scaleTamperLoss)}</Text>
            </View>
            <View style={styles.lossRow}>
              <Text style={styles.lossRowLabel}>✂️ {t("middlemanCommission")}</Text>
              <Text style={styles.lossRowVal}>- {currency(middlemanMarginCut)}</Text>
            </View>
            <View style={styles.lossRow}>
              <Text style={styles.lossRowLabel}>🚚 Unregulated transport cut</Text>
              <Text style={styles.lossRowVal}>- {currency(middlemanInformalDeduction)}</Text>
            </View>
            <View style={styles.savingsBanner}>
              <Text style={styles.savingsBannerText}>✓ {t("guaranteedSavings")}</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeIcon}>✦</Text>
        <Text style={styles.noticeText}>{t("rankedByNet")}</Text>
      </View>

      {offers.map((offer, index) => {
        const earnings = calculateNetEarnings(offer, weightKg);
        return (
          <PriceCard
            key={offer.id}
            offer={offer}
            costs={earnings.costs}
            net={earnings.net}
            best={index === 0}
            chooseLabel={t("choose")}
            onChoose={() => chooseOffer(offer.id)}
          />
        );
      })}

      <View style={styles.explainer}>
        <Text style={styles.explainerKicker}>{t("bestNet")}</Text>
        <Text style={styles.explainerTitle}>
          {currency(bestNetEarnings)} estimated take-home
        </Text>
        <Text style={styles.explainerText}>
          {t("listedPrice")} × {weightKg} kg − {t("pickupCost").toLowerCase()} − platform fee.
          The collector sees transparent pricing before accepting.
        </Text>
      </View>

      <View style={styles.demand}>
        <Text style={styles.demandTitle}>{t("nearbyDemand")}</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Collect")}>
          <MaterialCard
            material="Server boards"
            price="₹510"
            note={t("highDemand")}
            badge="ACTIVE DEMAND"
          />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 19, paddingBottom: 31, gap: 10 },
  kicker: { color: "#84948B", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  title: { marginTop: -6, marginBottom: 9, color: colors.ink, fontSize: 25, fontWeight: "800", letterSpacing: -0.5 },

  loadingWrap: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  loadingText: { marginTop: 10, color: colors.muted, fontSize: 12 },
  errorIcon: { fontSize: 40, marginBottom: 10 },
  errorTitle: { fontSize: 16, fontWeight: "800", color: colors.ink, marginBottom: 6 },
  errorBody: { fontSize: 12, color: colors.muted, textAlign: "center", lineHeight: 17, marginBottom: 20 },
  retryBtn: {
    paddingHorizontal: 24, paddingVertical: 11,
    borderRadius: 10, backgroundColor: colors.green,
  },
  retryBtnText: { color: colors.white, fontSize: 12, fontWeight: "800" },

  summary: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 16,
    backgroundColor: colors.white,
  },
  summaryCopy: { flex: 1 },
  summaryTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  summaryMeta: { marginTop: 3, color: colors.muted, fontSize: 10 },
  bazarShortcut: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.greenLight },
  bazarShortcutText: { color: colors.green, fontSize: 10, fontWeight: "800" },

  lossCard: { padding: 15, borderRadius: 18, backgroundColor: "#FFF7ED", borderWidth: 1.5, borderColor: "#FDBA74" },
  lossHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  lossBadgeWrap: { backgroundColor: "#EA580C", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  lossBadgeText: { color: colors.white, fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
  toggleText: { color: "#C2410C", fontSize: 10, fontWeight: "700" },
  lossTitle: { fontSize: 16, fontWeight: "900", color: "#9A3412" },
  lossSubtitle: { fontSize: 10, color: "#C2410C", marginTop: 2, marginBottom: 12 },
  comparisonRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  comparisonBox: { flex: 1, padding: 10, borderRadius: 12, borderWidth: 1 },
  middlemanBox: { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" },
  appBox: { backgroundColor: "#DCFCE7", borderColor: "#86EFAC" },
  compLabel: { fontSize: 9, color: "#991B1B", fontWeight: "700" },
  compLabelGreen: { fontSize: 9, color: "#166534", fontWeight: "800" },
  middlemanValue: { fontSize: 16, fontWeight: "900", color: "#991B1B", marginTop: 3 },
  middlemanDiff: { fontSize: 9, fontWeight: "800", color: "#B91C1C", marginTop: 2 },
  appValue: { fontSize: 16, fontWeight: "900", color: "#166534", marginTop: 3 },
  appDiff: { fontSize: 9, fontWeight: "900", color: "#15803D", marginTop: 2 },
  vsCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#FED7AA", alignItems: "center", justifyContent: "center" },
  vsText: { fontSize: 8, fontWeight: "900", color: "#9A3412" },
  lossBreakdown: { marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#FED7AA" },
  breakdownHeader: { fontSize: 10, fontWeight: "800", color: "#9A3412", marginBottom: 6 },
  lossRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  lossRowLabel: { fontSize: 10, color: "#7C2D12", fontWeight: "600" },
  lossRowVal: { fontSize: 10, color: "#DC2626", fontWeight: "800" },
  savingsBanner: { marginTop: 8, padding: 8, borderRadius: 8, backgroundColor: "#ECFDF5", borderWidth: 1, borderColor: "#A7F3D0" },
  savingsBannerText: { fontSize: 9, color: "#065F46", fontWeight: "800", textAlign: "center" },

  notice: { flexDirection: "row", gap: 7, alignItems: "center", paddingHorizontal: 3, paddingBottom: 2 },
  noticeIcon: { color: colors.orange, fontSize: 14 },
  noticeText: { flex: 1, color: "#5B7066", fontSize: 10, lineHeight: 14 },

  explainer: { marginTop: 3, padding: 15, borderRadius: 16, backgroundColor: "#E5F3E9" },
  explainerKicker: { color: "#4E7A5D", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  explainerTitle: { marginTop: 5, color: colors.green, fontSize: 17, fontWeight: "800" },
  explainerText: { marginTop: 6, color: "#537066", fontSize: 10, lineHeight: 14 },

  demand: { marginTop: 12 },
  demandTitle: { marginBottom: 9, color: colors.ink, fontSize: 17, fontWeight: "800" },
});