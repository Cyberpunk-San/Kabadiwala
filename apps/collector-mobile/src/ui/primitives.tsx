// src/ui/primitives.tsx — the shared design system (dark cinematic).
//
// Every screen sits on the cinematic backdrop. Surfaces are translucent glass lit
// from above (a lit top edge + faint sheen) with soft depth; icons sit on black
// discs; emerald is the action colour; glows are kept low.
// 8pt grid · glass 16 · controls 10–12 · chips 8.
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { createContext, useContext, useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  type PressableProps,
  type ScrollViewProps,
  type StyleProp,
  StyleSheet,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { cinematic as C, colors, dark as D, motion, radius, shadow, space, TAB_BAR_HEIGHT, type } from "../constants/theme";
import { BACKDROP_BG, CinematicBackdrop } from "./backdrop";
import { Text } from "./Text";

import { isLight } from "../constants/themeMode";
import { P } from "../constants/palette";
export type IconName = ComponentProps<typeof Ionicons>["name"];

/** Near-black used behind icons. */
export const ICON_DISC = P("#020705");

// ─── Haptics (no-op on web) ──────────────────────────────────────────────────
export function tap(style: "light" | "medium" | "success" | "warning" = "light") {
  if (Platform.OS === "web") return;
  try {
    if (style === "success") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (style === "warning") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else void Haptics.impactAsync(style === "medium" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Haptics unavailable on this device — ignore.
  }
}

/** Short staggered entrance: small upward move + fade, no bounce. */
export const enter = (index = 0) => FadeInDown.delay(Math.min(index, 6) * 40).duration(300);

/** Soft depth under floating surfaces. */
export const depth = Platform.select({
  web: { boxShadow: "0 16px 36px rgba(0,0,0,0.42), 0 2px 6px rgba(0,0,0,0.3)" },
  default: { shadowColor: P("#000"), shadowOpacity: 0.42, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
}) as ViewStyle;

/** Light falling on a surface from above: a lit top edge and a faint inner sheen. */
export function EdgeLight({ strength = 0.07 }: { strength?: number }) {
  return (
    <>
      <LinearGradient colors={[`rgba(248,250,247,${strength})`, P("rgba(248,250,247,0)")]} style={[styles.sheen, { pointerEvents: "none" }]} />
      <LinearGradient
        colors={[P("rgba(248,250,247,0)"), `rgba(248,250,247,${strength * 2.2})`, P("rgba(248,250,247,0)")]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.edge, { pointerEvents: "none" }]}
      />
    </>
  );
}

// ─── PressScale: spring press feedback ───────────────────────────────────────
type PressScaleProps = PressableProps & {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: boolean;
  children?: ReactNode;
};

/** Layout props belong on the Pressable (what the parent lays out); looks go on the animated face. */
const OUTER_KEYS = new Set([
  "flex", "flexGrow", "flexShrink", "flexBasis", "alignSelf", "width", "maxWidth", "minWidth",
  "margin", "marginTop", "marginBottom", "marginLeft", "marginRight", "marginHorizontal", "marginVertical",
  "position", "top", "left", "right", "bottom", "zIndex",
]);

function splitStyle(style: StyleProp<ViewStyle>) {
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [k, v] of Object.entries((StyleSheet.flatten(style) ?? {}) as Record<string, unknown>)) (OUTER_KEYS.has(k) ? outer : inner)[k] = v;
  if ("width" in outer || "flex" in outer || "flexGrow" in outer) inner.flexGrow = 1;
  return { outer: outer as ViewStyle, inner: inner as ViewStyle };
}

export function PressScale({ style, scaleTo = 0.97, haptic = true, onPressIn, onPressOut, onPress, children, ...rest }: PressScaleProps) {
  const p = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(p.value, [0, 1], [1, scaleTo]) }] }));
  const { outer, inner } = splitStyle(style);
  return (
    <Pressable
      {...rest}
      style={outer}
      onPressIn={(e) => {
        p.set(withTiming(1, { duration: 110 }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        p.set(withSpring(0, motion.spring));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) tap();
        onPress?.(e);
      }}
    >
      <Animated.View style={[inner, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

// ─── Screen + collapsing header ──────────────────────────────────────────────
type HeaderInfo = { title: string; onBack?: () => void } | null;
type ScreenCtx = { scrollY: SharedValue<number>; setHeader: (h: HeaderInfo) => void; dark: boolean };
const ScreenContext = createContext<ScreenCtx | null>(null);

/** Always true now — the whole app is dark. Kept so components can branch if a light screen returns. */
export function useDark() {
  return useContext(ScreenContext)?.dark ?? true;
}

/** Scroll offset of the enclosing Screen — for scroll-linked effects. */
export function useScreenScroll() {
  const ctx = useContext(ScreenContext);
  const fallback = useSharedValue(0);
  return ctx?.scrollY ?? fallback;
}

/** Distance over which the large title collapses into the compact bar. */
const COLLAPSE = 56;

type ScreenProps = ScrollViewProps & {
  children: ReactNode;
  /** Extra bottom room so content clears the tab bar. */
  withTabBar?: boolean;
  padded?: boolean;
  /** Kept for compatibility; every screen is dark. */
  dark?: boolean;
  /** Page colour override (also tints the collapsed header bar). */
  bgColor?: string;
  /** Replaces the default cinematic backdrop. */
  background?: ReactNode;
};

/** Default backdrop for content screens: the cinematic environment, dimmer than Home. */
function ScreenBackdrop() {
  const scrollY = useScreenScroll();
  return <CinematicBackdrop scrollY={scrollY} intensity={0.5} />;
}

export function Screen({ children, withTabBar = false, padded = true, dark = true, bgColor, background, contentContainerStyle, ...rest }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const [header, setHeader] = useState<HeaderInfo>(null);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const ctx = useMemo(() => ({ scrollY, setHeader, dark }), [scrollY, dark]);

  const bar = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [COLLAPSE - 24, COLLAPSE], [0, 1], Extrapolation.CLAMP) }));
  const barTitle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollY.value, [COLLAPSE - 24, COLLAPSE], [6, 0], Extrapolation.CLAMP) }],
  }));

  return (
    <ScreenContext.Provider value={ctx}>
      <View style={[styles.screen, bgColor ? { backgroundColor: bgColor } : null]}>
        <StatusBar style={isLight ? "dark" : "light"} />
        {background ?? <ScreenBackdrop />}
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            padded && { paddingHorizontal: space.lg },
            { paddingTop: insets.top + space.sm, paddingBottom: (withTabBar ? TAB_BAR_HEIGHT + space.xxl : space.xl) + insets.bottom },
            contentContainerStyle,
          ]}
          {...rest}
        >
          <Animated.View entering={FadeIn.duration(220)} style={styles.inner}>{children}</Animated.View>
        </Animated.ScrollView>

        {header ? (
          <Animated.View style={[[styles.compactBar, { paddingTop: insets.top, height: insets.top + 48 }, bar], { pointerEvents: "box-none" }]}>
            {header.onBack ? (
              <Pressable onPress={header.onBack} hitSlop={8} style={styles.compactBack} accessibilityLabel="Back" accessibilityRole="button">
                <Ionicons name="chevron-back" size={22} color={C.text} />
              </Pressable>
            ) : null}
            <Animated.View style={[[styles.compactTitleWrap, barTitle], { pointerEvents: "none" }]}>
              <Text style={styles.compactTitle} numberOfLines={1}>{header.title}</Text>
            </Animated.View>
          </Animated.View>
        ) : null}
      </View>
    </ScreenContext.Provider>
  );
}

