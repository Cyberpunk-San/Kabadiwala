// apps/collector-mobile/src/screens/DemandsScreen.tsx
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { colors } from "../constants/theme";
import type { RootTabParamList } from "../navigation/types";
import {
  getDemandMatches,
  listDemands,
  type Demand,
} from "../services/api/client";
import { currency } from "../utils/format";

type Props = {
  navigation: any;
};

// ─── Material icons (keep in sync with types/domain.ts MATERIAL_METADATA) ───
const MATERIAL_ICONS: Record<string, string> = {
  "Copper cable": "⚡",
  "Server boards": "💾",
  "Aluminium": "🥫",
  "Mixed e-waste": "🔌",
  "Lithium-ion batteries": "🔋",
  "Brass fittings": "🪙",
  "Printed Circuit Boards (PCB)": "🖨",
  "Electric motors": "⚙",
  "Iron & steel scrap": "🔩",
  "CRT & monitor glass": "🖥",
  "Lead acid batteries": "🛢",
  "Compressors & cooling units": "❄",
};

export function DemandsScreen({ navigation }: Props) {
  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null);

  const demandsQuery = useQuery({
    queryKey: ["demands"],
    queryFn: () => listDemands(),
  });

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (demandsQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.green} />
        <Text style={styles.loadingText}>Loading open demands…</Text>
      </View>
    );
  }

  // ─── Error ───────────────────────────────────────────────────────────────
  if (demandsQuery.isError || !demandsQuery.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>⚠</Text>
        <Text style={styles.errorTitle}>Could not load demands</Text>
        <Text style={styles.errorBody}>
          Make sure the backend is running and reachable.
        </Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => demandsQuery.refetch()}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const demands = demandsQuery.data;

  // ─── Empty ───────────────────────────────────────────────────────────────
  if (demands.length === 0) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.center}
        refreshControl={
          <RefreshControl
            refreshing={demandsQuery.isFetching}
            onRefresh={() => demandsQuery.refetch()}
          />
        }
      >
        <Text style={styles.emptyIcon}>📭</Text>
        <Text style={styles.emptyTitle}>No open demands</Text>
        <Text style={styles.emptyBody}>
          Recyclers haven't posted any demand yet.{"\n"}Pull down to refresh.
        </Text>
      </ScrollView>
    );
  }

  // ─── Summary counts ──────────────────────────────────────────────────────
  const urgentCount = demands.filter((d) => d.hours_remaining < 48).length;
  const totalKgOpen = demands.reduce(
    (acc, d) => acc + Math.max(0, d.quantity_kg - d.filled_kg),
    0
  );

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={demandsQuery.isFetching}
            onRefresh={() => demandsQuery.refetch()}
          />
        }
      >
        <Text style={styles.kicker}>REVERSE MARKETPLACE</Text>
        <Text style={styles.title}>Buyers need this today</Text>
        <Text style={styles.subtitle}>
          {demands.length} open demand{demands.length > 1 ? "s" : ""} ·{" "}
          {Math.round(totalKgOpen)} kg total wanted
          {urgentCount > 0 ? ` · ${urgentCount} urgent` : ""}
        </Text>

        {/* Legend bar */}
        <View style={styles.legendBar}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#49A36B" }]} />
            <Text style={styles.legendText}>Open</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#FCD34D" }]} />
            <Text style={styles.legendText}>Urgent (&lt;48h)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#8897A2" }]} />
            <Text style={styles.legendText}>Partially filled</Text>
          </View>
        </View>

        {demands.map((d) => {
          const remaining = Math.max(0, d.quantity_kg - d.filled_kg);
          const progress = Math.min(100, (d.filled_kg / d.quantity_kg) * 100);
          const urgent = d.hours_remaining < 48;
          const partiallyFilled = d.filled_kg > 0;
          const icon = MATERIAL_ICONS[d.material] ?? "📦";

          return (
            <TouchableOpacity
              key={d.id}
              activeOpacity={0.9}
              style={[styles.card, urgent && styles.cardUrgent]}
              onPress={() => setSelectedDemand(d)}
            >
              {/* Header: recycler + urgent badge */}
              <View style={styles.cardHeader}>
                <View style={styles.recyclerBlock}>
                  <Text style={styles.recyclerName} numberOfLines={1}>
                    {d.recycler_name}
                  </Text>
                  <Text style={styles.hubText} numberOfLines={1}>
                    📍 {d.hub ?? "Location not specified"}
                  </Text>
                </View>
                {urgent && (
                  <View style={styles.urgentBadge}>
                    <Text style={styles.urgentText}>URGENT</Text>
                  </View>
                )}
              </View>

              {/* Material row */}
              <View style={styles.materialRow}>
                <Text style={styles.materialIcon}>{icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.material}>{d.material}</Text>
                  <Text style={styles.materialMeta}>
                    Quality: {d.quality_required.toUpperCase()} ·{" "}
                    {d.status === "PARTIAL" ? "Partially filled" : "Open"}
                  </Text>
                </View>
                <View style={styles.priceBlock}>
                  <Text style={styles.priceValue}>
                    {currency(d.offered_price_per_kg)}
                  </Text>
                  <Text style={styles.priceUnit}>per kg</Text>
                </View>
              </View>

              {/* Progress bar */}
              <View style={styles.track}>
                <View
                  style={[
                    styles.progress,
                    { width: `${progress}%` },
                    partiallyFilled && styles.progressPartial,
                  ]}
                />
              </View>
              <View style={styles.progressLabels}>
                <Text style={styles.progressText}>
                  {d.filled_kg.toFixed(1)} / {d.quantity_kg} kg filled
                </Text>
                <Text style={styles.progressText}>
                  {remaining.toFixed(1)} kg remaining
                </Text>
              </View>

              {/* Stats row */}
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>DEADLINE</Text>
                  <Text
                    style={[
                      styles.statValue,
                      urgent && { color: "#B45309" },
                    ]}
                  >
                    {d.hours_remaining < 24
                      ? `${Math.round(d.hours_remaining)}h`
                      : `${Math.round(d.hours_remaining / 24)}d`}
                  </Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>MATCHES</Text>
                  <Text style={styles.statValue}>{d.match_count}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>MAX PAYOUT</Text>
                  <Text style={styles.statValueGreen}>
                    {currency(d.offered_price_per_kg * d.quantity_kg)}
                  </Text>
                </View>
              </View>

              {/* Notes */}
              {d.notes ? (
                <View style={styles.notesBox}>
                  <Text style={styles.notesLabel}>BUYER NOTES</Text>
                  <Text style={styles.notesText}>{d.notes}</Text>
                </View>
              ) : null}

              {/* CTA */}
              <TouchableOpacity
                style={styles.cta}
                onPress={() =>
                  navigation.navigate("Collect", {
                    prefillMaterial: d.material,
                    prefillWeightKg: Math.min(
                      Math.round(remaining),
                      Math.round(d.quantity_kg)
                    ),
                  })
                }
              >
                <Text style={styles.ctaText}>
                  Collect for this buyer →
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            New demands appear as recyclers post them. Pull down to refresh.
          </Text>
        </View>
      </ScrollView>

      {/* ─── Match details modal ───────────────────────────────────────── */}
      {selectedDemand && (
        <MatchModal
          demand={selectedDemand}
          onClose={() => setSelectedDemand(null)}
          onNavigateToCollect={(material, weight) => {
            setSelectedDemand(null);
            navigation.navigate("Collect", {
              prefillMaterial: material,
              prefillWeightKg: weight,
            });
          }}
        />
      )}
    </>
  );
}

// ─── Match Details Modal ─────────────────────────────────────────────────────

function MatchModal({
  demand,
  onClose,
  onNavigateToCollect,
}: {
  demand: Demand;
  onClose: () => void;
  onNavigateToCollect: (material: string, weightKg: number) => void;
}) {
  const matchesQuery = useQuery({
    queryKey: ["demand-matches", demand.id],
    queryFn: () => getDemandMatches(demand.id),
  });

  const remaining = Math.max(0, demand.quantity_kg - demand.filled_kg);
  const icon = MATERIAL_ICONS[demand.material] ?? "📦";

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalKicker}>DEMAND DETAILS</Text>
              <Text style={styles.modalTitle} numberOfLines={2}>
                {demand.recycler_name}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Material hero */}
            <View style={styles.modalHero}>
              <Text style={styles.modalHeroIcon}>{icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalHeroMaterial}>{demand.material}</Text>
                <Text style={styles.modalHeroMeta}>
                  Quality: {demand.quality_required.toUpperCase()}
                </Text>
              </View>
              <View style={styles.modalHeroPrice}>
                <Text style={styles.modalHeroPriceValue}>
                  {currency(demand.offered_price_per_kg)}
                </Text>
                <Text style={styles.modalHeroPriceUnit}>/kg</Text>
              </View>
            </View>

            {/* Full stats */}
            <View style={styles.modalGrid}>
              <View style={styles.modalGridItem}>
                <Text style={styles.modalGridLabel}>TOTAL WANTED</Text>
                <Text style={styles.modalGridValue}>
                  {demand.quantity_kg} kg
                </Text>
              </View>
              <View style={styles.modalGridItem}>
                <Text style={styles.modalGridLabel}>ALREADY FILLED</Text>
                <Text style={styles.modalGridValue}>
                  {demand.filled_kg.toFixed(1)} kg
                </Text>
              </View>
              <View style={styles.modalGridItem}>
                <Text style={styles.modalGridLabel}>REMAINING</Text>
                <Text style={[styles.modalGridValue, { color: colors.green }]}>
                  {remaining.toFixed(1)} kg
                </Text>
              </View>
              <View style={styles.modalGridItem}>
                <Text style={styles.modalGridLabel}>MAX PAYOUT</Text>
                <Text style={styles.modalGridValue}>
                  {currency(demand.offered_price_per_kg * demand.quantity_kg)}
                </Text>
              </View>
              <View style={styles.modalGridItem}>
                <Text style={styles.modalGridLabel}>HOURS LEFT</Text>
                <Text
                  style={[
                    styles.modalGridValue,
                    demand.hours_remaining < 48 && { color: "#B45309" },
                  ]}
                >
                  {Math.round(demand.hours_remaining)}h
                </Text>
              </View>
              <View style={styles.modalGridItem}>
                <Text style={styles.modalGridLabel}>HUB</Text>
                <Text style={styles.modalGridValue} numberOfLines={1}>
                  {demand.hub ?? "—"}
                </Text>
              </View>
            </View>

            {/* Buyer notes */}
            {demand.notes ? (
              <View style={styles.modalNotes}>
                <Text style={styles.modalNotesLabel}>BUYER NOTES</Text>
                <Text style={styles.modalNotesText}>{demand.notes}</Text>
              </View>
            ) : null}

            {/* Matches list */}
            <Text style={styles.modalSectionTitle}>
              Your matching lots
            </Text>

            {matchesQuery.isLoading ? (
              <ActivityIndicator
                color={colors.green}
                style={{ marginVertical: 20 }}
              />
            ) : matchesQuery.isError || !matchesQuery.data ? (
              <View style={styles.noMatch}>
                <Text style={styles.noMatchText}>
                  Could not load matching lots.
                </Text>
              </View>
            ) : matchesQuery.data.length === 0 ? (
              <View style={styles.noMatch}>
                <Text style={styles.noMatchIcon}>🎯</Text>
                <Text style={styles.noMatchText}>
                  No local lots match yet. Collect {demand.material} to be the
                  first supplier.
                </Text>
              </View>
            ) : (
              matchesQuery.data.map((m) => (
                <View key={m.lot_id} style={styles.matchRow}>
                  <View style={styles.matchScoreCircle}>
                    <Text style={styles.matchScoreValue}>
                      {Math.round(m.match_score)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.matchLotId} numberOfLines={1}>
                      {m.lot_id}
                    </Text>
                    <Text style={styles.matchWeight}>
                      {m.weight_kg} kg · {m.collector_id}
                    </Text>
                    <Text style={styles.matchReason} numberOfLines={2}>
                      {m.match_reasons.join(" · ")}
                    </Text>
                  </View>
                </View>
              ))
            )}

            {/* CTA */}
            <TouchableOpacity
              style={styles.modalCta}
              onPress={() =>
                onNavigateToCollect(
                  demand.material,
                  Math.min(Math.round(remaining), 35)
                )
              }
            >
              <Text style={styles.modalCtaText}>
                Collect {demand.material} →
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 19, paddingBottom: 40 },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream,
    padding: 30,
  },
  loadingText: { marginTop: 10, color: colors.muted, fontSize: 12 },
  errorIcon: { fontSize: 40, marginBottom: 10 },
  errorTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: 6,
  },
  errorBody: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    marginBottom: 20,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: colors.green,
  },
  retryText: { color: colors.white, fontSize: 12, fontWeight: "800" },

  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 18,
  },

  kicker: {
    color: "#84948B",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  title: {
    marginTop: 4,
    color: colors.ink,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 14,
    color: colors.muted,
    fontSize: 12,
  },

  legendBar: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: colors.muted, fontWeight: "700" },

  card: {
    marginBottom: 12,
    padding: 16,
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardUrgent: {
    borderColor: "#FCD34D",
    borderWidth: 1.5,
    backgroundColor: "#FFFBEB",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  recyclerBlock: { flex: 1, marginRight: 8 },
  recyclerName: { fontSize: 12, fontWeight: "800", color: colors.ink },
  hubText: { fontSize: 10, color: colors.muted, marginTop: 2 },
  urgentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#FEF3C7",
  },
  urgentText: {
    color: "#B45309",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  materialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  materialIcon: { fontSize: 28 },
  material: { fontSize: 17, fontWeight: "900", color: colors.ink },
  materialMeta: { marginTop: 3, fontSize: 10, color: colors.muted },
  priceBlock: { alignItems: "flex-end" },
  priceValue: { fontSize: 18, fontWeight: "900", color: colors.green },
  priceUnit: { fontSize: 9, color: colors.muted, fontWeight: "700" },

  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E6EDE7",
    overflow: "hidden",
    marginTop: 4,
  },
  progress: { height: "100%", backgroundColor: "#49A36B", borderRadius: 4 },
  progressPartial: { backgroundColor: "#8897A2" },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 5,
    marginBottom: 12,
  },
  progressText: { fontSize: 9, color: colors.muted, fontWeight: "700" },

  statsRow: { flexDirection: "row", gap: 6 },
  stat: {
    flex: 1,
    padding: 9,
    borderRadius: 10,
    backgroundColor: "#F6F9F6",
    alignItems: "center",
  },
  statLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: colors.muted,
    letterSpacing: 0.5,
  },
  statValue: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "900",
    color: colors.ink,
  },
  statValueGreen: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "900",
    color: colors.green,
  },

  notesBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#F7FAF8",
    borderLeftWidth: 3,
    borderLeftColor: "#A3D4B3",
  },
  notesLabel: {
    fontSize: 8,
    fontWeight: "900",
    color: "#3C6349",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  notesText: { fontSize: 10, color: "#4A5568", lineHeight: 14 },

  cta: {
    marginTop: 12,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: colors.green,
    alignItems: "center",
  },
  ctaText: { color: colors.white, fontSize: 12, fontWeight: "800" },

  footer: { marginTop: 16, alignItems: "center" },
  footerText: { fontSize: 10, color: colors.muted, textAlign: "center" },

  // ─── Modal ───────────────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    paddingTop: 18,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  modalKicker: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.muted,
    letterSpacing: 1,
  },
  modalTitle: {
    marginTop: 3,
    fontSize: 16,
    fontWeight: "900",
    color: colors.ink,
    lineHeight: 20,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EEF2EE",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  closeBtnText: { fontSize: 16, color: colors.ink, fontWeight: "700" },

  modalScroll: { maxHeight: "100%" },
  modalScrollContent: { padding: 20, paddingBottom: 40 },

  modalHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 14,
  },
  modalHeroIcon: { fontSize: 32 },
  modalHeroMaterial: { fontSize: 15, fontWeight: "900", color: colors.ink },
  modalHeroMeta: { marginTop: 3, fontSize: 10, color: colors.muted },
  modalHeroPrice: { alignItems: "flex-end" },
  modalHeroPriceValue: { fontSize: 16, fontWeight: "900", color: colors.green },
  modalHeroPriceUnit: { fontSize: 9, color: colors.muted, fontWeight: "700" },

  modalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  modalGridItem: {
    width: "48%",
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  modalGridLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: colors.muted,
    letterSpacing: 0.5,
  },
  modalGridValue: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "900",
    color: colors.ink,
  },

  modalNotes: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F7FAF8",
    borderLeftWidth: 3,
    borderLeftColor: "#A3D4B3",
    marginBottom: 18,
  },
  modalNotesLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#3C6349",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  modalNotesText: { fontSize: 11, color: "#4A5568", lineHeight: 16 },

  modalSectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: 10,
  },

  noMatch: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#C6D8CB",
    alignItems: "center",
    marginBottom: 14,
  },
  noMatchIcon: { fontSize: 28, marginBottom: 6 },
  noMatchText: {
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 16,
  },

  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 8,
  },
  matchScoreCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.greenLight,
    alignItems: "center",
    justifyContent: "center",
  },
  matchScoreValue: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.green,
  },
  matchLotId: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.ink,
    fontFamily: "monospace",
  },
  matchWeight: { marginTop: 2, fontSize: 10, color: colors.muted },
  matchReason: {
    marginTop: 4,
    fontSize: 9,
    color: "#5B7066",
    fontStyle: "italic",
    lineHeight: 12,
  },

  modalCta: {
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.green,
    alignItems: "center",
  },
  modalCtaText: { color: colors.white, fontSize: 13, fontWeight: "900" },
});