// src/screens/MaterialDetailScreen.tsx — one material, read like a stock page:
// today's rate, weekly change, a scrubbable 7-day chart, what it's found in, who buys it.
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { dark as D, hues, space, type } from "../constants/theme";
import { useBazarPrices } from "../data/prices";
import { calculateNetEarnings, sortOffersByNetEarnings } from "../features/lots/lotCalculator";
import { useTranslation } from "../hooks/useTranslation";
import { go, goBack, goTab } from "../navigation/ref";
import type { RootStackParamList } from "../navigation/types";
import { getOffers, listDemands } from "../services/api/client";
import { useAuthStore } from "../store/authStore";
import { MATERIAL_METADATA, materialName, type Material } from "../types/domain";
import { LineChart, Segmented } from "../ui/controls";
import { EmptyState } from "../ui/feedback";
import { MaterialAvatar } from "../ui/materials";
import { Skeleton } from "../ui/motion";
import { Badge, Button, Card, enter, ListRow, Screen, TopBar } from "../ui/primitives";
import { Text } from "../ui/Text";
import { currency } from "../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "MaterialDetail">;
type Tab = "overview" | "buyers" | "insights";

/** Everyday items this scrap comes from — what a collector should look for. */
const COMMON_ITEMS: Record<Material, string[]> = {
  "Copper cable": ["House wiring", "Extension cords", "Motor and transformer windings", "Earthing strips"],
  "Server boards": ["Rack servers", "Network switches", "Storage controllers", "Desktop motherboards"],
  Aluminium: ["Window frames", "Cans and foil trays", "Heat sinks", "Cooker bodies"],
  "Mixed e-waste": ["Chargers and adapters", "Remote controls", "Old phones", "Small appliances"],
  "Lithium-ion batteries": ["Phone and laptop batteries", "Power banks", "E-bike packs", "Tool batteries"],
  "Brass fittings": ["Taps and valves", "Door handles", "Pipe fittings", "Lamp bases"],
  "Printed Circuit Boards (PCB)": ["TV and set-top box boards", "Computer cards", "Phone boards", "Appliance controllers"],
  "Electric motors": ["Ceiling fans", "Washing machine motors", "Water pumps", "Mixer grinders"],
  "Iron & steel scrap": ["Almirahs", "Grills and gates", "Bicycle frames", "Utensils"],
  "CRT & monitor glass": ["Old CRT TVs", "CRT monitors", "Oscilloscopes"],
  "Lead acid batteries": ["Car and bike batteries", "Inverter batteries", "UPS batteries"],
  "Compressors & cooling units": ["Fridge compressors", "AC outdoor units", "Water coolers", "Deep freezers"],
  Newspaper: ["Daily newspapers", "Old magazines", "Pamphlets"],
  "Books & notebooks": ["Old textbooks", "School notebooks", "Office paper and files"],
  Cardboard: ["Delivery boxes", "Appliance cartons", "Shoe boxes"],
  "Mixed plastic": ["Buckets and mugs", "Tubs and storage boxes", "Chairs and crates", "Detergent cans"],
  "PET bottles": ["Water bottles", "Soft drink bottles", "Oil and juice bottles"],
  "Stainless steel": ["Old utensils and plates", "Pressure cookers", "Kitchen sinks", "Steel almirahs"],
};

