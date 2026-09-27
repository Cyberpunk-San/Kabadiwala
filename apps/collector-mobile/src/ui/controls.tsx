// src/ui/controls.tsx — segmented control, search field, quick action, line chart.
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";

import { colors, dark, dark as D, motion, radius, space } from "../constants/theme";
import { type IconName, PressScale, tap, useDark } from "./primitives";
import { Text } from "./Text";

import { P } from "../constants/palette";
// ─── Segmented control: one indicator slides between options ────────────────
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const isDark = useDark();
  const [w, setW] = useState(0);
  const seg = w / Math.max(1, options.length);
  const x = useSharedValue(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  useEffect(() => {
    if (seg) x.value = withSpring(index * seg, motion.spring);
  }, [index, seg, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width - 8)} style={styles.seg} accessibilityRole="tablist">
      {seg ? <Animated.View style={[styles.segPill, { width: seg }, pill]} /> : null}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => { tap(); onChange(o.value); }} style={styles.segItem} accessibilityRole="tab" accessibilityState={{ selected: on }}>
            <Text style={[styles.segText, { color: on ? P("#04120F") : P("rgba(248,250,247,0.62)") }, on && { fontWeight: "600" }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Search field ────────────────────────────────────────────────────────────
export function SearchField({ value, onChangeText, placeholder, autoFocus, right }: { value: string; onChangeText: (s: string) => void; placeholder: string; autoFocus?: boolean; right?: ReactNode }) {
  const isDark = useDark();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.search, focused && { borderColor: P("rgba(168,232,201,0.45)") }]}>
      <Ionicons name="search" size={18} color={P("rgba(248,250,247,0.62)")} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={P("rgba(248,250,247,0.38)")}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        returnKeyType="search"
        style={[styles.searchInput, { color: P("#F8FAF7") }]}
        accessibilityLabel={placeholder}
      />
      {value ? (
        <Pressable onPress={() => onChangeText("")} hitSlop={8} accessibilityLabel="Clear" accessibilityRole="button">
          <Ionicons name="close-circle" size={18} color={P("rgba(248,250,247,0.38)")} />
        </Pressable>
      ) : right}
    </View>
  );
}

// ─── Quick action (round icon + caption) ─────────────────────────────────────
export function QuickAction({ icon, label, onPress, tint = colors.primary, soft = colors.primarySoft }: { icon: IconName; label: string; onPress: () => void; tint?: string; soft?: string }) {
  return (
    <PressScale onPress={onPress} style={styles.quick} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[styles.quickIcon, { borderColor: `${tint}44` }]}>
        <Ionicons name={icon} size={22} color={tint} />
      </View>
      <Text style={styles.quickLabel} numberOfLines={2}>{label}</Text>
    </PressScale>
  );
}

// ─── Line chart: smooth curve that draws itself in ───────────────────────────
const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Catmull-Rom → cubic Bézier for a smooth line through every point. */
function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/**
 * `onScrub` makes the chart interactive: dragging a finger reports the nearest
 * point (and null on release) and draws a guide line there.
 */
export function LineChart({ values, height = 72, color = colors.primary, fill = true, onDark, onScrub }: {
  values: number[]; height?: number; color?: string; fill?: boolean; onDark?: boolean; onScrub?: (index: number | null) => void;
}) {
  const [width, setWidth] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const progress = useSharedValue(0);
  const key = values.join(",");
  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [key, width, progress]);

  const pad = 6;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => ({
    x: pad + (i / Math.max(1, values.length - 1)) * (width - pad * 2),
    y: pad + (1 - (v - min) / span) * (height - pad * 2),
  }));
  const line = width ? smoothPath(pts) : "";
  const area = width && fill ? `${line} L ${pts[pts.length - 1]!.x} ${height} L ${pts[0]!.x} ${height} Z` : "";
  const LENGTH = width * 1.6 + height; // generous upper bound of the path length
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: LENGTH * (1 - progress.value) }));
  const areaProps = useAnimatedProps(() => ({ opacity: progress.value }));
  const gid = `area${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const last = pts[pts.length - 1];
  const active = scrub !== null ? pts[scrub] : last;

  const pick = (x: number) => {
    if (!width || pts.length < 2) return;
    const i = Math.max(0, Math.min(pts.length - 1, Math.round(((x - pad) / (width - pad * 2)) * (pts.length - 1))));
    if (i !== scrub) {
      if (scrub !== null) tap();
      setScrub(i);
      onScrub?.(i);
    }
  };
  const release = () => {
    setScrub(null);
    onScrub?.(null);
  };
  const touch = onScrub
    ? {
        onStartShouldSetResponder: () => true,
        onMoveShouldSetResponder: () => true,
        onResponderTerminationRequest: () => false,
        onResponderGrant: (e: { nativeEvent: { locationX: number } }) => pick(e.nativeEvent.locationX),
        onResponderMove: (e: { nativeEvent: { locationX: number } }) => pick(e.nativeEvent.locationX),
        onResponderRelease: release,
        onResponderTerminate: release,
      }
    : {};

  return (
    <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="image" {...touch}>
      {width ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={onDark ? 0.28 : 0.18} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {area ? <AnimatedPath d={area} fill={`url(#${gid})`} animatedProps={areaProps} /> : null}
          <AnimatedPath d={line} stroke={color} strokeWidth={2.25} fill="none" strokeLinecap="round" strokeDasharray={LENGTH} animatedProps={lineProps} />
          {scrub !== null && active ? (
            <Line x1={active.x} y1={0} x2={active.x} y2={height} stroke={onDark ? P("rgba(255,255,255,0.35)") : colors.line} strokeWidth={1} strokeDasharray="3 3" />
          ) : null}
          {active ? <Circle cx={active.x} cy={active.y} r={scrub !== null ? 5 : 3.5} fill={color} stroke={P("#030907")} strokeWidth={scrub !== null ? 2 : 0} /> : null}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  seg: { flexDirection: "row", padding: 4, borderRadius: 12, backgroundColor: P("rgba(248,250,247,0.05)"), borderWidth: 1, borderColor: P("rgba(248,250,247,0.08)") },
  segPill: { position: "absolute", top: 4, bottom: 4, left: 4, borderRadius: 9, backgroundColor: P("#A8E8C9") },
  segItem: { flex: 1, minHeight: 36, alignItems: "center", justifyContent: "center", paddingHorizontal: space.sm },
  segText: { fontSize: 14, fontWeight: "500" },

  search: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 50, paddingHorizontal: space.md, borderRadius: 12, backgroundColor: P("rgba(248,250,247,0.05)"), borderWidth: 1, borderColor: P("rgba(248,250,247,0.1)") },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: space.sm, fontFamily: "Inter_400Regular" },

  quick: { flex: 1, alignItems: "center", gap: space.sm },
  quickIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: P("#020705"), borderWidth: 1 },
  quickLabel: { fontSize: 13, lineHeight: 17, fontWeight: "500", color: P("#F8FAF7"), textAlign: "center" },
});
