// src/components/InsightsCard.tsx — "how to earn more": realised price, money-ranked tips, underpriced sales.
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "../ui/Text";
import Animated from "react-native-reanimated";

import { colors, radius, space, type } from "../constants/theme";
import { useTranslation } from "../hooks/useTranslation";
import type { TranslationKey } from "../i18n";
import { go, goTab } from "../navigation/ref";
import { getCollectorInsights, type CollectorInsights, type InsightCode } from "../services/api/client";
import { speak } from "../services/voice/speech";
import { isMaterial, materialName, type Language } from "../types/domain";
import { MaterialAvatar } from "../ui/materials";
import { ProgressBar } from "../ui/motion";
import { Badge, Card, enter, type IconName, PressScale, SectionHeader } from "../ui/primitives";
import { currency } from "../utils/format";

import { P } from "../constants/palette";
const WEEKDAY: Record<string, Record<Language, string>> = {
  Mon: { en: "Monday", hi: "सोमवार", mr: "सोमवार" },
  Tue: { en: "Tuesday", hi: "मंगलवार", mr: "मंगळवार" },
  Wed: { en: "Wednesday", hi: "बुधवार", mr: "बुधवार" },
  Thu: { en: "Thursday", hi: "गुरुवार", mr: "गुरुवार" },
  Fri: { en: "Friday", hi: "शुक्रवार", mr: "शुक्रवार" },
  Sat: { en: "Saturday", hi: "शनिवार", mr: "शनिवार" },
  Sun: { en: "Sunday", hi: "रविवार", mr: "रविवार" },
};

const SUGGESTION: Record<InsightCode, { icon: IconName; color: string; onPress?: () => void }> = {
  UNDERPRICED: { icon: "trending-down", color: colors.danger, onPress: () => goTab("Market") },
  SWITCH_RECYCLER: { icon: "swap-horizontal", color: colors.info },
  SELL_STALE: { icon: "hourglass", color: colors.accent, onPress: () => goTab("Market") },
  POOL_SMALL_LOTS: { icon: "layers", color: colors.purple },
  NEW_DEMAND: { icon: "megaphone", color: colors.primary, onPress: () => go("Demands") },
  BEST_DAY: { icon: "calendar", color: colors.inkSoft },
};

/** Turn a suggestion code + params into a sentence in the user's language. */
function sentence(s: CollectorInsights["suggestions"][number], t: (k: TranslationKey, v?: Record<string, string | number>) => string, language: Language) {
  const p = s.params;
  const material = typeof p.material === "string" && isMaterial(p.material) ? materialName(p.material, language) : String(p.material ?? "");
  return t(`sug${s.code}` as TranslationKey, {
    ...p,
    material,
    lost: currency(Number(p.lost ?? 0)),
    value: currency(Number(p.value ?? 0)),
    gain: p.gain_percent ?? "",
    day: WEEKDAY[String(p.day)]?.[language] ?? String(p.day ?? ""),
  });
}

