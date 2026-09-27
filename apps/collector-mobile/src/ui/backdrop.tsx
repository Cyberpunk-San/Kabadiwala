// src/ui/backdrop.tsx — cinematic organic-tech environment: translucent glass forms
// drifting through near-black green, lit by faint emerald / teal / blue / violet / pink
// reflections. Shared by the splash screen and Home.
import { useEffect, useId } from "react";
import { StyleSheet, View } from "react-native";
import { useAppSize } from "./frame";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

import { P } from "../constants/palette";
/** Reflection colours — used only as faint light, never as fills. */
export const REFLECT = {
  emerald: P("#19A982"),
  teal: P("#5CC8C8"),
  blue: P("#6F8DFF"),
  violet: P("#A48BFA"),
  pink: P("#F08DB8"),
} as const;

export const BACKDROP_BG = P("#030907");

const useUid = () => `b${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

/** Organic outlines in a 200×200 box. */
const SHAPES = [
  "M110,18 C160,24 186,70 178,112 C170,158 128,186 86,178 C42,170 16,128 24,86 C32,44 64,12 110,18 Z",
  "M44,76 C40,44 74,26 112,32 C152,38 178,66 172,102 C166,142 130,164 90,158 C52,152 48,108 44,76 Z",
  "M100,28 C138,26 170,52 174,92 C178,136 150,172 104,174 C62,176 28,150 26,108 C24,66 60,30 100,28 Z",
];

/**
 * One glass form: a rim-lit lens fill (clear centre, brighter edge), an
 * iridescent hairline edge through the reflection colours, a soft specular
 * highlight up-left and a coloured reflection pooled inside the lower rim.
 */
function GlassForm({ d, from, to }: { d: string; from: string; to: string }) {
  const lens = useUid();
  const edge = useUid();
  const spec = useUid();
  const pool = useUid();
  return (
    <Svg width="100%" height="100%" viewBox="0 0 200 200">
      <Defs>
        <RadialGradient id={lens} cx="45%" cy="42%" r="62%">
          <Stop offset="0" stopColor={P("#FFFFFF")} stopOpacity={0} />
          <Stop offset="0.7" stopColor={P("#FFFFFF")} stopOpacity={0.025} />
          <Stop offset="0.93" stopColor={from} stopOpacity={0.09} />
          <Stop offset="1" stopColor={P("#FFFFFF")} stopOpacity={0.14} />
        </RadialGradient>
        <LinearGradient id={edge} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={REFLECT.teal} stopOpacity={0.55} />
          <Stop offset="0.3" stopColor={REFLECT.emerald} stopOpacity={0.35} />
          <Stop offset="0.55" stopColor={REFLECT.blue} stopOpacity={0.4} />
          <Stop offset="0.8" stopColor={REFLECT.violet} stopOpacity={0.45} />
          <Stop offset="1" stopColor={REFLECT.pink} stopOpacity={0.4} />
        </LinearGradient>
        <RadialGradient id={spec} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={P("#FFFFFF")} stopOpacity={0.16} />
          <Stop offset="1" stopColor={P("#FFFFFF")} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={pool} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={to} stopOpacity={0.22} />
          <Stop offset="1" stopColor={to} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Path d={d} fill={`url(#${lens})`} />
      <Ellipse cx={128} cy={146} rx={46} ry={20} fill={`url(#${pool})`} />
      <Ellipse cx={74} cy={58} rx={34} ry={16} fill={`url(#${spec})`} transform="rotate(-24 74 58)" />
      <Path d={d} fill="none" stroke={`url(#${edge})`} strokeWidth={1.1} />
      <Path d="M58,44 C76,30 102,24 126,30" stroke={P("#FFFFFF")} strokeOpacity={0.22} strokeWidth={1.4} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/** Soft pool of reflected light. */
function Light({ color, opacity }: { color: string; opacity: number }) {
  const id = useUid();
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

/** Slow independent drift (translate + rotate), stagger-started. */
function useDrift(duration: number, delay: number, dx: number, dy: number, rot: number, reduce: boolean) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    t.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration, easing: Easing.inOut(Easing.sin) })), -1, false)
    );
  }, [t, duration, delay, reduce]);
  return useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t.value, [0, 1], [-dx, dx]) },
      { translateY: interpolate(t.value, [0, 1], [dy, -dy]) },
      { rotate: `${interpolate(t.value, [0, 1], [-rot, rot])}deg` },
    ],
  }));
}

/**
 * Full-bleed environment. `scrollY` (optional) adds gentle parallax: forms drift
 * up slower than the page. `intensity` scales every light (1 = splash, lower for content screens).
 */
