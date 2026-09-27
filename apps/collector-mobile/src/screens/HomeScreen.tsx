// src/screens/HomeScreen.tsx — kabadiwala home: what I've collected, what to do next, what's selling.
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, Ellipse, Path, RadialGradient, Rect, Stop } from "react-native-svg";

import { cinematic as C, motion, space } from "../constants/theme";
import { useBazarPrices } from "../data/prices";
import { useNotifications } from "../features/notifications/useNotifications";
import { useScreenNarration } from "../hooks/useScreenNarration";
import { useCollectorLocation } from "../hooks/useCollectorLocation";
import { useTranslation } from "../hooks/useTranslation";
import type { TranslationKey } from "../i18n";
import { go, goTab } from "../navigation/ref";
import { listNearbyPickups } from "../services/api/client";
import { useAppStore } from "../store/appStore";
import { useAuthStore } from "../store/authStore";
import { materialName, type Lot } from "../types/domain";
import { LineChart } from "../ui/controls";
import { CinematicBackdrop, BACKDROP_BG } from "../ui/backdrop";
import { materialStyle } from "../ui/materials";
import { AnimatedNumber } from "../ui/motion";
import { enter, InkTitle, type IconName, Screen, tap, useScreenScroll } from "../ui/primitives";
import { Text } from "../ui/Text";
import { currency, relativeDate } from "../utils/format";

import { P } from "../constants/palette";
const WEEK_MS = 7 * 24 * 3600 * 1000;

/** "#RRGGBB" + alpha → rgba() */
const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export function HomeScreen() {
  const { t, language } = useTranslation();
  useScreenNarration("Home");
  const lots = useAppStore((s) => s.lots);
  const syncNow = useAppStore((s) => s.syncNow);
  const refreshLots = useAppStore((s) => s.refreshLots);
  const collector = useAuthStore((s) => s.collector);
  const refreshAuth = useAuthStore((s) => s.refresh);
  const collectorId = collector?.id;
  const { unreadCount } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);

  // Keep profile totals fresh whenever Home comes into view.
  // Lots too, so a pickup just completed shows up in the graph and total straight away.
  useFocusEffect(useCallback(() => {
    void refreshAuth();
    if (collectorId) void refreshLots(collectorId);
  }, [refreshAuth, refreshLots, collectorId]));

  const { lat, lon } = useCollectorLocation();
  const nearby = useQuery({
    queryKey: ["pickups-nearby", lat, lon],
    queryFn: () => listNearbyPickups(lat, lon),
    enabled: !!collector,
    refetchInterval: 30_000,
  });
  const pickupCount = nearby.data?.length ?? 0;

  // Weekly kg for the last 8 weeks (oldest → newest) and the 30-day change.
  const { weekly, change, unsoldKg, unsoldLots } = useMemo(() => {
    const now = Date.now();
    const weeks = Array.from({ length: 8 }, () => 0);
    let recent = 0, previous = 0, unsold = 0, unsoldCount = 0;
    for (const l of lots) {
      // Lifetime totals from the server grow only when a lot is paid; add what's collected but unsold.
      if (l.status !== "PAID") { unsold += l.weightKg; unsoldCount += 1; }
      const age = now - new Date(l.createdAt).getTime();
      const w = Math.floor(age / WEEK_MS);
      if (w >= 0 && w < 8) weeks[7 - w]! += l.weightKg;
      if (age < 30 * 86400000) recent += l.weightKg;
      else if (age < 60 * 86400000) previous += l.weightKg;
    }
    return { weekly: weeks, change: previous > 0 ? Math.round(((recent - previous) / previous) * 100) : null, unsoldKg: Math.round(unsold * 10) / 10, unsoldLots: unsoldCount };
  }, [lots]);

  const livePrices = useBazarPrices();
  const trending = useMemo(() => [...livePrices].sort((a, b) => b.changePercent - a.changePercent).slice(0, 6), [livePrices]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshAuth(), syncNow(collector?.id), nearby.refetch()]);
    if (collector) await refreshLots(collector.id);
    setRefreshing(false);
  };

  if (!collector) return null;
  const firstName = collector.name.split(" ")[0] ?? collector.name;

  return (
    <Screen
      withTabBar
      dark
      bgColor={BACKDROP_BG}
      background={<HomeBackdrop />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.mint} />}
    >
      {/* Rendered inside <Screen> so the scroll-linked effects can read its scroll position. */}
      <HomeBody
        t={t}
        language={language}
        location={collector.operating_area ?? "Pune"}
        firstName={firstName}
        unreadCount={unreadCount}
        totalKg={collector.total_weight_kg + unsoldKg}
        unsoldKg={unsoldKg}
        totalEarnings={collector.total_earnings}
        totalLots={collector.total_lots + unsoldLots}
        change={change}
        weekly={weekly}
        trending={trending}
        pickupCount={pickupCount}
        lots={lots}
      />
    </Screen>
  );
}

