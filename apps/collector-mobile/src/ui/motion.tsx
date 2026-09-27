// src/ui/motion.tsx — reusable animations (count-ups, bars, pulses, shimmer, scan line).
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, type TextStyle, View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "./Text";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { colors, radius } from "../constants/theme";

import { P } from "../constants/palette";
// ─── Count-up number ─────────────────────────────────────────────────────────
export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString("en-IN"),
  style,
  duration = 900,
}: {
  value: number;
  format?: (n: number) => string;
  style?: StyleProp<TextStyle>;
  duration?: number;
}) {
  const [shown, setShown] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const start = Date.now();
    let frame: number;
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (value - from) * eased;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(step);
      else fromRef.current = value;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <Text style={style}>{format(shown)}</Text>;
}

// ─── Progress bar that fills on mount / change ───────────────────────────────
export function ProgressBar({
  progress,
  color = colors.primary,
  track = colors.surfaceAlt,
  height = 8,
  delay = 0,
}: {
  progress: number; // 0..1
  color?: string;
  track?: string;
  height?: number;
  delay?: number;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(Math.max(0, Math.min(1, progress)), { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [progress, delay, p]);
  const fill = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track, overflow: "hidden" }}>
      <Animated.View style={[{ height: "100%", borderRadius: height, backgroundColor: color }, fill]} />
    </View>
  );
}

// ─── Vertical bar that grows (charts) ────────────────────────────────────────
export function GrowBar({ ratio, color, delay = 0, style }: { ratio: number; color: string; delay?: number; style?: StyleProp<ViewStyle> }) {
  const h = useSharedValue(0);
  useEffect(() => {
    h.value = withDelay(delay, withSpring(Math.max(0.04, Math.min(1, ratio)), { damping: 14, stiffness: 90 }));
  }, [ratio, delay, h]);
  const anim = useAnimatedStyle(() => ({ height: `${h.value * 100}%` }));
  return <Animated.View style={[{ width: "100%", borderRadius: 8, backgroundColor: color }, style, anim]} />;
}

// ─── Pulsing live dot ────────────────────────────────────────────────────────
export function PulseDot({ color = colors.primaryGlow, size = 8 }: { color?: string; size?: number }) {
  const s = useSharedValue(0);
  useEffect(() => {
    s.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(s);
  }, [s]);
  const ring = useAnimatedStyle(() => ({
    opacity: interpolate(s.value, [0, 1], [0.6, 0]),
    transform: [{ scale: interpolate(s.value, [0, 1], [1, 2.8]) }],
  }));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: size, backgroundColor: color }, ring]} />
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}

// ─── Gentle float (idle hero illustrations) ──────────────────────────────────
export function Float({ children, distance = 6, duration = 2200 }: { children: React.ReactNode; distance?: number; duration?: number }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(withSequence(withTiming(-distance, { duration }), withTiming(0, { duration })), -1, false);
    return () => cancelAnimation(y);
  }, [y, distance, duration]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={anim}>{children}</Animated.View>;
}

// ─── Skeleton shimmer ────────────────────────────────────────────────────────
export function Skeleton({ height = 16, width = "100%", style }: { height?: number; width?: number | `${number}%`; style?: StyleProp<ViewStyle> }) {
  const o = useSharedValue(0.45);
  useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
    return () => cancelAnimation(o);
  }, [o]);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ height, width, borderRadius: 10, backgroundColor: P("rgba(248,250,247,0.07)") }, style, anim]} />;
}

export function SkeletonCard() {
  return (
    <View style={styles.skelCard}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <Skeleton height={44} width={44} style={{ borderRadius: 14 }} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton height={14} width="60%" />
          <Skeleton height={11} width="40%" />
        </View>
      </View>
      <Skeleton height={10} style={{ marginTop: 16 }} />
    </View>
  );
}

// ─── Typing dots (assistant is thinking) ─────────────────────────────────────
function Dot({ delay }: { delay: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 300 }), withTiming(0, { duration: 300 })), -1, false));
    return () => cancelAnimation(v);
  }, [v, delay]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: -4 * v.value }], opacity: 0.4 + 0.6 * v.value }));
  return <Animated.View style={[styles.dot, anim]} />;
}

export function TypingDots() {
  return (
    <View style={{ flexDirection: "row", gap: 5, paddingVertical: 4 }}>
      <Dot delay={0} />
      <Dot delay={150} />
      <Dot delay={300} />
    </View>
  );
}

// ─── Scanner overlay: sweeping laser line + corner brackets ──────────────────
export function ScanOverlay({ active }: { active: boolean }) {
  const y = useSharedValue(0);
  useEffect(() => {
    if (active) {
      y.value = 0;
      y.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }), -1, true);
    } else {
      cancelAnimation(y);
    }
    return () => cancelAnimation(y);
  }, [active, y]);
  const line = useAnimatedStyle(() => ({ top: `${4 + y.value * 88}%` }));

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
      {(["tl", "tr", "bl", "br"] as const).map((c) => (
        <View key={c} style={[styles.corner, styles[c]]} />
      ))}
      {active ? (
        <Animated.View style={[styles.scanLine, line]}>
          <LinearGradient
            colors={[P("rgba(111,179,158,0)"), P("rgba(111,179,158,0.95)"), P("rgba(111,179,158,0)")]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const C = 26;
const styles = StyleSheet.create({
  skelCard: { backgroundColor: P("rgba(248,250,247,0.045)"), borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: P("rgba(248,250,247,0.08)"), marginBottom: 12 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  scanLine: { position: "absolute", left: "6%", right: "6%", height: 3, borderRadius: 3 },
  corner: { position: "absolute", width: C, height: C, borderColor: colors.primaryGlow },
  tl: { top: 14, left: 14, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  tr: { top: 14, right: 14, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  bl: { bottom: 14, left: 14, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  br: { bottom: 14, right: 14, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
});
