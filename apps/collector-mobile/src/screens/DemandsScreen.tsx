// src/screens/DemandsScreen.tsx — reverse marketplace: what recyclers want right now.
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { cinematic as C, space, type } from "../constants/theme";
import { useTranslation } from "../hooks/useTranslation";
import { goBack, goTab } from "../navigation/ref";
import { getDemandMatches, listDemands, type Demand } from "../services/api/client";
import { isMaterial, materialName } from "../types/domain";
import { EmptyState, ErrorState, Sheet } from "../ui/feedback";
import { MaterialAvatar } from "../ui/materials";
import { ProgressBar, SkeletonCard } from "../ui/motion";
import { Badge, Button, Card, enter, PressScale, Screen, SectionHeader, TopBar } from "../ui/primitives";
import { Text } from "../ui/Text";
import { currency } from "../utils/format";

import { P } from "../constants/palette";
const timeLeft = (hours: number) => (hours < 24 ? `${Math.max(0, Math.round(hours))}h` : `${Math.round(hours / 24)}d`);

export function DemandsScreen() {
  const { t, language } = useTranslation();
  const [selected, setSelected] = useState<Demand | null>(null);
  const demandsQuery = useQuery({ queryKey: ["demands"], queryFn: () => listDemands() });
  const name = (m: string) => (isMaterial(m) ? materialName(m, language) : m);

  const collect = (material: string, weightKg: number) =>
    goTab("Collect", { prefillMaterial: isMaterial(material) ? material : undefined, prefillWeightKg: weightKg });

  const demands = demandsQuery.data ?? [];
  const urgentCount = demands.filter((d) => d.hours_remaining < 48).length;
  const totalKgOpen = demands.reduce((acc, d) => acc + Math.max(0, d.quantity_kg - d.filled_kg), 0);

  return (
    <Screen refreshControl={<RefreshControl refreshing={demandsQuery.isRefetching} onRefresh={() => void demandsQuery.refetch()} tintColor={C.mint} />}>
      <TopBar
        title={t("demandsTitle")}
        kicker={demands.length ? `${t("demandsSubtitle", { n: demands.length, kg: Math.round(totalKgOpen) })}${urgentCount ? ` · ${urgentCount} ${t("urgent").toLowerCase()}` : ""}` : t("demandsKicker")}
        onBack={goBack}
      />

      {demandsQuery.isLoading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : demandsQuery.isError ? (
        <ErrorState title={t("serverDown")} message={t("serverDownMsg")} onRetry={() => void demandsQuery.refetch()} retryLabel={t("retry")} />
      ) : !demands.length ? (
        <EmptyState icon="megaphone-outline" title={t("noDemands")} message={t("noDemandsMsg")} />
      ) : (
        demands.map((d, i) => {
          const remaining = Math.max(0, d.quantity_kg - d.filled_kg);
          const urgent = d.hours_remaining < 48;
          return (
            <Animated.View key={d.id} entering={enter(Math.min(i, 6))}>
              <PressScale onPress={() => setSelected(d)} scaleTo={0.985} accessibilityRole="button" accessibilityLabel={d.recycler_name}>
                <Card tone={urgent ? "warn" : "surface"} style={styles.card}>
                  <View style={styles.head}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.buyer} numberOfLines={1}>{d.recycler_name}</Text>
                      <View style={styles.hubRow}>
                        <Ionicons name="location-outline" size={13} color={C.textFaint} />
                        <Text style={styles.hub} numberOfLines={1}>{d.hub ?? t("noHub")}</Text>
                      </View>
                    </View>
                    {urgent ? <Badge label={t("urgent")} tone="warn" icon="time-outline" /> : d.filled_kg > 0 ? <Badge label={t("partial")} tone="info" /> : null}
                  </View>

                  <View style={styles.materialRow}>
                    <MaterialAvatar material={d.material} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.material} numberOfLines={1}>{name(d.material)}</Text>
                      <Text style={styles.meta}>{t("quality")}: {t(d.quality_required)}</Text>
                    </View>
                    <Text style={styles.price}>{currency(d.offered_price_per_kg)}<Text style={styles.unit}>{t("perKg")}</Text></Text>
                  </View>

                  <View style={{ marginTop: space.md }}>
                    <ProgressBar progress={d.filled_kg / Math.max(1, d.quantity_kg)} height={4} color={C.mint} track={P("rgba(248,250,247,0.08)")} />
                    <View style={styles.progressLabels}>
                      <Text style={styles.small}>{t("filledOf", { a: d.filled_kg.toFixed(1), b: d.quantity_kg })}</Text>
                      <Text style={styles.small}>{t("remaining")}: {remaining.toFixed(1)} {t("kg")}</Text>
                    </View>
                  </View>

                  <View style={styles.stats}>
                    {[
                      [t("deadline"), timeLeft(d.hours_remaining), urgent ? C.amber : C.text],
                      [t("matchesLbl"), String(d.match_count), C.text],
                      [t("maxPayout"), currency(d.offered_price_per_kg * d.quantity_kg), C.mint],
                    ].map(([label, value, color], k) => (
                      <View key={label} style={[styles.stat, k > 0 && styles.statDivider]}>
                        <Text style={styles.statLabel}>{label}</Text>
                        <Text style={[styles.statValue, { color }]}>{value}</Text>
                      </View>
                    ))}
                  </View>

                  {d.notes ? (
                    <View style={styles.notes}>
                      <Text style={styles.notesLabel}>{t("buyerNotes")}</Text>
                      <Text style={styles.notesText}>{d.notes}</Text>
                    </View>
                  ) : null}

                  <Button
                    label={t("collectForBuyer")}
                    icon="camera-outline"
                    variant="secondary"
                    size="md"
                    onPress={() => collect(d.material, Math.min(Math.round(remaining), Math.round(d.quantity_kg)))}
                    style={{ marginTop: space.md }}
                  />
                </Card>
              </PressScale>
            </Animated.View>
          );
        })
      )}

      <Sheet visible={!!selected} onClose={() => setSelected(null)} title={selected?.recycler_name}>
        {selected ? <DemandDetails demand={selected} onCollect={(m, kg) => { setSelected(null); collect(m, kg); }} /> : null}
      </Sheet>
    </Screen>
  );
}

