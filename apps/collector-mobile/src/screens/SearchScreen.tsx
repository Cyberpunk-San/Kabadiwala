// src/screens/SearchScreen.tsx — one search box over materials & rates, buyer demands and my lots.
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { dark as D, hues, radius, space, type } from "../constants/theme";
import { useBazarPrices } from "../data/prices";
import { useTranslation } from "../hooks/useTranslation";
import { go, goBack } from "../navigation/ref";
import { listDemands } from "../services/api/client";
import { matchMaterial } from "../services/voice/parser";
import { useAppStore } from "../store/appStore";
import { ALL_MATERIALS, MATERIAL_METADATA, materialName, type Material } from "../types/domain";
import { SearchField, Segmented } from "../ui/controls";
import { EmptyState, ErrorState } from "../ui/feedback";
import { MaterialAvatar } from "../ui/materials";
import { Skeleton } from "../ui/motion";
import { Card, enter, ListRow, PressScale, Screen, TopBar } from "../ui/primitives";
import { Text } from "../ui/Text";
import { currency, relativeDate } from "../utils/format";

type Tab = "materials" | "buyers" | "lots";

/** A material matches if any of its names (en / hi / mr) or a spoken alias contains the query. */
function materialMatches(m: Material, q: string) {
  if (!q) return true;
  const meta = MATERIAL_METADATA[m];
  const hay = `${m} ${meta.hindi} ${meta.marathi} ${meta.category}`.toLowerCase();
  return hay.includes(q) || matchMaterial(q) === m;
}

export function SearchScreen() {
  const { t, language } = useTranslation();
  const lots = useAppStore((s) => s.lots);
  const prices = useBazarPrices();
  const [tab, setTab] = useState<Tab>("materials");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const demands = useQuery({ queryKey: ["demands"], queryFn: () => listDemands(), enabled: tab === "buyers", staleTime: 60_000 });

  const materials = useMemo(() => ALL_MATERIALS.filter((m) => materialMatches(m, q)), [q]);
  const buyers = useMemo(
    () => (demands.data ?? []).filter((d) => !q || d.recycler_name.toLowerCase().includes(q) || materialMatches(d.material as Material, q)),
    [demands.data, q]
  );
  const myLots = useMemo(() => lots.filter((l) => !q || materialMatches(l.material, q) || l.id.toLowerCase().includes(q)), [lots, q]);

  const noResults = <EmptyState icon="search-outline" title={t("noResults", { q: query.trim() })} message={t("noResultsMsg")} />;

  return (
    <Screen dark>
      <TopBar title={t("search")} onBack={goBack} />
      <SearchField value={query} onChangeText={setQuery} placeholder={t("searchPlaceholder")} autoFocus />
      <View style={{ marginTop: space.md, marginBottom: space.lg }}>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "materials", label: t("segMaterials") },
            { value: "buyers", label: t("segBuyers") },
            { value: "lots", label: t("segLots") },
          ]}
        />
      </View>

      {tab === "materials" ? (
        materials.length ? (
          <Animated.View key={`m${q}`} entering={enter(0)}>
            {!q ? <Text style={styles.h}>{t("popularMaterials")}</Text> : null}
            <View style={styles.grid}>
              {materials.map((m, i) => {
                const p = prices.find((x) => x.material === m);
                const change = p?.changePercent ?? 0;
                return (
                  <Animated.View key={m} entering={enter(Math.min(i, 6))} style={styles.cell}>
                    <PressScale onPress={() => go("MaterialDetail", { material: m })} style={styles.tile} accessibilityRole="button">
                      <MaterialAvatar material={m} size={40} onDark />
                      <Text style={styles.tileName} numberOfLines={1}>{materialName(m, language)}</Text>
                      <View style={styles.tileFoot}>
                        <Text style={styles.tilePrice}>{currency(p?.currentPrice ?? MATERIAL_METADATA[m].basePricePerKg)}<Text style={styles.unit}>{t("perKg")}</Text></Text>
                        {p ? <Text style={[styles.delta, { color: change >= 0 ? D.mint : hues.coral }]}>{change >= 0 ? "+" : ""}{change.toFixed(1)}%</Text> : null}
                      </View>
                    </PressScale>
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>
        ) : noResults
      ) : null}

      {tab === "buyers" ? (
        demands.isLoading ? (
          <Card>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={48} style={{ marginVertical: 6, backgroundColor: D.surfaceAlt }} />)}</Card>
        ) : demands.isError ? (
          <ErrorState title={t("serverDown")} message={t("serverDownMsg")} onRetry={() => void demands.refetch()} retryLabel={t("retry")} />
        ) : buyers.length ? (
          <Card>
            {buyers.map((d, i) => (
              <ListRow
                key={d.id}
                icon="business-outline"
                title={d.recycler_name}
                subtitle={`${materialName(d.material as Material, language)}  ${t("wantsKg", { kg: Math.round(d.quantity_kg - d.filled_kg) })}  ${t("daysLeft", { n: Math.max(0, Math.round(d.hours_remaining / 24)) })}`}
                value={`${currency(d.offered_price_per_kg)}${t("perKg")}`}
                onPress={() => go("Demands")}
                last={i === buyers.length - 1}
              />
            ))}
          </Card>
        ) : q ? noResults : <EmptyState icon="business-outline" title={t("noBuyersYet")} />
      ) : null}

      {tab === "lots" ? (
        myLots.length ? (
          <Card>
            {myLots.map((l, i) => (
              <ListRow
                key={l.id}
                icon="cube-outline"
                title={`${materialName(l.material, language)}, ${l.weightKg} ${t("kg")}`}
                subtitle={`${t(`status${l.status}` as "statusOPEN")}  ${relativeDate(l.createdAt, language)}`}
                value={l.expectedNetEarnings ? currency(l.expectedNetEarnings) : undefined}
                onPress={() => go("Handover", { lotId: l.id })}
                last={i === myLots.length - 1}
              />
            ))}
          </Card>
        ) : q ? noResults : <EmptyState icon="cube-outline" title={t("noLotsYet")} />
      ) : null}

      {tab === "lots" && !lots.length ? null : (
        <View style={styles.hint}>
          <Ionicons name="mic-outline" size={14} color={D.faint} />
          <Text style={styles.hintText}>{t("noResultsMsg")}</Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  h: { ...type.h3, color: D.ink, marginBottom: space.md },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -space.xs },
  cell: { width: "50%", padding: space.xs },
  tile: { padding: space.md, borderRadius: radius.lg, backgroundColor: D.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: D.line, gap: 2 },
  tileName: { marginTop: space.sm, fontSize: 15, fontWeight: "500", color: D.ink },
  tileFoot: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  tilePrice: { fontSize: 16, fontWeight: "700", color: D.ink },
  unit: { fontSize: 13, fontWeight: "400", color: D.inkSoft },
  delta: { fontSize: 13, fontWeight: "600" },
  hint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: space.xl },
  hintText: { fontSize: 13, color: D.faint },
});