/** Large page title that hands over to the compact bar as the page scrolls. */
function useLargeTitle(title: string, onBack?: () => void) {
  const ctx = useContext(ScreenContext);
  useEffect(() => {
    ctx?.setHeader({ title, onBack });
    return () => ctx?.setHeader(null);
    // onBack identity changes each render; the title is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, title]);
  const scrollY = useScreenScroll();
  return useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, COLLAPSE - 16], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [0, COLLAPSE], [0, -8], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-80, 0, COLLAPSE], [1.05, 1, 0.96], Extrapolation.CLAMP) },
    ],
  }));
}

/** Page title (collapses on scroll). */
export function InkTitle({ children, style, numberOfLines }: { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  const fade = useLargeTitle(typeof children === "string" ? children : "");
  return (
    <Animated.View style={[styles.titleOrigin, fade]}>
      <Text style={[styles.title, style]} numberOfLines={numberOfLines} accessibilityRole="header">
        {children}
      </Text>
    </Animated.View>
  );
}

export function TopBar({ title, kicker, onBack, right }: { title: string; kicker?: string; onBack?: () => void; right?: ReactNode }) {
  const fade = useLargeTitle(title, onBack);
  return (
    <View style={styles.topBar}>
      {onBack || right ? (
        <View style={styles.topRow}>
          {onBack ? (
            <PressScale onPress={onBack} style={styles.backBtn} accessibilityLabel="Back" accessibilityRole="button">
              <Ionicons name="chevron-back" size={20} color={C.text} />
            </PressScale>
          ) : <View />}
          {right}
        </View>
      ) : null}
      <Animated.View style={[styles.titleOrigin, fade]}>
        <Text style={styles.title} numberOfLines={2} accessibilityRole="header">{title}</Text>
        {kicker ? <Text style={[styles.caption, { marginTop: 4 }]}>{kicker}</Text> : null}
      </Animated.View>
    </View>
  );
}

// ─── Card: translucent glass lit from above ──────────────────────────────────
const TONE: Record<"surface" | "soft" | "warn" | "danger" | "info", { tint: string; border: string } | null> = {
  surface: null,
  soft: { tint: P("rgba(25,169,130,0.08)"), border: P("rgba(168,232,201,0.16)") },
  warn: { tint: P("rgba(229,184,106,0.07)"), border: P("rgba(229,184,106,0.18)") },
  danger: { tint: P("rgba(231,137,143,0.08)"), border: P("rgba(231,137,143,0.2)") },
  info: { tint: P("rgba(124,196,204,0.06)"), border: P("rgba(124,196,204,0.16)") },
};

export function Card({ children, style, tone = "surface" }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: keyof typeof TONE }) {
  const t = TONE[tone];
  return (
    <View style={[styles.card, t && { backgroundColor: t.tint, borderColor: t.border }, style]}>
      <EdgeLight />
      {children}
    </View>
  );
}

