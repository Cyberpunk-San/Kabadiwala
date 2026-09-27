// src/screens/OpportunityScreen.tsx — "What should I collect?": on-device opportunity ranking.
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { cinematic as C, space, type } from "../constants/theme";
import { useTranslation } from "../hooks/useTranslation";
import { go, goBack, goTab } from "../navigation/ref";
import { scoreAllOpportunities, type OpportunityScore } from "../services/ai/opportunityScorer";
import { speak } from "../services/voice/speech";
import { materialName } from "../types/domain";
import { MaterialAvatar } from "../ui/materials";
import { ProgressBar } from "../ui/motion";
import { Badge, Button, Card, enter, GradientCard, ListRow, PressScale, Screen, SectionHeader, TopBar } from "../ui/primitives";
import { Text } from "../ui/Text";
import { currency } from "../utils/format";

import { P } from "../constants/palette";
/** One hue per grade, drawn from the palette's accents. */
const GRADE: Record<OpportunityScore["grade"], string> = { S: C.lavender, A: C.mint, B: C.teal, C: C.amber, D: C.rose };

export function OpportunityScreen() {
  const { language, t } = useTranslation();
  const scores = useMemo(() => scoreAllOpportunities(), []);
  const topItem = scores[0];
  const reason = (o: OpportunityScore) => (language === "hi" ? o.reasoningHi : language === "mr" ? o.reasoningMr : o.reasoning);
  const demandLabel = (d: OpportunityScore["demand"]) => t(d === "HIGH" ? "high" : d === "LOW" ? "low" : "medium");

  const narrateTop = () => {
    if (!topItem) return;
    speak(`${materialName(topItem.material, language)}. ${t("aiScore")} ${topItem.score}. ${reason(topItem)}`, language);
  };

  return (
    <Screen>
      <TopBar
        title={t("oppTitle")}
        kicker={t("oppSubtitle", { n: scores.length })}
        onBack={goBack}
        right={
          <PressScale onPress={narrateTop} style={styles.iconBtn} accessibilityLabel={t("listen")} accessibilityRole="button">
            <Ionicons name="volume-high-outline" size={18} color={C.mint} />
          </PressScale>
        }
      />

      <Card style={{ paddingVertical: 0, marginBottom: space.lg }}>
        <ListRow icon="map-outline" title={t("openMap")} subtitle={t("regionTitle")} onPress={() => go("Regional")} last />
      </Card>

      {topItem ? (
        <Animated.View entering={enter(0)}>
          <GradientCard>
            <View style={styles.heroTop}>
              <Text style={styles.heroKicker}>{t("topPick")}</Text>
              <Badge label={`${topItem.grade}`} tone="light" icon="ribbon-outline" />
            </View>
            <View style={styles.heroName}>
              <MaterialAvatar material={topItem.material} size={48} onDark />
              <Text style={styles.heroMaterial} numberOfLines={2}>{materialName(topItem.material, language)}</Text>
            </View>

            <View style={styles.heroStats}>
              {[
                [t("aiScore"), `${topItem.score}/100`],
                [t("perKg").replace("/", ""), currency(topItem.currentPricePerKg)],
                [t("demand"), demandLabel(topItem.demand)],
              ].map(([label, value], i) => (
                <View key={label} style={[styles.heroStat, i > 0 && styles.heroStatDivider]}>
                  <Text style={styles.heroStatLabel}>{label}</Text>
                  <Text style={styles.heroStatValue}>{value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.signals}>
              {([
                ["momentum", topItem.signals.momentum],
                ["urgency", topItem.signals.urgency],
                ["capacity", topItem.signals.capacityMatch],
                ["logistics", topItem.signals.logisticsNet],
                ["scarcity", topItem.signals.scarcityPremium],
              ] as const).map(([key, val], i) => (
                <View key={key} style={styles.signal}>
                  <Text style={styles.signalLabel}>{t(key)}</Text>
                  <View style={{ flex: 1 }}><ProgressBar progress={val / 100} height={4} color={C.mint} track={P("rgba(248,250,247,0.1)")} delay={120 + i * 60} /></View>
                  <Text style={styles.signalVal}>{val}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.heroReason}>{reason(topItem)}</Text>
            <Button label={t("startCollecting")} icon="camera-outline" variant="light" onPress={() => goTab("Collect", { prefillMaterial: topItem.material })} style={{ marginTop: space.lg }} />
          </GradientCard>
        </Animated.View>
      ) : null}

      <SectionHeader title={t("allRanked")} />
      {scores.map((item, i) => (
        <Animated.View key={item.material} entering={enter(Math.min(i, 6))}>
          <PressScale onPress={() => goTab("Market", { material: item.material, quality: "medium", weightKg: 35 })} scaleTo={0.985} accessibilityRole="button">
            <Card tone={item.isHazard ? "warn" : "surface"} style={styles.card}>
              <View style={styles.cardHead}>
                <View style={[styles.rank, { borderColor: `${GRADE[item.grade]}55` }]}>
                  <Text style={[styles.rankText, { color: GRADE[item.grade] }]}>{item.rank}</Text>
                </View>
                <MaterialAvatar material={item.material} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName} numberOfLines={1}>{materialName(item.material, language)}</Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {demandLabel(item.demand)} {t("demand").toLowerCase()} · {item.changePercent > 0 ? "+" : ""}{item.changePercent}%
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.score, { color: GRADE[item.grade] }]}>{item.score}</Text>
                  <Text style={styles.grade}>{item.grade}</Text>
                </View>
              </View>
              <View style={{ marginTop: space.md }}>
                <ProgressBar progress={item.score / 100} height={4} color={GRADE[item.grade]} track={P("rgba(248,250,247,0.08)")} />
              </View>
              <View style={styles.cardStats}>
                <Text style={styles.cardStat}>{currency(item.currentPricePerKg)}{t("perKg")}</Text>
                <Text style={styles.cardStat}>{t("momentum")} {item.signals.momentum}</Text>
                <Text style={styles.cardStat}>{t("urgency")} {item.signals.urgency}</Text>
                {item.isHazard ? <Badge label={t("hazardAlert")} tone="warn" icon="warning-outline" /> : null}
              </View>
              <Text style={styles.cardReason} numberOfLines={2}>{reason(item)}</Text>
            </Card>
          </PressScale>
        </Animated.View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: P("#020705"), borderWidth: 1, borderColor: C.border },

  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroKicker: { fontSize: 13, fontWeight: "500", color: C.textSoft },
  heroName: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.md },
  heroMaterial: { flex: 1, ...type.h1, color: C.text },
  heroStats: { flexDirection: "row", marginTop: space.lg, paddingVertical: space.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: P("rgba(248,250,247,0.08)") },
  heroStat: { flex: 1, paddingHorizontal: space.sm },
  heroStatDivider: { borderLeftWidth: 1, borderLeftColor: P("rgba(248,250,247,0.08)") },
  heroStatLabel: { fontSize: 12, color: C.textFaint },
  heroStatValue: { fontSize: 16, fontWeight: "600", color: C.text, marginTop: 2 },
  signals: { gap: space.sm, marginTop: space.lg },
  signal: { flexDirection: "row", alignItems: "center", gap: space.md },
  signalLabel: { width: 96, fontSize: 13, color: C.textSoft },
  signalVal: { width: 28, fontSize: 13, fontWeight: "600", color: C.text, textAlign: "right" },
  heroReason: { fontSize: 14, lineHeight: 21, color: C.textSoft, marginTop: space.lg },

  card: { marginBottom: space.md },
  cardHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  rank: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: P("#020705"), borderWidth: 1 },
  rankText: { fontSize: 12, fontWeight: "700" },
  cardName: { fontSize: 16, fontWeight: "600", color: C.text },
  cardMeta: { fontSize: 13, color: C.textSoft, marginTop: 2 },
  score: { fontSize: 22, fontWeight: "700", letterSpacing: -0.4 },
  grade: { fontSize: 12, color: C.textFaint },
  cardStats: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.md, marginTop: space.md },
  cardStat: { fontSize: 13, color: C.textSoft },
  cardReason: { fontSize: 13, lineHeight: 19, color: C.textFaint, marginTop: space.sm },
});
