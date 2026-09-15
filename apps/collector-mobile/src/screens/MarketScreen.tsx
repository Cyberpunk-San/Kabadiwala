import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { MaterialCard } from "../components/MaterialCard";
import { PriceCard } from "../components/PriceCard";
import { colors } from "../constants/theme";
import { appendLotEvent } from "../database/sqlite";
import { calculateNetEarnings, sortOffersByNetEarnings } from "../features/lots/lotCalculator";
import { useTranslation } from "../hooks/useTranslation";
import type { RootTabParamList } from "../navigation/types";
import { demoOffers, getOffers } from "../services/api/client";
import { useAppStore } from "../store/appStore";
import { currency } from "../utils/format";

type Props = BottomTabScreenProps<RootTabParamList, "Market">;

export function MarketScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const addLot = useAppStore((state) => state.addLot);
  const material = route.params?.material ?? "Copper cable";
  const quality = route.params?.quality ?? "medium";
  const weightKg = route.params?.weightKg ?? 35;
  const imageUri = route.params?.imageUri;
  const offersQuery = useQuery({ queryKey: ["offers", material], queryFn: getOffers, initialData: demoOffers });
  const offers = sortOffersByNetEarnings(offersQuery.data ?? demoOffers, weightKg);

  const chooseOffer = async (offerId: string) => {
    const offer = offers.find((candidate) => candidate.id === offerId);
    if (!offer) return;
    const { net } = calculateNetEarnings(offer, weightKg);
    const lot = await addLot({ material, quality, weightKg, imageUri, expectedNetEarnings: net, status: "PICKUP_SCHEDULED" });
    await appendLotEvent(lot.id, "OFFER_ACCEPTED", { offerId: offer.id, recyclerName: offer.recyclerName, expectedNetEarnings: net });
    await appendLotEvent(lot.id, "PICKUP_SCHEDULED", { recyclerName: offer.recyclerName, distanceKm: offer.distanceKm });
    Alert.alert(t("upcoming"), `${offer.recyclerName} will confirm the pickup. ${t("lotSaved")}`, [{ text: "OK", onPress: () => navigation.navigate("Home") }]);
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Text style={styles.kicker}>MARKETPLACE</Text><Text style={styles.title}>{t("buyerOffers")}</Text>
    <View style={styles.summary}><View style={styles.summaryCopy}><Text style={styles.summaryTitle}>{material}</Text><Text style={styles.summaryMeta}>{weightKg} kg · {quality} quality</Text></View><Text style={styles.sort}>NET EARNINGS ↓</Text></View>
    <View style={styles.notice}><Text style={styles.noticeIcon}>✦</Text><Text style={styles.noticeText}>{t("rankedByNet")}</Text></View>
    {offers.map((offer, index) => { const earnings = calculateNetEarnings(offer, weightKg); return <PriceCard key={offer.id} offer={offer} costs={earnings.costs} net={earnings.net} best={index === 0} chooseLabel={t("choose")} onChoose={() => chooseOffer(offer.id)} />; })}
    <View style={styles.explainer}><Text style={styles.explainerKicker}>{t("bestNet")}</Text><Text style={styles.explainerTitle}>{currency(calculateNetEarnings(offers[0] ?? demoOffers[0]!, weightKg).net)} estimated take-home</Text><Text style={styles.explainerText}>{t("listedPrice")} × {weightKg} kg − {t("pickupCost").toLowerCase()} − platform fee. The collector sees the reason before accepting.</Text></View>
    <View style={styles.demand}><Text style={styles.demandTitle}>{t("nearbyDemand")}</Text><TouchableOpacity onPress={() => navigation.navigate("Collect")}><MaterialCard material="Server boards" price="₹510" note={t("highDemand")} badge="ACTIVE DEMAND" /></TouchableOpacity></View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream }, content: { padding: 19, paddingBottom: 31, gap: 10 }, kicker: { color: "#84948B", fontSize: 9, fontWeight: "800", letterSpacing: 1 }, title: { marginTop: -6, marginBottom: 9, color: colors.ink, fontSize: 25, fontWeight: "800", letterSpacing: -.5 },
  summary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.white }, summaryCopy: { flex: 1 }, summaryTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" }, summaryMeta: { marginTop: 3, color: colors.muted, fontSize: 10 }, sort: { paddingHorizontal: 7, paddingVertical: 5, borderRadius: 6, overflow: "hidden", color: colors.green, backgroundColor: colors.greenLight, fontSize: 8, fontWeight: "800" },
  notice: { flexDirection: "row", gap: 7, alignItems: "center", paddingHorizontal: 3, paddingBottom: 2 }, noticeIcon: { color: colors.orange, fontSize: 14 }, noticeText: { flex: 1, color: "#5B7066", fontSize: 10, lineHeight: 14 },
  explainer: { marginTop: 3, padding: 15, borderRadius: 16, backgroundColor: "#E5F3E9" }, explainerKicker: { color: "#4E7A5D", fontSize: 9, fontWeight: "800", letterSpacing: .8 }, explainerTitle: { marginTop: 5, color: colors.green, fontSize: 17, fontWeight: "800" }, explainerText: { marginTop: 6, color: "#537066", fontSize: 10, lineHeight: 14 },
  demand: { marginTop: 12 }, demandTitle: { marginBottom: 9, color: colors.ink, fontSize: 17, fontWeight: "800" }
});