/** Primary feature panel: translucent emerald glass with internal light. */
export function GradientCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle>; colorsList?: readonly [string, string, ...string[]] }) {
  return (
    <View style={[styles.blockWrap, depth, style]}>
      <LinearGradient
        colors={[P("rgba(25,169,130,0.28)"), P("rgba(18,73,62,0.40)"), P("rgba(6,19,17,0.55)")]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.block}
      >
        <EdgeLight strength={0.1} />
        {children}
      </LinearGradient>
    </View>
  );
}

// ─── Button ──────────────────────────────────────────────────────────────────
type ButtonProps = {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "light";
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: "md" | "lg";
};

const BUTTON = {
  primary: { bg: C.emerald, fg: colors.onPrimary, border: P("rgba(168,232,201,0.35)") },
  light: { bg: C.mint, fg: colors.onPrimary, border: P("rgba(255,255,255,0.3)") },
  danger: { bg: P("rgba(231,137,143,0.14)"), fg: C.rose, border: P("rgba(231,137,143,0.32)") },
  secondary: { bg: P("rgba(248,250,247,0.06)"), fg: C.text, border: P("rgba(248,250,247,0.12)") },
  ghost: { bg: "transparent", fg: C.mint, border: "transparent" },
} as const;

export function Button({ label, onPress, icon, variant = "primary", loading, disabled, style, size = "lg" }: ButtonProps) {
  const inactive = disabled || loading;
  const c = BUTTON[variant];
  return (
    <PressScale
      onPress={inactive ? undefined : onPress}
      disabled={inactive}
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={[
        styles.btn,
        size === "md" && styles.btnMd,
        { backgroundColor: c.bg, borderColor: c.border },
        variant === "primary" && !inactive && shadow.glow,
        inactive && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === "md" ? 16 : 18} color={c.fg} /> : null}
          <Text style={[styles.btnText, size === "md" && styles.btnTextMd, { color: c.fg }]}>{label}</Text>
        </>
      )}
    </PressScale>
  );
}

