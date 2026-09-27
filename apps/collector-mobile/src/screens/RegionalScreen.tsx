// src/screens/RegionalScreen.tsx — regional intelligence: hotspots / price heatmap on an offline SVG map,
// ranked industry areas ("where to collect") and materials buyers are short of.
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { useAppSize } from "../ui/frame";
import { Text } from "../ui/Text";
import Animated from "react-native-reanimated";
import Svg, { Circle, G, Rect, Text as SvgText } from "react-native-svg";

import { config } from "../constants/config";
import { colors, radius, space, type } from "../constants/theme";
import { useScreenNarration } from "../hooks/useScreenNarration";
import { useTranslation } from "../hooks/useTranslation";
import type { TranslationKey } from "../i18n";
import { goBack, goTab } from "../navigation/ref";
import { getPriceHeatmap, getRegionalOverview, type RegionalOverview } from "../services/api/client";
import { useAuthStore } from "../store/authStore";
import { ALL_MATERIALS, materialName, type Material } from "../types/domain";
import { EmptyState, ErrorState } from "../ui/feedback";
import { MaterialAvatar } from "../ui/materials";
import { SkeletonCard } from "../ui/motion";
import { Badge, Button, Card, Chip, enter, PressScale, Screen, SectionHeader, TopBar } from "../ui/primitives";
import { currency } from "../utils/format";

import { P } from "../constants/palette";
const RADIUS_KM = 30;
type Cluster = RegionalOverview["clusters"][number];