export function InsightsCard({ collectorId }: { collectorId: string }) {
  const { t, language } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const { data } = useQuery({
    queryKey: ["insights", collectorId],
    queryFn: () => getCollectorInsights(collectorId),
    staleTime: 60_000,
    retry: 0,
  });
  // Offline or nothing sold/collected yet → nothing useful to say.
  if (!data || (!data.suggestions.length && !data.sold_lots)) return null;

  const tips = showAll ? data.suggestions : data.suggestions.slice(0, 3);
  const realised = Math.min(100, data.realised_percent);
  const bestBuyer = data.recyclers[0];

  return (
    <Animated.View entering={enter(2)}>
      <SectionHeader kicker={t("insightsKicker")} title={t("insightsTitle")} />
      <Card>
        {data.sold_lots ? (
          <View style={{ marginBottom: space.md }}>
            <View style={styles.realisedRow}>
              <Text style={[styles.realised, { color: realised >= 90 ? colors.primary : realised >= 75 ? P("#E5B86A") : colors.danger }]}>{Math.round(realised)}%</Text>
              <Text style={styles.realisedText}>{t("realisedOf")}</Text>
            </View>
            <ProgressBar progress={realised / 100} color={realised >= 90 ? colors.primary : realised >= 75 ? colors.accent : colors.danger} />
          </View>
        ) : null}

        {tips.map((s, i) => {
          const cfg = SUGGESTION[s.code];
          const text = sentence(s, t, language);
          return (
            <PressScale key={s.code + i} onPress={cfg.onPress} haptic={!!cfg.onPress} style={styles.tip} accessibilityRole={cfg.onPress ? "button" : undefined}>
              <View style={[styles.tipIcon, { backgroundColor: cfg.color }]}>
                <Ionicons name={cfg.icon} size={16} color={colors.white} />
              </View>
              <Text style={styles.tipText}>{text}</Text>
              {s.impact_inr > 0 ? <Badge label={`+${currency(s.impact_inr)}`} tone="primary" /> : null}
            </PressScale>
          );
        })}
        <View style={styles.actions}>
          {data.suggestions.length > 3 ? (
            <PressScale onPress={() => setShowAll(!showAll)} style={styles.linkBtn}>
              <Text style={styles.link}>{showAll ? t("close") : `${t("seeAll")} (${data.suggestions.length})`}</Text>
            </PressScale>
          ) : <View />}
          {data.suggestions[0] ? (
            <PressScale onPress={() => speak(sentence(data.suggestions[0]!, t, language), language)} style={styles.speakBtn} accessibilityLabel={t("listen")}>
              <Ionicons name="volume-high" size={16} color={colors.primary} />
              <Text style={styles.link}>{t("listen")}</Text>
            </PressScale>
          ) : null}
        </View>
      </Card>

      {data.underpriced.length ? (
        <Card tone="danger" style={{ marginTop: space.md }}>
          <Text style={styles.subTitle}>{t("underpricedTitle")}</Text>
          {data.underpriced.slice(0, 3).map((u) => (
            <View key={u.lot_id} style={styles.saleRow}>
              <MaterialAvatar material={u.material} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={styles.saleName} numberOfLines={1}>{materialName(u.material, language)} · {u.weight_kg} {t("kg")}</Text>
                <Text style={styles.saleMeta} numberOfLines={1}>
                  {t("soldAt")} {currency(u.sold_per_kg)}{t("perKg")} · {t("fairWas")} {currency(u.fair_per_kg)}{t("perKg")} · {u.recycler_name}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.lostLabel}>{t("lost")}</Text>
                <Text style={styles.lostValue}>{currency(u.lost_inr)}</Text>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {bestBuyer || data.best_material ? (
        <View style={styles.bestRow}>
          {bestBuyer ? (
            <Card style={styles.bestCard}>
              <Text style={styles.bestLabel}>{t("bestBuyer")}</Text>
              <Text style={styles.bestValue} numberOfLines={2}>{bestBuyer.recycler_name}</Text>
              <Text style={styles.bestSub}>{currency(bestBuyer.avg_per_kg)}{t("perKg")}</Text>
            </Card>
          ) : null}
          {data.best_material && isMaterial(data.best_material) ? (
            <Card style={styles.bestCard}>
              <Text style={styles.bestLabel}>{t("bestMaterial")}</Text>
              <Text style={styles.bestValue} numberOfLines={2}>{materialName(data.best_material, language)}</Text>
              <Text style={styles.bestSub}>{currency(data.materials[0]?.earned ?? 0)}</Text>
            </Card>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  realisedRow: { flexDirection: "row", alignItems: "baseline", gap: space.sm, marginBottom: space.sm },
  realised: { ...type.num },
  realisedText: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  tip: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: colors.line },
  tipIcon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  tipText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.ink },
  actions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: space.sm },
  linkBtn: { paddingVertical: 4 },
  link: { fontSize: 13, fontWeight: "800", color: colors.primary },
  speakBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  subTitle: { fontSize: 14, fontWeight: "800", color: colors.danger, marginBottom: space.sm },
  saleRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  saleName: { fontSize: 14, fontWeight: "700", color: colors.ink },
  saleMeta: { marginTop: 2, fontSize: 11, color: colors.inkSoft },
  lostLabel: { fontSize: 10, fontWeight: "700", color: colors.muted },
  lostValue: { fontSize: 15, fontWeight: "800", color: colors.danger },
  bestRow: { flexDirection: "row", gap: space.md, marginTop: space.md },
  bestCard: { flex: 1 },
  bestLabel: { fontSize: 11, fontWeight: "700", color: colors.muted },
  bestValue: { marginTop: 4, fontSize: 15, fontWeight: "800", color: colors.ink },
  bestSub: { marginTop: 2, fontSize: 13, fontWeight: "700", color: colors.primary },
});
