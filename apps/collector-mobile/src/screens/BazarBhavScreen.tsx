// src/screens/BazarBhavScreen.tsx — daily mandi rates: best opportunity, search, filters,
// tap a card to hear its rate and advice.
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { cinematic as C, space, type } from "../constants/theme";
import { usePriceStore } from "../store/priceStore";
import { useBazarPrices } from "../data/prices";
import { useScreenNarration } from "../hooks/useScreenNarration";
import { useTranslation } from "../hooks/useTranslation";
import type { TranslationKey } from "../i18n";
import { goBack, goTab } from "../navigation/ref";
import { speak } from "../services/voice/speech";
import { MATERIAL_METADATA, materialName, type BazarPriceItem, type Material } from "../types/domain";
import { LineChart, SearchField } from "../ui/controls";
import { EmptyState } from "../ui/feedback";
import { MaterialAvatar } from "../ui/materials";
import { Badge, Card, Chip, EdgeLight, enter, GradientCard, PressScale, Screen, TopBar } from "../ui/primitives";
import { Text } from "../ui/Text";
import { currency } from "../utils/format";

import { P } from "../constants/palette";
const CATEGORIES: Array<{ id: string; label: TranslationKey }> = [
  { id: "All", label: "all" },
  { id: "Metals", label: "catMetals" },
  { id: "Electronics", label: "catElectronics" },
  { id: "Batteries", label: "catBatteries" },
  { id: "Heavy Scrap", label: "catHeavyScrap" },
  { id: "Paper", label: "catPaper" },
  { id: "Plastic", label: "catPlastic" },
];