/** green → amber → red for 0..1 */
function heat(t: number) {
  const x = Math.max(0, Math.min(1, t));
  const stops = [[25, 169, 130], [229, 184, 106], [231, 137, 143]] as const;
  const [a, b, f] = x < 0.5 ? [stops[0], stops[1], x * 2] : [stops[1], stops[2], (x - 0.5) * 2];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i]! - v) * f)).join(",")})`;
}

export function RegionalScreen() {
  const { t, language } = useTranslation();
  useScreenNarration("Regional");
  const collector = useAuthStore((s) => s.collector);
  const { width } = useAppSize();
  const [layer, setLayer] = useState<"hotspots" | "price">("hotspots");
  const [material, setMaterial] = useState<Material>("Copper cable");
  const [selected, setSelected] = useState<Cluster | null>(null);

  const lat = collector?.latitude ?? config.defaultLatitude;
  const lon = collector?.longitude ?? config.defaultLongitude;

  const overview = useQuery({
    queryKey: ["regional", lat, lon],
    queryFn: () => getRegionalOverview(lat, lon, RADIUS_KM),
    staleTime: 60_000,
  });
  const prices = useQuery({
    queryKey: ["price-heatmap", material, lat, lon],
    queryFn: () => getPriceHeatmap(material, lat, lon, RADIUS_KM),
    enabled: layer === "price",
    staleTime: 60_000,
  });

  const o = overview.data;
  const size = Math.min(width - space.lg * 2, 560);

  // Equirectangular projection of the ±RADIUS_KM square around the collector.
  const dLat = RADIUS_KM / 111;
  const dLon = RADIUS_KM / (111 * Math.cos((lat * Math.PI) / 180));
  const x = (lo: number) => ((lo - (lon - dLon)) / (2 * dLon)) * size;
  const y = (la: number) => (1 - (la - (lat - dLat)) / (2 * dLat)) * size;
  const cellW = (degLon: number) => (degLon / (2 * dLon)) * size;
  const cellH = (degLat: number) => (degLat / (2 * dLat)) * size;

  const priceLo = prices.data?.min_price ?? 0;
  const priceSpan = Math.max(1, (prices.data?.max_price ?? 1) - priceLo);

  return (
    <Screen refreshControl={<RefreshControl refreshing={overview.isRefetching} onRefresh={() => void overview.refetch()} tintColor={colors.primary} />}>
      <TopBar kicker={t("regionKicker")} title={t("regionTitle")} onBack={goBack} />

      <View style={styles.chips}>
        <Chip label={t("layerHotspots")} icon="flame" active={layer === "hotspots"} onPress={() => setLayer("hotspots")} />
        <Chip label={t("layerPrice")} icon="pricetag" active={layer === "price"} onPress={() => setLayer("price")} />
      </View>
      {layer === "price" ? (
        <View style={[styles.chips, { marginTop: space.sm }]}>
          {ALL_MATERIALS.map((m) => <Chip key={m} label={materialName(m, language)} active={material === m} onPress={() => setMaterial(m)} />)}
        </View>
      ) : null}

      {overview.isLoading ? (
        <SkeletonCard />
      ) : overview.isError || !o ? (
        <ErrorState title={t("serverDown")} message={t("serverDownMsg")} onRetry={() => void overview.refetch()} retryLabel={t("retry")} />
      ) : (
        <>
          <Animated.View entering={enter(1)} style={[styles.mapWrap, { width: size, height: size }]}>
            <Svg width={size} height={size}>
              <Rect x={0} y={0} width={size} height={size} fill={P("rgba(248,250,247,0.03)")} />
              <Circle cx={size / 2} cy={size / 2} r={size / 2 - 1} stroke={P("rgba(248,250,247,0.12)")} strokeDasharray="4 4" fill="none" />

              {layer === "hotspots"
                ? o.cells.filter((c) => c.score > 0).map((c, i) => (
                    <Rect key={`h${i}`} x={x(c.longitude - o.cell_deg / 2)} y={y(c.latitude + o.cell_deg / 2)}
                      width={cellW(o.cell_deg)} height={cellH(o.cell_deg)} rx={3}
                      fill={heat(c.score / 100)} opacity={0.3 + 0.5 * (c.score / 100)} />
                  ))
                : (prices.data?.cells ?? []).map((c, i) =>
                    c.best_net_per_kg == null ? null : (
                      <Rect key={`p${i}`} x={x(c.longitude - prices.data!.step_lon / 2)} y={y(c.latitude + prices.data!.step_lat / 2)}
                        width={cellW(prices.data!.step_lon)} height={cellH(prices.data!.step_lat)}
                        fill={heat(1 - (c.best_net_per_kg - priceLo) / priceSpan)} opacity={0.45} />
                    )
                  )}

              {o.clusters.map((c) => (
                <G key={c.id} onPress={() => setSelected(c)}>
                  <Circle cx={x(c.longitude)} cy={y(c.latitude)} r={6 + c.size * 3} stroke={colors.info} strokeWidth={selected?.id === c.id ? 3 : 2} fill={P("rgba(59,130,246,0.15)")} />
                </G>
              ))}
              {o.recyclers.map((r) => (
                <Circle key={r.id} cx={x(r.longitude)} cy={y(r.latitude)} r={5} fill={P("#19A982")} stroke={P("#030907")} strokeWidth={2} />
              ))}
              {layer === "hotspots"
                ? o.hotspots.map((h, i) => (
                    <G key={`n${i}`}>
                      <Circle cx={x(h.longitude)} cy={y(h.latitude)} r={9} fill={P("#020705")} stroke={P("#A8E8C9")} strokeWidth={1.2} />
                      <SvgText x={x(h.longitude)} y={y(h.latitude) + 4} fontSize={10} fontWeight="bold" fill={P("#A8E8C9")} textAnchor="middle">{i + 1}</SvgText>
                    </G>
                  ))
                : null}

              <Circle cx={size / 2} cy={size / 2} r={11} fill={P("rgba(15,42,34,0.18)")} />
              <Circle cx={size / 2} cy={size / 2} r={6} fill={P("#E5B86A")} stroke={P("#030907")} strokeWidth={2} />
            </Svg>
          </Animated.View>

          <View style={styles.legend}>
            <View style={[styles.legendBar, { backgroundColor: heat(0) }]} />
            <View style={[styles.legendBar, { backgroundColor: heat(0.5) }]} />
            <View style={[styles.legendBar, { backgroundColor: heat(1) }]} />
            <Text style={styles.legendText}>
              {layer === "price"
                ? prices.data?.max_price != null ? `${t("netFor35")}: ${currency(prices.data.max_price)} → ${currency(priceLo)}` : t("loading")
                : t("layerHotspots")}
            </Text>
            <View style={[styles.dot, { backgroundColor: colors.orange }]} /><Text style={styles.legendText}>{t("you")}</Text>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} /><Text style={styles.legendText}>{t("recyclerLbl")}</Text>
            <View style={[styles.dot, { borderWidth: 2, borderColor: colors.info }]} /><Text style={styles.legendText}>{t("industryLbl")}</Text>
          </View>

          {selected ? (
            <ClusterCard cluster={selected} onClose={() => setSelected(null)} />
          ) : (
            <Text style={styles.hint}>{t("tapArea")}</Text>
          )}

          {layer === "hotspots" && o.hotspots.length ? (
            <>
              <SectionHeader title={t("layerHotspots")} />
              {o.hotspots.slice(0, 4).map((h, i) => (
                <Card key={i} style={styles.hotspot}>
                  <View style={styles.rank}><Text style={styles.rankText}>{i + 1}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{h.area ?? "—"} · {h.distance_km} km</Text>
                    <View style={styles.reasons}>
                      {h.reasons.map((r) => <Badge key={r} label={t(`reason${r}` as TranslationKey)} tone="muted" />)}
                    </View>
                  </View>
                  <Text style={[styles.score, { color: heat(h.score / 100) }]}>{Math.round(h.score)}</Text>
                </Card>
              ))}
            </>
          ) : null}

          <SectionHeader title={t("whereToCollect")} />
          {o.clusters.length === 0 ? (
            <EmptyState icon="map-outline" title={t("noNearby")} />
          ) : (
            o.clusters.slice(0, 6).map((c) => (
              <PressScale key={c.id} onPress={() => setSelected(c)} style={styles.clusterRow} accessibilityRole="button">
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{c.name}</Text>
                  <Text style={styles.rowSub}>
                    {t(`sector_${c.sector}` as TranslationKey)} · {c.distance_km} km · {t("mixWorth", { v: currency(c.value_per_kg) })}
                  </Text>
                  <View style={styles.avatars}>
                    {c.materials.slice(0, 4).map((m) => <MaterialAvatar key={m.material} material={m.material} size={26} />)}
                  </View>
                </View>
                <View style={styles.scoreBox}>
                  <Text style={[styles.score, { color: heat(1 - c.opportunity_score / 100) }]}>{Math.round(c.opportunity_score)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.faint} />
                </View>
              </PressScale>
            ))
          )}

          {o.balance.some((b) => b.gap_kg > 0) ? (
            <>
              <SectionHeader title={t("shortages")} />
              <Card>
                {o.balance.filter((b) => b.gap_kg > 0).slice(0, 5).map((b) => (
                  <PressScale key={b.material} onPress={() => goTab("Collect", { prefillMaterial: b.material })} style={styles.shortRow}>
                    <MaterialAvatar material={b.material} size={34} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{materialName(b.material, language)}</Text>
                      <Text style={styles.rowSub}>{t("shortBy", { kg: Math.round(b.gap_kg) })}</Text>
                    </View>
                    {b.best_price_per_kg ? <Text style={styles.price}>{currency(b.best_price_per_kg)}{t("perKg")}</Text> : null}
                  </PressScale>
                ))}
              </Card>
            </>
          ) : null}

          <Text style={styles.note}>{t("approxData")}</Text>
        </>
      )}
    </Screen>
  );
}

function ClusterCard({ cluster, onClose }: { cluster: Cluster; onClose: () => void }) {
  const { t, language } = useTranslation();
  const top = cluster.materials[0];
  return (
    <Animated.View entering={enter(0)}>
      <Card tone="info" style={{ marginTop: space.md }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{cluster.name}</Text>
            <Text style={styles.rowSub}>{t(`sector_${cluster.sector}` as TranslationKey)} · {cluster.distance_km} km</Text>
          </View>
          <PressScale onPress={onClose} accessibilityLabel={t("close")}><Ionicons name="close" size={20} color={colors.muted} /></PressScale>
        </View>
        {cluster.materials.map((m) => (
          <View key={m.material} style={styles.mixRow}>
            <MaterialAvatar material={m.material} size={26} />
            <Text style={styles.mixName} numberOfLines={1}>{materialName(m.material, language)}</Text>
            <View style={styles.mixTrack}><View style={[styles.mixFill, { width: `${Math.round(m.share * 100)}%` }]} /></View>
            <Text style={styles.mixPct}>{Math.round(m.share * 100)}%</Text>
          </View>
        ))}
        {top ? (
          <Button label={`${t("startCollecting")} · ${materialName(top.material, language)}`} icon="camera" size="md"
            onPress={() => goTab("Collect", { prefillMaterial: top.material })} style={{ marginTop: space.md }} />
        ) : null}
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  mapWrap: { alignSelf: "center", marginTop: space.md, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.line },
  legend: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: space.sm },
  legendBar: { width: 18, height: 8, borderRadius: 3 },
  legendText: { fontSize: 11, color: colors.muted, marginRight: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  hint: { marginTop: space.md, fontSize: 12, color: colors.muted, textAlign: "center" },
  hotspot: { flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: space.sm },
  rank: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: P("#020705"), borderWidth: 1, borderColor: P("rgba(168,232,201,0.2)") },
  rankText: { color: P("#A8E8C9"), fontWeight: "700", fontSize: 12 },
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  rowTitle: { ...type.h3, color: colors.ink },
  rowSub: { marginTop: 2, fontSize: 12, color: colors.inkSoft },
  score: { fontSize: 20, fontWeight: "800" },
  scoreBox: { alignItems: "center", flexDirection: "row", gap: 4 },
  clusterRow: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, marginBottom: space.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  avatars: { flexDirection: "row", gap: 4, marginTop: space.sm },
  shortRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  price: { fontSize: 14, fontWeight: "800", color: colors.primary },
  mixRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.sm },
  mixName: { width: 120, fontSize: 12, fontWeight: "700", color: colors.ink },
  mixTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: P("rgba(248,250,247,0.1)"), overflow: "hidden" },
  mixFill: { height: "100%", backgroundColor: colors.info },
  mixPct: { width: 34, textAlign: "right", fontSize: 11, fontWeight: "700", color: colors.inkSoft },
  note: { marginTop: space.lg, fontSize: 11, color: colors.muted, textAlign: "center" },
});