/** 5 → "5", 2.5 → "2.5", 1431 → "1,431". */
const kgLabel = (n: number) => (Math.round(n * 10) / 10).toLocaleString("en-IN");

type Body = {
  t: ReturnType<typeof useTranslation>["t"];
  language: ReturnType<typeof useTranslation>["language"];
  location: string;
  firstName: string;
  unreadCount: number;
  totalKg: number;
  unsoldKg: number;
  totalEarnings: number;
  totalLots: number;
  change: number | null;
  weekly: number[];
  trending: ReturnType<typeof useBazarPrices>;
  pickupCount: number;
  lots: Lot[];
};

function HomeBody({ t, language, location, firstName, unreadCount, totalKg, unsoldKg, totalEarnings, totalLots, change, weekly, trending, pickupCount, lots }: Body) {
  const [week, setWeek] = useState<number | null>(null);
  const scrollY = useScreenScroll();
  const reduce = useReducedMotion();

  // Header eases away as the page scrolls (size, opacity and position together).
  const header = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 90], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [0, 90], [0, -14], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-60, 0, 90], [1.04, 1, 0.94], Extrapolation.CLAMP) },
    ],
  }));
  // The hero drifts a little slower than the page.
  const heroParallax = useAnimatedStyle(() => ({
    transform: [{ translateY: reduce ? 0 : interpolate(scrollY.value, [0, 260], [0, 28], Extrapolation.CLAMP) }],
  }));

  return (
    <>
      {/* Location + actions */}
      <View style={styles.topRow}>
        <Pressable onPress={() => go("Regional")} style={styles.location} accessibilityRole="button" accessibilityLabel={location}>
          <Ionicons name="location-outline" size={16} color={C.mint} />
          <Text style={styles.locationText} numberOfLines={1}>{location}</Text>
          <Ionicons name="chevron-down" size={14} color={C.textSoft} />
        </Pressable>
        <View style={styles.iconBtns}>
          <IconButton icon="search-outline" label={t("search")} onPress={() => go("Search")} />
          <IconButton icon="notifications-outline" label={t("notifications")} onPress={() => go("Notifications")} badge={unreadCount > 0} />
        </View>
      </View>

      <Animated.View style={[styles.header, header]}>
        <View pointerEvents="none" style={styles.headerLight}><Glow color={C.emerald} opacity={0.07} /></View>
        <InkTitle style={styles.title}>{t("hiName", { name: firstName })}</InkTitle>
        <Text style={styles.subtitle}>{t("homeSubtitle")}</Text>
      </Animated.View>

      {/* Hero: total collected */}
      <Animated.View entering={enter(0)} style={heroParallax}>
        <GlowPress onPress={() => goTab("Earnings")} glow={C.emerald} glowBase={0.22} glowSize={1.4} breathe style={[styles.heroWrap, styles.depth]} label={t("totalCollected")}>
          <LinearGradient
            colors={[P("rgba(25,169,130,0.30)"), P("rgba(18,73,62,0.42)"), P("rgba(6,19,17,0.55)")]}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View pointerEvents="none" style={styles.heroLightA}><Glow color={C.emerald} opacity={0.24} /></View>
            <View pointerEvents="none" style={styles.heroLightB}><Glow color={C.teal} opacity={0.08} /></View>
            <ContourTexture />
            <EdgeLight strength={0.10} />
            <View style={styles.heroHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroLabel}>{t("totalCollected")}</Text>
                <AnimatedNumber value={totalKg} format={(n) => `${Math.round(n).toLocaleString("en-IN")} ${t("kg")}`} style={styles.heroValue} />
                {change !== null ? (
                  <View style={styles.deltaRow}>
                    <Ionicons name={change >= 0 ? "trending-up" : "trending-down"} size={14} color={change >= 0 ? C.mint : C.rose} />
                    <Text style={[styles.heroDelta, { color: change >= 0 ? C.mint : C.rose }]}>{change >= 0 ? "+" : ""}{t("vsLastMonth", { n: change })}</Text>
                  </View>
                ) : (
                  <Text style={styles.heroDelta}>{currency(totalEarnings)} · {totalLots} {t("lotsCount")}</Text>
                )}
                {unsoldKg > 0 ? <Text style={styles.heroUnsold}>{t("unsoldKg", { n: kgLabel(unsoldKg) })}</Text> : null}
              </View>
              <View style={styles.heroChevron}>
                <Ionicons name="chevron-forward" size={16} color={C.text} />
              </View>
            </View>
            <View style={{ marginTop: space.md }}>
              <LineChart values={weekly} height={72} color={C.mint} onDark onScrub={setWeek} />
            </View>
            <View style={styles.heroFootRow}>
              <Text style={styles.heroFoot}>{t("last8Weeks")}</Text>
              <Text style={styles.heroWeek}>
                {week === null || week === weekly.length - 1
                  ? t("thisWeekKg", { n: kgLabel(weekly[weekly.length - 1] ?? 0) })
                  : t("weeksAgoKg", { w: weekly.length - 1 - week, n: kgLabel(weekly[week] ?? 0) })}
              </Text>
            </View>
          </LinearGradient>
        </GlowPress>
      </Animated.View>

      {/* Quick actions */}
      <View style={styles.quickRow}>
        <QuickTile index={1} icon="camera-outline" label={t("qaSell")} accent={C.emerald} onPress={() => goTab("Collect")} />
        <QuickTile index={2} icon="people-outline" label={t("qaBuyers")} accent={C.lavender} onPress={() => go("Demands")} />
        <QuickTile index={3} icon="pricetags-outline" label={t("qaRates")} accent={C.teal} onPress={() => go("BazarBhav")} />
        <QuickTile index={4} icon="bicycle-outline" label={t("qaPickups")} accent={C.amber} onPress={() => go("Pickups")} />
      </View>

      {/* Trending materials */}
      <SectionTitle title={t("trending")} action={t("seeAll")} onAction={() => go("BazarBhav")} />
      <Animated.View entering={enter(5)}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendRow} style={styles.trendScroll}>
          {trending.map((p) => {
            const up = p.changePercent >= 0;
            return (
              <GlowPress key={p.id} onPress={() => go("MaterialDetail", { material: p.material })} glow={up ? C.emerald : C.rose} glowBase={0.03} glowSize={1.1} style={[styles.trendWrap, styles.depth]} label={materialName(p.material, language)}>
                <LinearGradient colors={[P("rgba(248,250,247,0.07)"), P("rgba(248,250,247,0.025)")]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.trendCard}>
                  <View style={styles.trendWell}>
                    <View pointerEvents="none" style={styles.trendLight}><Glow color={up ? C.emerald : C.teal} opacity={0.12} /></View>
                    <View style={styles.trendDisc}><MaterialCommunityIcons name={materialStyle(p.material).icon} size={26} color={C.mint} style={styles.trendGlyph} /></View>
                  </View>
                  <EdgeLight strength={0.08} />
                  <View style={styles.trendBody}>
                  <Text style={styles.trendName} numberOfLines={1}>{materialName(p.material, language)}</Text>
                  <Text style={styles.trendPrice}>{currency(p.currentPrice)}<Text style={styles.trendUnit}>{t("perKg")}</Text></Text>
                  <View style={[styles.trendDelta, { backgroundColor: rgba(up ? C.emerald : C.rose, 0.14) }]}>
                    <Ionicons name={up ? "arrow-up" : "arrow-down"} size={11} color={up ? C.mint : C.rose} />
                    <Text style={[styles.trendDeltaText, { color: up ? C.mint : C.rose }]}>{Math.abs(p.changePercent).toFixed(1)}%</Text>
                  </View>
                  </View>
                </LinearGradient>
              </GlowPress>
            );
          })}
        </ScrollView>
      </Animated.View>

      {/* Pickups waiting (attention → amber) */}
      {pickupCount > 0 ? (
        <Animated.View entering={enter(6)}>
          <GlowPress onPress={() => go("Pickups")} glow={C.amber} glowBase={0.03} glowSize={1.1} style={[styles.bannerWrap, styles.depth]} label={t("pickupsWaiting", { n: pickupCount })}>
            <LinearGradient colors={[P("rgba(229,184,106,0.07)"), P("rgba(248,250,247,0.03)")]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.banner}>
              <EdgeLight strength={0.07} />
              <IconOrb icon="bicycle-outline" accent={C.amber} />
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitle}>{t("pickupsWaiting", { n: pickupCount })}</Text>
                <Text style={styles.bannerSub}>{t("pickupsWaitingMsg")}</Text>
              </View>
              <View style={styles.bannerGo}><Ionicons name="arrow-forward" size={18} color={C.amber} /></View>
            </LinearGradient>
          </GlowPress>
        </Animated.View>
      ) : null}

      {/* Lots */}
      <SectionTitle title={t("myLots")} action={lots.length > 3 ? t("seeAll") : undefined} onAction={() => goTab("Earnings")} />
      {lots.length ? (
        <Animated.View entering={enter(7)} style={[styles.lotGroup, styles.depth]}>
          <EdgeLight strength={0.06} />
          {lots.slice(0, 3).map((lot, i, all) => (
            <LotLine key={lot.id} lot={lot} last={i === all.length - 1} t={t} language={language} onPress={() => go("Handover", { lotId: lot.id })} />
          ))}
        </Animated.View>
      ) : (
        <Animated.View entering={enter(7)} style={styles.empty}>
          <IconOrb icon="cube-outline" accent={C.lavender} />
          <Text style={styles.emptyTitle}>{t("noLots")}</Text>
          <Text style={styles.emptyMsg}>{t("noLotsMsg")}</Text>
          <GlowPress onPress={() => goTab("Collect")} glow={C.emerald} glowBase={0.06} glowSize={1.2} style={styles.emptyBtnWrap} label={t("qaSell")}>
            <View style={styles.emptyBtn}><Text style={styles.emptyBtnText}>{t("qaSell")}</Text></View>
          </GlowPress>
        </Animated.View>
      )}
    </>
  );
}