export function CinematicBackdrop({ scrollY, intensity = 1 }: { scrollY?: SharedValue<number>; intensity?: number }) {
  const { width: w, height: h } = useAppSize();
  const reduce = useReducedMotion();
  const fallback = useSharedValue(0);
  const sy = scrollY ?? fallback;

  const a = useDrift(22000, 0, 14, 18, 4, reduce);
  const b = useDrift(26000, 1800, 18, 12, -5, reduce);
  const c = useDrift(19000, 900, 10, 16, 6, reduce);
  const d = useDrift(30000, 2600, 22, 10, -3, reduce);

  const far = useAnimatedStyle(() => ({ transform: [{ translateY: reduce ? 0 : interpolate(sy.value, [0, 800], [0, -60], Extrapolation.CLAMP) }] }));
  const near = useAnimatedStyle(() => ({ transform: [{ translateY: reduce ? 0 : interpolate(sy.value, [0, 800], [0, -140], Extrapolation.CLAMP) }] }));
  const k = intensity;

  return (
    <View style={[[StyleSheet.absoluteFill, { backgroundColor: BACKDROP_BG }], { pointerEvents: "none" }]}>
      {/* Far layer: base wash + reflections */}
      <Animated.View style={[StyleSheet.absoluteFill, far]}>
        <View style={{ position: "absolute", width: w * 1.6, height: w * 1.6, left: -w * 0.3, top: -w * 0.55 }}><Light color={P("#12493E")} opacity={0.55 * k} /></View>
        <View style={{ position: "absolute", width: w * 1.1, height: w * 1.1, right: -w * 0.45, top: h * 0.05 }}><Light color={REFLECT.teal} opacity={0.12 * k} /></View>
        <View style={{ position: "absolute", width: w * 1.0, height: w * 1.0, left: -w * 0.5, top: h * 0.42 }}><Light color={REFLECT.blue} opacity={0.1 * k} /></View>
        <View style={{ position: "absolute", width: w * 0.9, height: w * 0.9, right: -w * 0.35, top: h * 0.62 }}><Light color={REFLECT.violet} opacity={0.1 * k} /></View>
        <View style={{ position: "absolute", width: w * 0.6, height: w * 0.6, left: w * 0.15, top: h * 0.82 }}><Light color={REFLECT.pink} opacity={0.07 * k} /></View>
        <View style={{ position: "absolute", width: w * 0.9, height: w * 0.9, left: -w * 0.2, top: h * 0.12 }}><Light color={REFLECT.emerald} opacity={0.08 * k} /></View>
      </Animated.View>

      {/* Near layer: floating glass forms */}
      <Animated.View style={[StyleSheet.absoluteFill, near]}>
        <Animated.View style={[{ position: "absolute", width: w * 0.95, height: w * 0.95, right: -w * 0.42, top: -w * 0.18, opacity: 0.9 * Math.min(1, k + 0.2) }, a]}>
          <GlassForm d={SHAPES[0]!} from={REFLECT.teal} to={REFLECT.violet} />
        </Animated.View>
        <Animated.View style={[{ position: "absolute", width: w * 0.7, height: w * 0.7, left: -w * 0.34, top: h * 0.3, opacity: 0.8 * Math.min(1, k + 0.2) }, b]}>
          <GlassForm d={SHAPES[1]!} from={REFLECT.emerald} to={REFLECT.blue} />
        </Animated.View>
        <Animated.View style={[{ position: "absolute", width: w * 0.55, height: w * 0.55, right: -w * 0.16, top: h * 0.58, opacity: 0.75 * Math.min(1, k + 0.2) }, c]}>
          <GlassForm d={SHAPES[2]!} from={REFLECT.violet} to={REFLECT.pink} />
        </Animated.View>
        <Animated.View style={[{ position: "absolute", width: w * 0.32, height: w * 0.32, left: w * 0.12, top: h * 0.8, opacity: 0.6 * Math.min(1, k + 0.2) }, d]}>
          <GlassForm d={SHAPES[0]!} from={REFLECT.blue} to={REFLECT.teal} />
        </Animated.View>
      </Animated.View>

      {/* Vignette */}
      <View style={StyleSheet.absoluteFill}><Vignette /></View>
    </View>
  );
}

function Vignette() {
  const id = useUid();
  return (
    <Svg width="100%" height="100%">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="42%" r="80%">
          <Stop offset="0.5" stopColor={P("#000")} stopOpacity={0} />
          <Stop offset="1" stopColor={P("#000")} stopOpacity={0.6} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/** Minimal glowing ring mark: an open circle stroked emerald → teal with a soft halo. */
export function RingLogo({ size = 88 }: { size?: number }) {
  const stroke = useUid();
  const halo = useUid();
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: "absolute", top: -size * 0.45, left: -size * 0.45, width: size * 1.9, height: size * 1.9 }}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id={halo} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={REFLECT.emerald} stopOpacity={0.22} />
              <Stop offset="1" stopColor={REFLECT.emerald} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${halo})`} />
        </Svg>
      </View>
      <Svg width={size} height={size} viewBox="0 0 88 88">
        <Defs>
          <LinearGradient id={stroke} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={P("#A8E8C9")} />
            <Stop offset="0.6" stopColor={REFLECT.emerald} />
            <Stop offset="1" stopColor={REFLECT.teal} />
          </LinearGradient>
        </Defs>
        <Path
          d={`M 44 ${44 - r} A ${r} ${r} 0 1 1 ${44 - r * Math.sin(0.9)} ${44 - r * Math.cos(0.9)}`}
          stroke={`url(#${stroke})`}
          strokeWidth={9}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
        />
      </Svg>
    </View>
  );
}
