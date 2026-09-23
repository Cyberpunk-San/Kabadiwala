import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../constants/theme";
import { useTranslation } from "../hooks/useTranslation";
import { getPriceForecast, getPriceHistory, type PriceForecast, type PriceHistoryPoint } from "../services/api/client";
import { speak } from "../services/voice/speech";
import { MATERIAL_METADATA, type Material } from "../types/domain";
import { currency } from "../utils/format";

interface BazarBhavProps { navigation: { goBack: () => void; navigate: (screen: string, params?: any) => void } }
const MATERIALS = Object.keys(MATERIAL_METADATA) as Material[];
const ZONES = ["Pune MIDC", "Mumbai Dharavi", "Delhi Mayapuri", "Bengaluru Peenya"];

export function BazarBhavScreen({ navigation }: BazarBhavProps) {
  const { language, t } = useTranslation();
  const [material, setMaterial] = useState<Material>("Copper cable");
  const [zone, setZone] = useState(ZONES[0]);
  const [history, setHistory] = useState<PriceHistoryPoint[]>([]);
  const [forecast, setForecast] = useState<PriceForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    Promise.all([getPriceHistory(material, zone, 90), getPriceForecast(material, zone, 7)])
      .then(([points, prediction]) => { if (!cancelled) { setHistory(points); setForecast(prediction); } })
      .catch((err) => { if (!cancelled) setError(err?.message ?? "Could not load price intelligence"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [material, zone]);

  const current = history[history.length - 1]?.price ?? forecast?.current_price ?? 0;
  const previous = history[history.length - 2]?.price ?? current;
  const change = previous ? ((current - previous) / previous) * 100 : 0;
  const trend = change > 0.5 ? "up" : change < -0.5 ? "down" : "stable";
  const meta = MATERIAL_METADATA[material];
  const recent = history.slice(-14);
  const maxHistory = Math.max(...recent.map((p) => p.price), current, 1);
  const minHistory = Math.min(...recent.map((p) => p.price), current);
  const forecastValues = forecast?.forecast_7_days ?? [];
  const maxForecast = Math.max(...forecastValues.map((p) => p.upper_ci), current, 1);
  const minForecast = Math.min(...forecastValues.map((p) => p.lower_ci), current);

  const announce = () => {
    const name = language === "hi" ? meta.hindi : language === "mr" ? meta.marathi : material;
    speak(`${name}: ${Math.round(current)} rupees per kilogram in ${zone}. ${trend === "up" ? "Price is rising" : trend === "down" ? "Price is falling" : "Price is stable"}.`, language);
  };

  const alertText = Math.abs(change) >= 5
    ? `${material} price ${change > 0 ? "rose" : "fell"} ${Math.abs(change).toFixed(1)}% in the latest observation.`
    : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backBtn} onPress={navigation.goBack}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
        <View style={styles.live}><View style={styles.dot} /><Text style={styles.liveText}>DATABASE RATES</Text></View>
      </View>
      <Text style={styles.kicker}>PRICE INTELLIGENCE</Text>
      <Text style={styles.title}>{t("bazarBhav")}</Text>
      <Text style={styles.subtitle}>Historical prices and fitted forecast</Text>

      <Text style={styles.label}>Material</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {MATERIALS.map((item) => <TouchableOpacity key={item} onPress={() => setMaterial(item)} style={[styles.chip, material === item && styles.chipActive]}><Text style={[styles.chipText, material === item && styles.chipTextActive]}>{MATERIAL_METADATA[item].icon} {item}</Text></TouchableOpacity>)}
      </ScrollView>
      <Text style={styles.label}>Zone</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {ZONES.map((item) => <TouchableOpacity key={item} onPress={() => setZone(item)} style={[styles.chip, zone === item && styles.chipActive]}><Text style={[styles.chipText, zone === item && styles.chipTextActive]}>{item}</Text></TouchableOpacity>)}
      </ScrollView>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.green} size="large" /><Text style={styles.muted}>Loading market history…</Text></View> : error ? <View style={styles.error}><Text style={styles.errorTitle}>Price data unavailable</Text><Text style={styles.muted}>{error}</Text></View> : (
        <>
          {alertText && <View style={[styles.alert, trend === "up" ? styles.alertUp : styles.alertDown]}><Text style={styles.alertIcon}>{trend === "up" ? "↑" : "↓"}</Text><Text style={styles.alertText}>{alertText}</Text></View>}
          <View style={styles.summary}>
            <View><Text style={styles.summaryLabel}>CURRENT RATE</Text><Text style={styles.price}>{currency(current)}<Text style={styles.unit}> / kg</Text></Text></View>
            <View style={[styles.change, trend === "up" ? styles.up : trend === "down" ? styles.down : styles.flat]}><Text style={styles.changeText}>{trend === "up" ? "▲" : trend === "down" ? "▼" : "●"} {Math.abs(change).toFixed(1)}%</Text></View>
            <TouchableOpacity style={styles.speak} onPress={announce}><Text>🔊 Speak</Text></TouchableOpacity>
          </View>

          <View style={styles.card}><Text style={styles.cardTitle}>Historical price · 14 latest observations</Text><Text style={styles.source}>{recent[0]?.source === "seed_demo" ? "Demo history stored in database" : "Observed market data"}</Text><View style={styles.chart}>{recent.map((point, index) => <View key={`${point.date}-${index}`} style={styles.barWrap}><View style={[styles.bar, { height: `${20 + ((point.price - minHistory) / Math.max(1, maxHistory - minHistory)) * 80}%` }, index === recent.length - 1 && styles.barLatest]} /></View>)}</View><View style={styles.axis}><Text>{recent[0]?.date ?? ""}</Text><Text>{recent[recent.length - 1]?.date ?? ""}</Text></View></View>

          <View style={styles.card}><View style={styles.forecastHeader}><View><Text style={styles.cardTitle}>7-day ARIMA forecast</Text><Text style={styles.source}>{forecast?.model_type}</Text></View><Text style={styles.forecastPrice}>{currency(forecastValues[forecastValues.length - 1]?.forecast_price ?? current)}</Text></View><View style={styles.chart}>{forecastValues.map((point, index) => { const range = Math.max(1, maxForecast - minForecast); const bandHeight = Math.max(12, ((point.upper_ci - point.lower_ci) / range) * 100); const top = ((maxForecast - point.upper_ci) / range) * 100; return <View key={point.date} style={styles.barWrap}><View style={[styles.confidence, { height: `${bandHeight}%`, top: `${top}%` }]} /><View style={[styles.forecastDot, { top: `${((maxForecast - point.forecast_price) / range) * 100}%` }]} /></View>; })}</View><Text style={styles.bandLegend}>● Forecast line · shaded range = 80% confidence interval</Text><Text style={styles.advice}>{forecast?.advice}</Text></View>
          <TouchableOpacity style={styles.sell} onPress={() => navigation.navigate("Collect", { prefillWeightKg: 35 })}><Text style={styles.sellText}>+ Sell {material} now</Text><Text style={styles.sellArrow}>→</Text></TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream }, content: { padding: 18, paddingBottom: 40 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }, backBtn: { padding: 8, borderRadius: 8, backgroundColor: "#E2EBE4" }, backText: { color: colors.ink, fontSize: 11, fontWeight: "700" }, live: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#E2EBE4", padding: 7, borderRadius: 8 }, dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green }, liveText: { fontSize: 9, color: colors.green, fontWeight: "900" }, kicker: { color: "#84948B", fontSize: 9, fontWeight: "800", letterSpacing: 1 }, title: { marginTop: 4, color: colors.ink, fontSize: 25, fontWeight: "800" }, subtitle: { color: colors.muted, fontSize: 12, marginTop: 2, marginBottom: 14 }, label: { color: colors.muted, fontSize: 10, fontWeight: "800", marginTop: 8, marginBottom: 6 }, chipScroll: { marginBottom: 4 }, chip: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginRight: 7 }, chipActive: { backgroundColor: colors.green, borderColor: colors.green }, chipText: { color: colors.muted, fontSize: 10, fontWeight: "700" }, chipTextActive: { color: colors.white }, center: { alignItems: "center", padding: 42, gap: 10 }, muted: { color: colors.muted, fontSize: 11 }, error: { backgroundColor: colors.white, padding: 18, borderRadius: 14, marginTop: 14 }, errorTitle: { color: "#991B1B", fontWeight: "900", marginBottom: 5 }, alert: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, marginTop: 14 }, alertUp: { backgroundColor: "#DCFCE7" }, alertDown: { backgroundColor: "#FEE2E2" }, alertIcon: { fontSize: 22, fontWeight: "900" }, alertText: { flex: 1, color: colors.ink, fontSize: 11, fontWeight: "700" }, summary: { flexDirection: "row", alignItems: "center", backgroundColor: colors.white, borderRadius: 16, padding: 15, marginTop: 14, borderWidth: 1, borderColor: colors.line }, summaryLabel: { color: colors.muted, fontSize: 9, fontWeight: "800" }, price: { color: colors.green, fontSize: 24, fontWeight: "900", marginTop: 3 }, unit: { color: colors.muted, fontSize: 10, fontWeight: "600" }, change: { padding: 7, borderRadius: 7, marginLeft: 10 }, up: { backgroundColor: "#DCFCE7" }, down: { backgroundColor: "#FEE2E2" }, flat: { backgroundColor: "#F3F4F6" }, changeText: { color: colors.ink, fontSize: 10, fontWeight: "900" }, speak: { marginLeft: "auto", padding: 8, backgroundColor: "#F3F4F6", borderRadius: 8 }, card: { backgroundColor: colors.white, borderRadius: 16, padding: 15, marginTop: 12, borderWidth: 1, borderColor: colors.line }, cardTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" }, source: { color: colors.muted, fontSize: 9, marginTop: 3 }, chart: { height: 110, flexDirection: "row", alignItems: "stretch", gap: 5, marginTop: 16, borderBottomWidth: 1, borderBottomColor: colors.line }, barWrap: { flex: 1, height: "100%", justifyContent: "flex-end", position: "relative" }, bar: { width: "100%", minHeight: 4, backgroundColor: "#A3D4B3", borderRadius: 3 }, barLatest: { backgroundColor: colors.green }, axis: { flexDirection: "row", justifyContent: "space-between", color: colors.muted, fontSize: 9, marginTop: 5 }, forecastHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }, forecastPrice: { color: colors.green, fontSize: 18, fontWeight: "900" }, confidence: { position: "absolute", left: "20%", right: "20%", backgroundColor: "#CDE8D5", borderRadius: 4 }, forecastDot: { position: "absolute", left: "35%", width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green }, bandLegend: { color: colors.muted, fontSize: 9, marginTop: 8 }, advice: { color: colors.ink, backgroundColor: "#F7FAF8", padding: 10, borderRadius: 8, fontSize: 10, lineHeight: 14, marginTop: 10 }, sell: { flexDirection: "row", justifyContent: "space-between", backgroundColor: colors.greenLight, padding: 13, borderRadius: 12, marginTop: 12 }, sellText: { color: colors.green, fontSize: 12, fontWeight: "900" }, sellArrow: { color: colors.green, fontSize: 16, fontWeight: "900" },
});
