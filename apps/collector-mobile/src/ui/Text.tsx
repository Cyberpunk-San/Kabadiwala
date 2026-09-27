// src/ui/Text.tsx — app-wide Text: Inter at the requested weight, in ink.
// Android can't synthesise weights for custom fonts, so each fontWeight maps to its own file.
import { forwardRef, type ComponentRef } from "react";
import { Text as RNText, StyleSheet, type TextProps } from "react-native";
import Animated from "react-native-reanimated";

import { colors, fonts } from "../constants/theme";

const BY_WEIGHT: Record<string, string> = {
  "100": fonts.body, "200": fonts.body, "300": fonts.body, "400": fonts.body, normal: fonts.body,
  "500": fonts.medium, "600": fonts.semibold, "700": fonts.bold, bold: fonts.bold, "800": fonts.bold, "900": fonts.bold,
};

export function fontFor(style: TextProps["style"]) {
  const flat = StyleSheet.flatten(style) ?? {};
  // An explicit family (e.g. the display face) wins; weight is then baked into that face.
  if (flat.fontFamily) return { fontFamily: flat.fontFamily, fontWeight: "400" as const };
  return { fontFamily: BY_WEIGHT[String(flat.fontWeight ?? "400")] ?? fonts.body, fontWeight: "400" as const };
}

// Inter has no Devanagari; the system fallback clips the i-matra (ि) hook at large sizes.
// Hindi/Marathi text is set in Mukta instead, with line height for the marks above the headline.
const DEVANAGARI = /[ऀ-ॿ]/;
const MUKTA: Record<string, string> = {
  Inter_400Regular: "Mukta_400Regular", Inter_500Medium: "Mukta_500Medium",
  Inter_600SemiBold: "Mukta_600SemiBold", Inter_700Bold: "Mukta_700Bold",
};
const hasDevanagari = (node: unknown): boolean =>
  typeof node === "string" ? DEVANAGARI.test(node) : Array.isArray(node) ? node.some(hasDevanagari) : false;

function indicFor(style: TextProps["style"], family: string) {
  const flat = StyleSheet.flatten(style) ?? {};
  const size = flat.fontSize ?? 14;
  return {
    fontFamily: MUKTA[family] ?? family,
    letterSpacing: 0,
    lineHeight: Math.max(flat.lineHeight ?? 0, Math.round(size * 1.4)),
  };
}

export const Text = forwardRef<ComponentRef<typeof RNText>, TextProps>(function Text({ style, children, ...rest }, ref) {
  const face = fontFor(style);
  const script = hasDevanagari(children) ? indicFor(style, face.fontFamily) : null;
  return <RNText ref={ref} {...rest} style={[styles.base, style, face, script]}>{children}</RNText>;
});

/** Animated variant for Animated.Text call sites. */
export const AnimatedText = Animated.createAnimatedComponent(Text);

const styles = StyleSheet.create({
  base: { color: colors.ink },
});