export function BazarBhavScreen() {
  const { language, t } = useTranslation();
  useScreenNarration("BazarBhav");
  const prices = useBazarPrices();
  const market = usePriceStore((s) => s.market);
  const updated = market ? new Date(market.updatedAt).toLocaleTimeString(language === "en" ? "en-IN" : "hi-IN", { hour: "2-digit", minute: "2-digit" }) : "";
  const statusText = !market
    ? t("pricesReference")
    : market.mode === "live" ? t("pricesLive", { time: updated }) : t("pricesCached", { time: updated });
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMaterial, setActiveMaterial] = useState<Material | null>(null);

  const topGainer = [...prices].filter((p) => p.trend === "up").sort((a, b) => b.changePercent - a.changePercent)[0];
  const adviceOf = (p: BazarPriceItem) => (language === "hi" ? p.adviceHi : language === "mr" ? p.adviceMr : p.advice);

  const filteredPrices = prices.filter((item) => {
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    const meta = MATERIAL_METADATA[item.material];
    const nameMatch =
      item.material.toLowerCase().includes(searchQuery.toLowerCase()) || meta?.hindi.includes(searchQuery) || meta?.marathi.includes(searchQuery);
    return matchesCategory && (searchQuery ? nameMatch : true);
  });

  const announcePrice = (item: BazarPriceItem) => {
    setActiveMaterial(item.material);
    const name = materialName(item.material, language);
    const trendWord =
      item.trend === "up"
        ? language === "hi" ? "बढ़ा है" : language === "mr" ? "वाढला आहे" : "increased"
        : item.trend === "down"
          ? language === "hi" ? "गिरा है" : language === "mr" ? "कमी झाला आहे" : "decreased"
          : language === "hi" ? "स्थिर है" : language === "mr" ? "स्थिर आहे" : "stable";
    const advice = adviceOf(item);
    const speechText =
      language === "hi"
        ? `${name} का आज का भाव ${item.currentPrice} रुपये प्रति किलो है। आज भाव ${item.changePercent} प्रतिशत ${trendWord}। ${advice}`
        : language === "mr"
          ? `${name} चा आजचा दर ${item.currentPrice} रुपये प्रति किलो आहे. आज दर ${item.changePercent} टक्के ${trendWord}। ${advice}`
          : `${name}: Current rate is ${item.currentPrice} rupees per kilogram. Rate ${trendWord} by ${item.changePercent} percent today. ${advice}`;
    speak(speechText, language);
  };

  const trendColor = (p: BazarPriceItem) => (p.trend === "up" ? C.mint : p.trend === "down" ? C.rose : C.textSoft);
  const demandTone = (d: BazarPriceItem["demand"]) => (d === "HIGH" ? "primary" : d === "LOW" ? "muted" : "info") as "primary" | "muted" | "info";

  return (
    <Screen>
      <TopBar title={t("bhavTitle")} kicker={t("bhavSubtitle")} onBack={goBack} />

      <View style={styles.status}>
        <View style={[styles.statusDot, { backgroundColor: market?.mode === "live" ? C.mint : C.amber }]} />
        <Text style={styles.statusText}>{statusText}</Text>
      </View>

      {topGainer ? (
        <Animated.View entering={enter(0)}>
          <PressScale onPress={() => goTab("Market", { material: topGainer.material, quality: "medium", weightKg: 35 })} scaleTo={0.98} accessibilityRole="button">
            <GradientCard>
              <View style={styles.oppRow}>
                <MaterialAvatar material={topGainer.material} size={48} onDark />
                <View style={{ flex: 1 }}>
                  <Text style={styles.oppLabel}>{t("topPick")}</Text>
                  <Text style={styles.oppName} numberOfLines={1}>{materialName(topGainer.material, language)}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.oppPrice}>{currency(topGainer.currentPrice)}<Text style={styles.oppUnit}>{t("perKg")}</Text></Text>
                  <Text style={styles.oppUp}>+{topGainer.changePercent}%</Text>
                </View>
              </View>
              <Text style={styles.oppAdvice} numberOfLines={2}>{adviceOf(topGainer)}</Text>
            </GradientCard>
          </PressScale>
        </Animated.View>
      ) : null}

      <View style={styles.hint}>
        <Ionicons name="volume-medium-outline" size={16} color={C.teal} />
        <Text style={styles.hintText}>{t("listen")}</Text>
      </View>

      <SearchField value={searchQuery} onChangeText={setSearchQuery} placeholder={t("searchMaterials")} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chips}>
        {CATEGORIES.map((c) => (
          <Chip key={c.id} label={t(c.label)} active={selectedCategory === c.id} onPress={() => setSelectedCategory(c.id)} />
        ))}
      </ScrollView>

      {filteredPrices.length === 0 ? (
        <EmptyState icon="search-outline" title={t("noResults", { q: searchQuery })} message={t("noResultsMsg")} />
      ) : (
        filteredPrices.map((item, i) => {
          const selected = activeMaterial === item.material;
          return (
            <Animated.View key={item.id} entering={enter(Math.min(i, 6))}>
              <PressScale onPress={() => announcePrice(item)} scaleTo={0.985} accessibilityRole="button" accessibilityLabel={materialName(item.material, language)}>
                <Card style={[styles.card, selected && styles.cardSelected]}>
                  <View style={styles.cardTop}>
                    <MaterialAvatar material={item.material} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name} numberOfLines={1}>{materialName(item.material, language)}</Text>
                      {language !== "en" ? <Text style={styles.subname} numberOfLines={1}>{item.material}</Text> : null}
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.price}>{currency(item.currentPrice)}<Text style={styles.unit}>{t("perKg")}</Text></Text>
                      <Text style={[styles.change, { color: trendColor(item) }]}>
                        {item.trend === "up" ? "+" : item.trend === "down" ? "−" : ""}{item.changePercent}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <Badge label={`${t("demand")}: ${t(item.demand === "HIGH" ? "high" : item.demand === "LOW" ? "low" : "medium")}`} tone={demandTone(item.demand)} />
                    <PressScale onPress={() => announcePrice(item)} style={styles.speak} accessibilityLabel={t("listen")} accessibilityRole="button">
                      <Ionicons name="volume-high-outline" size={16} color={C.mint} />
                    </PressScale>
                  </View>

                  {item.live ? (
                    <View style={styles.basis}>
                      <Text style={styles.basisText} numberOfLines={2}>
                        {item.live.source}
                        {item.live.premiumPct > 0
                          ? `  ·  ${t("nearbyPremium", { n: item.live.premiumPct, place: item.live.reasons[0]?.label ?? "" })}`
                          : ""}
                      </Text>
                      <Text style={styles.basisText}>{t("doorstepRate", { p: currency(item.live.doorstepPrice) })}</Text>
                    </View>
                  ) : null}

                  <View style={styles.chart}>
                    <Text style={styles.chartLabel}>{t("trend7")}</Text>
                    <LineChart values={item.history7Days.map((d) => d.price)} height={48} color={trendColor(item)} onDark />
                  </View>

                  <View style={styles.advice}>
                    <EdgeLight strength={0.05} />
                    <Text style={styles.adviceLabel}>{t("advice")}</Text>
                    <Text style={styles.adviceText}>{adviceOf(item)}</Text>
                  </View>

                  <PressScale onPress={() => goTab("Collect")} style={styles.sell} accessibilityRole="button">
                    <Ionicons name="add-circle-outline" size={18} color={C.mint} />
                    <Text style={styles.sellText}>{t("sellThis")}</Text>
                    <Ionicons name="chevron-forward" size={16} color={C.textFaint} style={{ marginLeft: "auto" }} />
                  </PressScale>
                </Card>
              </PressScale>
            </Animated.View>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: space.md },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { flex: 1, fontSize: 13, color: C.textSoft },
  basis: { marginTop: space.sm, gap: 2 },
  basisText: { fontSize: 12, lineHeight: 17, color: C.textFaint },
  oppRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  oppLabel: { fontSize: 13, fontWeight: "500", color: C.textSoft },
  oppName: { ...type.h2, color: C.text, marginTop: 2 },
  oppPrice: { fontSize: 22, fontWeight: "700", letterSpacing: -0.4, color: C.text },
  oppUnit: { fontSize: 13, fontWeight: "400", color: C.textFaint },
  oppUp: { fontSize: 13, fontWeight: "600", color: C.mint, marginTop: 2 },
  oppAdvice: { fontSize: 14, lineHeight: 20, color: C.textSoft, marginTop: space.md },

  hint: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.xl, marginBottom: space.md },
  hintText: { fontSize: 13, color: C.textSoft },

  chipScroll: { marginHorizontal: -space.lg, marginTop: space.md, marginBottom: space.lg },
  chips: { gap: space.sm, paddingHorizontal: space.lg },

  card: { marginBottom: space.md },
  cardSelected: { borderColor: P("rgba(168,232,201,0.35)") },
  cardTop: { flexDirection: "row", alignItems: "center", gap: space.md },
  name: { fontSize: 16, fontWeight: "600", color: C.text },
  subname: { fontSize: 13, color: C.textFaint, marginTop: 2 },
  price: { fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: C.text },
  unit: { fontSize: 13, fontWeight: "400", color: C.textFaint },
  change: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.md },
  speak: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: P("#020705"), borderWidth: 1, borderColor: P("rgba(168,232,201,0.16)") },
  chart: { marginTop: space.md },
  chartLabel: { fontSize: 12, color: C.textFaint, marginBottom: space.xs },
  advice: { marginTop: space.md, padding: space.md, borderRadius: 12, backgroundColor: P("rgba(248,250,247,0.035)"), borderWidth: 1, borderColor: P("rgba(248,250,247,0.06)"), overflow: "hidden" },
  adviceLabel: { fontSize: 12, fontWeight: "600", color: C.teal, marginBottom: 4 },
  adviceText: { fontSize: 14, lineHeight: 20, color: C.textSoft },
  sell: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.md, minHeight: 40 },
  sellText: { fontSize: 15, fontWeight: "600", color: C.mint },
});