// ─── Atmosphere ──────────────────────────────────────────────────────────────
/** Shared cinematic environment, with parallax from this screen's scroll. */
function HomeBackdrop() {
  const scrollY = useScreenScroll();
  return <CinematicBackdrop scrollY={scrollY} intensity={0.75} />;
}

/** Faint topographic contours — organic texture inside the hero. */
function ContourTexture() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 340 220" preserveAspectRatio="xMidYMid slice">
        {[0, 1, 2, 3, 4].map((i) => (
          <Path
            key={i}
            d={`M ${-20} ${150 - i * 22} C 60 ${110 - i * 26}, 120 ${190 - i * 20}, 200 ${140 - i * 24} S 330 ${80 - i * 18}, 380 ${120 - i * 22}`}
            stroke={C.mint}
            strokeOpacity={0.07 - i * 0.008}
            strokeWidth={1}
            fill="none"
          />
        ))}
      </Svg>
    </View>
  );
}

/** Soft reflected light behind an element (never an outline). */
function Glow({ color, opacity = 0.3 }: { color: string; opacity?: number }) {
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <Svg width="100%" height="100%">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/** Light falling on a surface from above: a lit top edge and a faint inner sheen. */
function EdgeLight({ strength = 0.08 }: { strength?: number }) {
  return (
    <>
      <LinearGradient pointerEvents="none" colors={[`rgba(248,250,247,${strength})`, P("rgba(248,250,247,0)")]} style={styles.sheen} />
      <LinearGradient
        pointerEvents="none"
        colors={[P("rgba(248,250,247,0)"), `rgba(248,250,247,${strength * 2.2})`, P("rgba(248,250,247,0)")]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.edge}
      />
    </>
  );
}

// ─── Interaction ─────────────────────────────────────────────────────────────
/** Press: scale 1 → 0.96 while the ambient glow brightens; springs back on release. */
function GlowPress({ children, onPress, glow, glowBase, glowSize, style, label, breathe }: {
  children: ReactNode; onPress: () => void; glow: string; glowBase: number; glowSize: number; style?: StyleProp<ViewStyle>; label: string; breathe?: boolean;
}) {
  const p = useSharedValue(0);
  const b = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!breathe || reduce) return;
    b.value = withRepeat(withSequence(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.sin) })), -1, false);
  }, [b, breathe, reduce]);
  const face = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(p.value, [0, 1], [1, 0.96]) }] }));
  const halo = useAnimatedStyle(() => ({
    opacity: Math.min(1, glowBase * (0.8 + 0.2 * b.value) + p.value * 0.14),
    transform: [{ scale: 1 + 0.04 * b.value }],
  }));
  const inset = `${-((glowSize - 1) / 2) * 100}%` as const;
  return (
    <Pressable
      onPress={() => { tap(); onPress(); }}
      onPressIn={() => { p.value = withTiming(1, { duration: 110 }); }}
      onPressOut={() => { p.value = withSpring(0, motion.spring); }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={style}
    >
      <Animated.View pointerEvents="none" style={[{ position: "absolute", top: inset, bottom: inset, left: inset, right: inset }, halo]}>
        <Glow color={glow} opacity={0.55} />
      </Animated.View>
      <Animated.View style={face}>{children}</Animated.View>
    </Pressable>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────
function IconButton({ icon, label, onPress, badge }: { icon: IconName; label: string; onPress: () => void; badge?: boolean }) {
  return (
    <GlowPress onPress={onPress} glow={C.mint} glowBase={0} glowSize={1.3} label={label}>
      <View style={styles.iconBtn}>
        <Ionicons name={icon} size={20} color={C.text} />
        {badge ? <View style={styles.badgeDot} /> : null}
      </View>
    </GlowPress>
  );
}

function IconOrb({ icon, accent }: { icon: IconName; accent: string }) {
  return (
    <View style={styles.orb}>
      <View style={styles.orbGlow} pointerEvents="none"><Glow color={accent} opacity={0.14} /></View>
      <View style={[styles.orbCore, { backgroundColor: P("#020705"), borderColor: rgba(accent, 0.22) }]}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
    </View>
  );
}

function QuickTile({ index, icon, label, accent, onPress }: { index: number; icon: IconName; label: string; accent: string; onPress: () => void }) {
  return (
    <Animated.View entering={enter(index)} style={{ flex: 1 }}>
      <GlowPress onPress={onPress} glow={accent} glowBase={0.02} glowSize={1.2} style={styles.depth} label={label}>
        <LinearGradient colors={[P("rgba(248,250,247,0.06)"), P("rgba(248,250,247,0.02)")]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.tile}>
          <LinearGradient pointerEvents="none" colors={[rgba(accent, 0), rgba(accent, 0.3), rgba(accent, 0)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tileEdge} />
          <IconOrb icon={icon} accent={accent} />
          <Text style={styles.tileLabel} numberOfLines={2}>{label}</Text>
        </LinearGradient>
      </GlowPress>
    </Animated.View>
  );
}

function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button" style={styles.sectionAction}>
          <Text style={styles.sectionActionText}>{action}</Text>
          <Ionicons name="chevron-forward" size={14} color={C.mint} />
        </Pressable>
      ) : null}
    </View>
  );
}