function DemandDetails({ demand, onCollect }: { demand: Demand; onCollect: (material: string, kg: number) => void }) {
  const { t, language } = useTranslation();
  const matches = useQuery({ queryKey: ["demand-matches", demand.id], queryFn: () => getDemandMatches(demand.id) });
  const remaining = Math.max(0, demand.quantity_kg - demand.filled_kg);
  const name = isMaterial(demand.material) ? materialName(demand.material, language) : demand.material;

  return (
    <View style={{ paddingBottom: space.lg }}>
      <View style={styles.materialRow}>
        <MaterialAvatar material={demand.material} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={styles.material}>{name}</Text>
          <Text style={styles.meta}>{t("quality")}: {t(demand.quality_required)}</Text>
        </View>
        <Text style={styles.price}>{currency(demand.offered_price_per_kg)}<Text style={styles.unit}>{t("perKg")}</Text></Text>
      </View>

      <View style={styles.grid}>
        {[
          [t("totalWanted"), `${demand.quantity_kg} ${t("kg")}`],
          [t("alreadyFilled"), `${demand.filled_kg.toFixed(1)} ${t("kg")}`],
          [t("remaining"), `${remaining.toFixed(1)} ${t("kg")}`],
          [t("maxPayout"), currency(demand.offered_price_per_kg * demand.quantity_kg)],
          [t("hoursLeft"), timeLeft(demand.hours_remaining)],
          [t("hub"), demand.hub ?? "—"],
        ].map(([label, value]) => (
          <View key={label} style={styles.gridItem}>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.gridValue} numberOfLines={1}>{value}</Text>
          </View>
        ))}
      </View>

      {demand.notes ? (
        <View style={styles.notes}>
          <Text style={styles.notesLabel}>{t("buyerNotes")}</Text>
          <Text style={styles.notesText}>{demand.notes}</Text>
        </View>
      ) : null}

      <SectionHeader title={t("matchingLots")} />
      {matches.isLoading ? (
        <SkeletonCard />
      ) : matches.isError ? (
        <Text style={styles.small}>{t("serverDownMsg")}</Text>
      ) : !matches.data?.length ? (
        <EmptyState icon="locate-outline" title={t("noMatches")} />
      ) : (
        matches.data.map((m) => (
          <View key={m.lot_id} style={styles.match}>
            <View style={styles.matchScore}><Text style={styles.matchScoreText}>{Math.round(m.match_score)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.matchId} numberOfLines={1}>{m.lot_id}</Text>
              <Text style={styles.small}>{m.weight_kg} {t("kg")} · {m.collector_id}</Text>
              <Text style={styles.small} numberOfLines={2}>{m.match_reasons.join(" · ")}</Text>
            </View>
          </View>
        ))
      )}

      <Button label={t("collectForBuyer")} icon="camera-outline" onPress={() => onCollect(demand.material, Math.min(Math.round(remaining), 35))} style={{ marginTop: space.lg }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: space.md },
  head: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  buyer: { ...type.h3, color: C.text },
  hubRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  hub: { fontSize: 13, color: C.textFaint, flexShrink: 1 },
  materialRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.md },
  material: { fontSize: 16, fontWeight: "600", color: C.text },
  meta: { fontSize: 13, color: C.textSoft, marginTop: 2 },
  price: { fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: C.text },
  unit: { fontSize: 13, fontWeight: "400", color: C.textFaint },
  progressLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: space.xs },
  small: { fontSize: 12, lineHeight: 17, color: C.textSoft },
  stats: { flexDirection: "row", marginTop: space.md, paddingVertical: space.md, borderTopWidth: 1, borderColor: P("rgba(248,250,247,0.07)") },
  stat: { flex: 1, paddingHorizontal: space.sm },
  statDivider: { borderLeftWidth: 1, borderLeftColor: P("rgba(248,250,247,0.07)") },
  statLabel: { fontSize: 12, color: C.textFaint },
  statValue: { fontSize: 15, fontWeight: "600", marginTop: 2 },
  notes: { marginTop: space.md, padding: space.md, borderRadius: 12, backgroundColor: P("rgba(248,250,247,0.035)"), borderWidth: 1, borderColor: P("rgba(248,250,247,0.06)") },
  notesLabel: { fontSize: 12, fontWeight: "600", color: C.teal, marginBottom: 4 },
  notesText: { fontSize: 14, lineHeight: 20, color: C.textSoft },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: space.lg, marginHorizontal: -space.xs },
  gridItem: { width: "50%", padding: space.xs, paddingVertical: space.sm },
  gridValue: { fontSize: 15, fontWeight: "600", color: C.text, marginTop: 2 },
  match: { flexDirection: "row", gap: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: P("rgba(248,250,247,0.06)") },
  matchScore: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: P("#020705"), borderWidth: 1, borderColor: P("rgba(168,232,201,0.2)") },
  matchScoreText: { fontSize: 13, fontWeight: "700", color: C.mint },
  matchId: { fontSize: 14, fontWeight: "600", color: C.text },
});
