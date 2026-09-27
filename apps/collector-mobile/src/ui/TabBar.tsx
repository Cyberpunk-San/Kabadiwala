// src/ui/TabBar.tsx — floating dark navigation: a translucent slab with a soft mint
// light that slides to the active tab; the centre action is a raised emerald control.
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { cinematic as C, motion, TAB_BAR_HEIGHT } from "../constants/theme";
import { useTranslation } from "../hooks/useTranslation";
import type { TranslationKey } from "../i18n";
import { type IconName, tap } from "./primitives";
import { Text } from "./Text";

import { P } from "../constants/palette";
const TABS: Record<string, { icon: IconName; iconActive: IconName; label: TranslationKey }> = {
  Home: { icon: "home-outline", iconActive: "home", label: "tabHome" },
  Market: { icon: "storefront-outline", iconActive: "storefront", label: "tabMarket" },
  Collect: { icon: "scan-outline", iconActive: "scan", label: "tabScan" },
  Earnings: { icon: "wallet-outline", iconActive: "wallet", label: "tabEarnings" },
  Profile: { icon: "person-outline", iconActive: "person", label: "tabProfile" },
  CustomerHome: { icon: "home-outline", iconActive: "home", label: "tabHome" },
};

/** Routes rendered as the centre action. */
const CENTER: Record<string, { icon: IconName; label: TranslationKey }> = {
  Collect: { icon: "add", label: "tabScan" },
  Request: { icon: "add", label: "tabRequest" },
};

const LIGHT_W = 48;

function SoftLight({ color, opacity }: { color: string; opacity: number }) {
  return (
    <Svg width="100%" height="100%">
      <Defs>
        <RadialGradient id={`tab-${color.slice(1)}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#tab-${color.slice(1)})`} />
    </Svg>
  );
}

function TabItem({ focused, cfg, label, onPress }: { focused: boolean; cfg: (typeof TABS)[string]; label: string; onPress: () => void }) {
  const on = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    on.value = withTiming(focused ? 1 : 0, { duration: 220 });
  }, [focused, on]);
  const icon = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(on.value, [0, 1], [0, -1]) }, { scale: interpolate(on.value, [0, 1], [1, 1.06]) }] }));
  return (
    <Pressable onPress={onPress} style={styles.item} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={label}>
      <Animated.View style={icon}>
        <Ionicons name={focused ? cfg.iconActive : cfg.icon} size={22} color={focused ? C.mint : C.textSoft} />
      </Animated.View>
      <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function CenterAction({ focused, label, icon, onPress }: { focused: boolean; label: string; icon: IconName; onPress: () => void }) {
  const p = useSharedValue(0);
  const face = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(p.value, [0, 1], [1, 0.94]) }] }));
  const b = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    b.value = withRepeat(withSequence(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 2400, easing: Easing.inOut(Easing.sin) })), -1, false);
  }, [b, reduce]);
  const halo = useAnimatedStyle(() => ({ opacity: Math.min(1, 0.75 + 0.25 * b.value + p.value * 0.2), transform: [{ scale: 1 + 0.04 * b.value }] }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => { p.value = withTiming(1, { duration: 100 }); }}
      onPressOut={() => { p.value = withSpring(0, motion.spring); }}
      style={styles.centerSlot}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
    >
      <Animated.View pointerEvents="none" style={[styles.centerHalo, halo]}>
        <SoftLight color={C.emerald} opacity={0.28} />
      </Animated.View>
      <Animated.View style={[styles.centerBtn, face]}>
        <Ionicons name={icon} size={28} color={C.bg} />
      </Animated.View>
    </Pressable>
  );
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const slot = width / Math.max(1, state.routes.length);
  const x = useSharedValue(0);
  const onCenter = !!CENTER[state.routes[state.index]?.name ?? ""];

  useEffect(() => {
    if (slot) x.value = withSpring(state.index * slot + (slot - LIGHT_W) / 2, motion.spring);
  }, [state.index, slot, x]);
  const light = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], opacity: withTiming(onCenter ? 0 : 1, { duration: 180 }) }));

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.shadow}>
        <View style={styles.bar} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          <View style={[StyleSheet.absoluteFill, styles.clip]}>
            {Platform.OS !== "android" ? <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} /> : null}
            <View style={[StyleSheet.absoluteFill, styles.tint]} />
            <LinearGradient pointerEvents="none" colors={[P("rgba(248,250,247,0.07)"), P("rgba(248,250,247,0)")]} style={styles.sheen} />
            <LinearGradient pointerEvents="none" colors={[P("rgba(168,232,201,0)"), P("rgba(168,232,201,0.14)"), P("rgba(168,232,201,0)")]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.edge} />
          </View>
          {width ? (
            <Animated.View pointerEvents="none" style={[styles.light, light]}>
              <SoftLight color={C.mint} opacity={0.16} />
              <View style={styles.lightDot} />
            </Animated.View>
          ) : null}
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const onPress = () => {
              tap();
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
            };
            const center = CENTER[route.name];
            if (center) return <CenterAction key={route.key} focused={focused} label={t(center.label)} icon={center.icon} onPress={onPress} />;
            const cfg = TABS[route.name]!;
            return <TabItem key={route.key} focused={focused} cfg={cfg} label={t(cfg.label)} onPress={onPress} />;
          })}
        </View>
      </View>
    </View>
  );
}

const BTN = 52;
const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16 },
  shadow: Platform.select({
    web: { boxShadow: "0 24px 60px rgba(0,0,0,0.6), 0 0 40px rgba(25,169,130,0.08), 0 2px 8px rgba(0,0,0,0.35)", borderRadius: 22 },
    default: { shadowColor: P("#000"), shadowOpacity: 0.55, shadowRadius: 26, shadowOffset: { width: 0, height: 16 }, elevation: 16, borderRadius: 22 },
  }) as object,
  bar: {
    flexDirection: "row",
    alignItems: "center",
    height: TAB_BAR_HEIGHT,
    borderRadius: 22,
    overflow: "visible",
    borderWidth: 1,
    borderColor: P("rgba(248,250,247,0.08)"),
  },
  clip: { borderRadius: 22, overflow: "hidden" },
  tint: { backgroundColor: Platform.OS === "android" ? P("rgba(9,22,19,0.94)") : P("rgba(9,22,19,0.62)") },
  sheen: { position: "absolute", top: 0, left: 0, right: 0, height: "50%" },
  edge: { position: "absolute", top: 0, left: 24, right: 24, height: 1 },
  light: { position: "absolute", top: 4, left: 0, width: LIGHT_W, height: TAB_BAR_HEIGHT - 8, alignItems: "center" },
  lightDot: { position: "absolute", bottom: 2, width: 4, height: 4, borderRadius: 2, backgroundColor: C.mint },
  item: { flex: 1, height: TAB_BAR_HEIGHT, alignItems: "center", justifyContent: "center", gap: 3 },
  label: { fontSize: 11, fontWeight: "500", color: C.textSoft },
  labelActive: { color: C.text, fontWeight: "600" },

  centerSlot: { flex: 1, height: TAB_BAR_HEIGHT, alignItems: "center", justifyContent: "center" },
  centerHalo: { position: "absolute", width: BTN * 2, height: BTN * 2, top: -BTN / 2 - 10, alignSelf: "center" },
  centerBtn: { width: BTN, height: BTN, borderRadius: BTN / 2, alignItems: "center", justifyContent: "center", backgroundColor: C.emerald, marginTop: -20, borderWidth: 1, borderColor: P("rgba(168,232,201,0.45)") },
});