const STATUS_TONE: Partial<Record<Lot["status"], string>> = { PAID: C.emerald, SOLD: C.emerald, PICKUP_SCHEDULED: C.teal, AGGREGATED: C.lavender };

function LotLine({ lot, last, onPress, t, language }: { lot: Lot; last: boolean; onPress: () => void; t: Body["t"]; language: Body["language"] }) {
  const pending = lot.syncState === "PENDING";
  const tone = pending ? C.amber : STATUS_TONE[lot.status] ?? C.textSoft;
  const p = useSharedValue(0);
  const face = useAnimatedStyle(() => ({ backgroundColor: `rgba(248,250,247,${0.05 * p.value})`, transform: [{ scale: interpolate(p.value, [0, 1], [1, 0.985]) }] }));
  return (
    <Pressable
      onPress={() => { tap(); onPress(); }}
      onPressIn={() => { p.value = withTiming(1, { duration: 110 }); }}
      onPressOut={() => { p.value = withSpring(0, motion.spring); }}
      accessibilityRole="button"
    >
      <Animated.View style={[styles.lot, !last && styles.lotDivider, face]}>
        <View style={styles.lotIcon}>
          <MaterialCommunityIcons name={materialStyle(lot.material).icon} size={20} color={C.mint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.lotTitle} numberOfLines={1}>{materialName(lot.material, language)}</Text>
          <Text style={styles.lotSub} numberOfLines={1}>{lot.weightKg} {t("kg")} · {relativeDate(lot.createdAt, language)}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Text style={styles.lotValue}>{lot.expectedNetEarnings ? currency(lot.expectedNetEarnings) : "—"}</Text>
          <View style={[styles.status, { backgroundColor: rgba(tone.startsWith("#") ? tone : C.text, 0.14) }]}>
            <Text style={[styles.statusText, { color: tone }]}>{pending ? t("pendingSync") : t(`status${lot.status}` as TranslationKey)}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  organic: { position: "absolute" },

  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.xl },
  location: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, flexShrink: 1 },
  locationText: { fontSize: 14, fontWeight: "500", color: C.text, flexShrink: 1 },
  iconBtns: { flexDirection: "row", gap: space.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: P("#020705"), borderWidth: 1, borderColor: C.border },
  badgeDot: { position: "absolute", top: 9, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: C.amber, borderWidth: 1.5, borderColor: C.bg },

  header: { marginBottom: space.xl, transformOrigin: "left center" } as ViewStyle,
  headerLight: { position: "absolute", left: -80, top: -70, width: 320, height: 200 },
  depth: Platform.select({
    web: { boxShadow: "0 18px 40px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.35)" },
    default: { shadowColor: P("#000"), shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
  }) as ViewStyle,
  sheen: { position: "absolute", top: 0, left: 0, right: 0, height: "45%" },
  edge: { position: "absolute", top: 0, left: 12, right: 12, height: 1 },
  title: { fontSize: 32, lineHeight: 38, letterSpacing: -0.8, color: C.text },
  subtitle: { fontSize: 16, lineHeight: 24, color: C.textSoft, marginTop: space.xs },

  heroWrap: { borderRadius: 20 },
  hero: { borderRadius: 20, padding: space.xl, overflow: "hidden", borderWidth: 1, borderColor: P("rgba(168,232,201,0.14)") },
  heroLightA: { position: "absolute", top: -120, left: -90, width: 320, height: 280 },
  heroLightB: { position: "absolute", bottom: -110, right: -80, width: 280, height: 240 },
  heroHead: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  heroLabel: { fontSize: 13, fontWeight: "500", color: C.textSoft, letterSpacing: 0.1 },
  heroValue: { fontSize: 40, lineHeight: 46, fontWeight: "700", letterSpacing: -1.2, color: C.text, marginTop: space.xs },
  deltaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: space.xs },
  heroDelta: { fontSize: 13, fontWeight: "500", color: C.textSoft },
  heroChevron: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: P("rgba(248,250,247,0.08)"), borderWidth: 1, borderColor: C.border },
  heroFoot: { fontSize: 12, color: C.textFaint },
  heroFootRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.sm },
  heroWeek: { fontSize: 13, fontWeight: "600", color: C.mint },
  heroUnsold: { marginTop: 4, fontSize: 12, color: C.textSoft },

  quickRow: { flexDirection: "row", gap: space.sm, marginTop: space.xl },
  tile: { alignItems: "center", gap: space.sm, paddingTop: space.md, paddingBottom: space.md, paddingHorizontal: space.xs, borderRadius: 16, borderWidth: 1, borderColor: P("rgba(248,250,247,0.07)"), minHeight: 104, overflow: "hidden" },
  tileEdge: { position: "absolute", top: 0, left: 10, right: 10, height: 1 },
  tileLabel: { fontSize: 12, lineHeight: 16, fontWeight: "500", color: C.text, textAlign: "center" },
  orb: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  orbGlow: { position: "absolute", top: -14, left: -14, right: -14, bottom: -14 },
  orbCore: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },

  section: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.xxl, marginBottom: space.md },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: "600", letterSpacing: -0.4, color: C.text },
  sectionAction: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 32 },
  sectionActionText: { fontSize: 14, fontWeight: "500", color: C.mint },

  trendScroll: { marginHorizontal: -space.lg },
  trendRow: { gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.xs },
  trendWrap: { width: 152, borderRadius: 16 },
  trendCard: { borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  trendWell: { height: 84, alignItems: "center", justifyContent: "center" },
  trendGlyph: { opacity: 0.9 },
  trendDisc: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: P("#020705"), borderWidth: 1, borderColor: P("rgba(168,232,201,0.16)") },
  trendLight: { position: "absolute", top: -30, left: -10, right: -10, height: 150 },
  trendBody: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: 2 },
  trendName: { fontSize: 14, fontWeight: "500", color: C.textSoft },
  trendPrice: { fontSize: 20, lineHeight: 26, fontWeight: "700", letterSpacing: -0.4, color: C.text, marginTop: 2 },
  trendUnit: { fontSize: 13, fontWeight: "400", color: C.textFaint, letterSpacing: 0 },
  trendDelta: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", marginTop: space.sm, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  trendDeltaText: { fontSize: 12, fontWeight: "600" },

  bannerWrap: { marginTop: space.xl, borderRadius: 16 },
  banner: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  bannerTitle: { fontSize: 16, fontWeight: "600", color: C.text },
  bannerSub: { fontSize: 13, lineHeight: 18, color: C.textSoft, marginTop: 2 },
  bannerGo: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: P("rgba(229,184,106,0.10)"), borderWidth: 1, borderColor: P("rgba(229,184,106,0.22)") },

  lotGroup: { borderRadius: 16, backgroundColor: P("rgba(248,250,247,0.04)"), borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  lot: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg },
  lotDivider: { borderBottomWidth: 1, borderBottomColor: C.border },
  lotIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: P("#020705"), borderWidth: 1, borderColor: P("rgba(168,232,201,0.14)") },
  lotTitle: { fontSize: 15, fontWeight: "600", color: C.text },
  lotSub: { fontSize: 13, color: C.textSoft, marginTop: 2 },
  lotValue: { fontSize: 15, fontWeight: "600", color: C.text },
  status: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: "600" },

  empty: { alignItems: "center", paddingVertical: space.xl, paddingHorizontal: space.lg, borderRadius: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: C.text, marginTop: space.md },
  emptyMsg: { fontSize: 14, lineHeight: 20, color: C.textSoft, textAlign: "center", marginTop: space.xs, maxWidth: 280 },
  emptyBtnWrap: { marginTop: space.lg },
  emptyBtn: { minHeight: 44, paddingHorizontal: space.xl, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: C.emerald },
  emptyBtnText: { fontSize: 15, fontWeight: "600", color: C.bg },
});