export function MaterialDetailScreen({ route }: Props) {
  const { material } = route.params;
  const { t, language } = useTranslation();
  const insets = useSafeAreaInsets();
  const collector = useAuthStore((s) => s.collector);
  const [tab, setTab] = useState<Tab>("overview");
  const [scrub, setScrub] = useState<number | null>(null);

  const price = useBazarPrices().find((p) => p.material === material);
  const meta = MATERIAL_METADATA[material];
  const history = price?.history7Days.map((h) => h.price) ?? [meta.basePricePerKg];
  const shown = scrub !== null ? history[scrub]! : price?.currentPrice ?? meta.basePricePerKg;
  const first = history[0] ?? shown;
  const weekChange = first ? ((shown - first) / first) * 100 : 0;
  const coords = collector?.latitude && collector?.longitude ? { latitude: collector.latitude, longitude: collector.longitude } : {};

  const offers = useQuery({
    queryKey: ["offers", material, 35, coords],
    queryFn: () => getOffers({ material, weightKg: 35, ...coords }),
    enabled: tab === "buyers",
    retry: 0,
  });
  const demands = useQuery({ queryKey: ["demands", material], queryFn: () => listDemands(material), enabled: tab === "buyers" });
  const ranked = sortOffersByNetEarnings(offers.data ?? [], 35).slice(0, 5);
  const advice = price ? (language === "hi" ? price.adviceHi : language === "mr" ? price.adviceMr : price.advice) : null;
  const dayLabel = (i: number) => (i === history.length - 1 ? t("today") : `${history.length - 1 - i}d`);

  return (
    <View style={{ flex: 1, backgroundColor: D.bg }}>
      <Screen dark contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        <TopBar title={materialName(material, language)} kicker={t(`cat${meta.category.replace(/ /g, "")}` as "catMetals")} onBack={goBack} />

        {/* Rate */}
        <Animated.View entering={enter(0)} style={styles.rateRow}>
          <MaterialAvatar material={material} size={48} onDark />
          <View style={{ flex: 1 }}>
            <Text style={styles.rate}>
              {currency(shown)}<Text style={styles.rateUnit}> {t("perKg")}</Text>
            </Text>
            <Text style={[styles.change, { color: weekChange >= 0 ? D.mint : hues.coral }]}>
              {weekChange >= 0 ? "+" : ""}{t("thisWeek", { n: weekChange.toFixed(1) })}
              {scrub !== null ? `  ${dayLabel(scrub)}` : ""}
            </Text>
          </View>
          {meta.hazard ? <Badge label={t("hazardAlert")} tone="warn" icon="warning-outline" /> : null}
        </Animated.View>

        {/* Chart (drag to read a day) */}
        <Animated.View entering={enter(1)} style={styles.chart}>
          <LineChart values={history} height={150} color={D.mint} onDark onScrub={setScrub} />
          <View style={styles.axis}>
            {history.map((_, i) => <Text key={i} style={styles.axisLabel}>{dayLabel(i)}</Text>)}
          </View>
        </Animated.View>

        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "overview", label: t("overview") },
            { value: "buyers", label: t("segBuyers") },
            { value: "insights", label: t("insightsTab") },
          ]}
        />

        {tab === "overview" ? (
          <Animated.View key="overview" entering={enter(0)} style={styles.section}>
            <Text style={styles.h}>{t("aboutMaterial")}</Text>
            <Card style={styles.darkCard}>
              {COMMON_ITEMS[material].map((item, i, all) => (
                <ListRow key={item} icon="ellipse-outline" title={item} last={i === all.length - 1} />
              ))}
            </Card>
            {meta.safetyWarning ? (
              <>
                <Text style={[styles.h, { marginTop: space.lg }]}>{t("hazardHandling")}</Text>
                <Card style={[styles.darkCard, { flexDirection: "row", gap: space.md }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={hues.amber} />
                  <Text style={styles.body}>{meta.safetyWarning}</Text>
                </Card>
              </>
            ) : null}
          </Animated.View>
        ) : null}

        {tab === "buyers" ? (
          <Animated.View key="buyers" entering={enter(0)} style={styles.section}>
            <Text style={styles.h}>{t("bestBuyers")}</Text>
            {offers.isLoading ? (
              <Card style={styles.darkCard}>
                {[0, 1, 2].map((i) => <Skeleton key={i} height={44} style={{ marginVertical: 6, backgroundColor: D.surfaceAlt }} />)}
              </Card>
            ) : ranked.length ? (
              <Card style={styles.darkCard}>
                {ranked.map((o, i) => (
                  <ListRow
                    key={o.id}
                    icon="business-outline"
                    title={o.recyclerName}
                    subtitle={`${t("kmAway", { n: o.distanceKm })}  ${t("reliable", { n: o.paymentReliability })}`}
                    value={`${currency(calculateNetEarnings(o, 35).net / 35)}${t("perKg")}`}
                    last={i === ranked.length - 1}
                    onPress={() => goTab("Market", { material, weightKg: 35 })}
                  />
                ))}
              </Card>
            ) : (
              <EmptyState icon="business-outline" title={t("noBuyersForMaterial")} />
            )}
            {demands.data?.length ? (
              <>
                <Text style={[styles.h, { marginTop: space.lg }]}>{t("openDemandsFor")}</Text>
                <Card style={styles.darkCard}>
                  {demands.data.slice(0, 4).map((d, i, all) => (
                    <ListRow
                      key={d.id}
                      icon="megaphone-outline"
                      title={d.recycler_name}
                      subtitle={t("wantsKg", { kg: Math.round(d.quantity_kg - d.filled_kg) })}
                      value={`${currency(d.offered_price_per_kg)}${t("perKg")}`}
                      last={i === all.length - 1}
                      onPress={() => go("Demands")}
                    />
                  ))}
                </Card>
              </>
            ) : null}
          </Animated.View>
        ) : null}

        {tab === "insights" ? (
          <Animated.View key="insights" entering={enter(0)} style={styles.section}>
            <View style={styles.statsRow}>
              <Card style={[styles.darkCard, styles.stat]}>
                <Text style={styles.statLabel}>{t("demand")}</Text>
                <Text style={styles.statValue}>{price ? t(price.demand === "HIGH" ? "high" : price.demand === "LOW" ? "low" : "medium") : "—"}</Text>
              </Card>
              <Card style={[styles.darkCard, styles.stat]}>
                <Text style={styles.statLabel}>{t("range7")}</Text>
                <Text style={styles.statValue}>{currency(Math.min(...history))}–{currency(Math.max(...history))}</Text>
              </Card>
            </View>
            {advice ? (
              <Card style={[styles.darkCard, { marginTop: space.md, flexDirection: "row", gap: space.md }]}>
                <Ionicons name="bulb-outline" size={20} color={hues.cyan} />
                <Text style={styles.body}>{advice}</Text>
              </Card>
            ) : null}
          </Animated.View>
        ) : null}
      </Screen>

      {/* Pinned CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Button label={t("sellMaterial")} icon="camera-outline" onPress={() => goTab("Collect", { prefillMaterial: material })} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rateRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  rate: { ...type.h1, fontSize: 34, lineHeight: 40, color: D.ink },
  rateUnit: { fontSize: 16, fontWeight: "400", color: D.inkSoft },
  change: { fontSize: 14, fontWeight: "600", marginTop: 2 },
  chart: { marginTop: space.lg, marginBottom: space.lg },
  axis: { flexDirection: "row", justifyContent: "space-between", marginTop: space.xs, paddingHorizontal: 2 },
  axisLabel: { fontSize: 12, color: D.faint },
  section: { marginTop: space.lg },
  h: { ...type.h3, color: D.ink, marginBottom: space.sm },
  darkCard: { backgroundColor: D.surface, borderColor: D.line, paddingVertical: space.xs },
  body: { flex: 1, fontSize: 15, lineHeight: 22, color: D.inkSoft, paddingVertical: space.sm },
  statsRow: { flexDirection: "row", gap: space.md },
  stat: { flex: 1, paddingVertical: space.md },
  statLabel: { fontSize: 13, color: D.inkSoft },
  statValue: { ...type.h3, color: D.ink, marginTop: 2 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: D.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: D.line },
});