// ─── Chip ────────────────────────────────────────────────────────────────────
export function Chip({ label, active, onPress, icon, tone = "primary" }: { label: string; active?: boolean; onPress?: () => void; icon?: IconName | string; tone?: "primary" | "danger" }) {
  const activeBg = tone === "danger" ? C.rose : C.mint;
  const isIcon = !!icon && /^[a-z-]+$/.test(icon);
  return (
    <PressScale onPress={onPress} style={[styles.chip, active && { backgroundColor: activeBg, borderColor: activeBg }]} accessibilityRole="button" accessibilityState={{ selected: !!active }}>
      {isIcon ? <Ionicons name={icon as IconName} size={15} color={active ? colors.onPrimary : C.textSoft} /> : null}
      <Text style={[styles.chipText, active && { color: colors.onPrimary, fontWeight: "600" }]} numberOfLines={1}>{label}</Text>
    </PressScale>
  );
}

// ─── Badge ───────────────────────────────────────────────────────────────────
export function Badge({ label, tone = "primary", icon }: { label: string; tone?: "primary" | "warn" | "danger" | "info" | "muted" | "light"; icon?: IconName }) {
  const map = {
    primary: [P("rgba(25,169,130,0.14)"), C.mint],
    warn: [P("rgba(229,184,106,0.14)"), C.amber],
    danger: [P("rgba(231,137,143,0.14)"), C.rose],
    info: [P("rgba(124,196,204,0.12)"), C.teal],
    muted: [P("rgba(248,250,247,0.07)"), C.textSoft],
    light: [P("rgba(248,250,247,0.12)"), C.text],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <Text style={[styles.badgeText, { color: fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ─── Section header ──────────────────────────────────────────────────────────
export function SectionHeader({ kicker, title, action, onAction }: { kicker?: string; title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.section}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {kicker ? <Text style={styles.caption}>{kicker}</Text> : null}
      </View>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8} style={styles.sectionAction} accessibilityRole="button">
          <Text style={styles.sectionActionText}>{action}</Text>
          <Ionicons name="chevron-forward" size={14} color={C.mint} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ─── List row ────────────────────────────────────────────────────────────────
export function ListRow({ icon, title, subtitle, value, right, onPress, last, danger }: {
  icon?: IconName; title: string; subtitle?: string; value?: string; right?: ReactNode; onPress?: () => void; last?: boolean; danger?: boolean;
}) {
  return (
    <PressScale onPress={onPress} haptic={!!onPress} scaleTo={0.99} disabled={!onPress} style={[styles.row, !last && styles.rowDivider]} accessibilityRole={onPress ? "button" : undefined}>
      {icon ? (
        <View style={[styles.rowIcon, danger && { borderColor: P("rgba(231,137,143,0.3)") }]}>
          <Ionicons name={icon} size={18} color={danger ? C.rose : C.mint} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, danger && { color: C.rose }]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
      {right ?? (onPress && !danger ? <Ionicons name="chevron-forward" size={16} color={C.textFaint} /> : null)}
    </PressScale>
  );
}

// ─── Icon tile: black disc with a thin accent edge ───────────────────────────
export function IconTile({ icon, fg = C.mint, size = 40 }: { icon?: IconName; emoji?: string; bg?: string; fg?: string; size?: number }) {
  return (
    <View style={[styles.iconTile, { width: size, height: size, borderRadius: size / 2 }]}>
      {icon ? <Ionicons name={icon} size={size * 0.48} color={fg} /> : null}
    </View>
  );
}

export function Stat({ label, value, hint, color = C.text }: { label: string; value: ReactNode; hint?: string; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.caption}>{label}</Text>
      {typeof value === "string" ? <Text style={[styles.statValue, { color }]}>{value}</Text> : value}
      {hint ? <Text style={styles.caption}>{hint}</Text> : null}
    </View>
  );
}

export const textStyles = StyleSheet.create({
  kicker: { ...type.kicker, color: C.textSoft },
  h1: { ...type.h1, color: C.text },
  h2: { ...type.h2, color: C.text },
  h3: { ...type.h3, color: C.text },
  body: { ...type.body, color: C.textSoft },
  small: { ...type.small, color: C.textSoft },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BACKDROP_BG },
  inner: { width: "100%", maxWidth: 640, alignSelf: "center" },

  compactBar: Platform.select({
    web: {
      position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "center",
      backgroundColor: P("rgba(3,9,7,0.82)"), borderBottomWidth: 1, borderBottomColor: P("rgba(248,250,247,0.06)"), backdropFilter: "blur(18px)",
    } as ViewStyle,
    default: {
      position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "center",
      backgroundColor: P("rgba(3,9,7,0.93)"), borderBottomWidth: 1, borderBottomColor: P("rgba(248,250,247,0.06)"),
    },
  }) as ViewStyle,
  compactBack: { position: "absolute", left: space.sm, bottom: 0, height: 48, width: 40, alignItems: "center", justifyContent: "center" },
  compactTitleWrap: { maxWidth: "70%" },
  compactTitle: { ...type.h3, color: C.text, textAlign: "center" },

  titleOrigin: { transformOrigin: "left center" } as ViewStyle,
  title: { ...type.hero, color: C.text },
  caption: { ...type.small, color: C.textSoft },
  topBar: { marginBottom: space.xl, gap: space.md },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 40 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: ICON_DISC, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border },

  sheen: { position: "absolute", top: 0, left: 0, right: 0, height: 56 },
  edge: { position: "absolute", top: 0, left: 12, right: 12, height: 1 },

  card: { backgroundColor: P("rgba(248,250,247,0.045)"), borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  blockWrap: { borderRadius: 20 },
  block: { borderRadius: 20, padding: space.xl, overflow: "hidden", borderWidth: 1, borderColor: P("rgba(168,232,201,0.14)") },

  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, minHeight: 50, paddingHorizontal: space.lg, borderRadius: 12, borderWidth: 1 },
  btnMd: { minHeight: 42, paddingHorizontal: space.md, borderRadius: 10 },
  btnText: { fontSize: 16, fontWeight: "600", letterSpacing: -0.1 },
  btnTextMd: { fontSize: 15 },

  chip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.sm, backgroundColor: P("rgba(248,250,247,0.05)"), borderWidth: 1, borderColor: C.border },
  chipText: { fontSize: 14, fontWeight: "500", color: C.text },

  badge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: "600" },

  section: { flexDirection: "row", alignItems: "center", marginTop: space.xxl, marginBottom: space.md },
  sectionTitle: { ...type.h2, color: C.text },
  sectionAction: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 32 },
  sectionActionText: { color: C.mint, fontSize: 14, fontWeight: "500" },

  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 56, paddingVertical: space.md },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: P("rgba(248,250,247,0.06)") },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: ICON_DISC, borderWidth: 1, borderColor: P("rgba(168,232,201,0.14)") },
  rowTitle: { fontSize: 16, lineHeight: 22, fontWeight: "500", color: C.text },
  rowSub: { ...type.small, color: C.textSoft, marginTop: 2 },
  rowValue: { fontSize: 14, maxWidth: 150, color: C.textSoft },

  iconTile: { alignItems: "center", justifyContent: "center", backgroundColor: ICON_DISC, borderWidth: 1, borderColor: P("rgba(168,232,201,0.14)") },

  statValue: { marginTop: 2, ...type.h2 },
});

// Re-exports for screens that elevate floating elements.
export { D, shadow };
