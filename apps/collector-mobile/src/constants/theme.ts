import { Platform } from "react-native";
import { MD3DarkTheme, MD3LightTheme } from "react-native-paper";

import { isLight } from "./themeMode";

import { P } from "../constants/palette";
/**
 * Design tokens — dark cinematic.
 *
 * Green-black page, layered translucent surfaces, soft ambient light. Accents
 * each carry one meaning so the app never turns all-green:
 *   emerald = primary action · mint = active/highlight · lavender = secondary
 *   teal = data · amber = attention/money · rose = errors
 */
export const cinematic = {
  bg: P("#061311"),
  deep: P("#12493E"),
  emerald: P("#19A982"),
  mint: P("#A8E8C9"),
  lavender: P("#A7A5E8"),
  teal: P("#7CC4CC"),
  amber: P("#E5B86A"),
  rose: P("#E7898F"),
  text: P("#F8FAF7"),
  textSoft: P("rgba(248,250,247,0.62)"),
  textFaint: P("rgba(248,250,247,0.40)"),
  surface: P("rgba(248,250,247,0.045)"),
  surfaceHi: P("rgba(248,250,247,0.075)"),
  border: P("rgba(248,250,247,0.08)"),
  borderHi: P("rgba(248,250,247,0.14)"),
} as const;

const C = cinematic;

/** Solid equivalents for places that need opaque colours (sheets, bars, inputs). */
const base = {
  bg: C.bg,
  surface: P("#0C1D1A"),
  surfaceAlt: P("#122622"),
  ink: C.text,
  inkSoft: P("#A3ABA8"),
  muted: P("#8C9692"),
  faint: P("#5E6A66"),
  line: P("#1C2E2A"),

  primary: C.emerald,
  /** Strong accent text on dark (links, active labels). */
  primaryDark: C.mint,
  primarySoft: P("#0E2D26"),
  primaryGlow: C.mint,

  accent: C.amber,
  accentSoft: P("#2A2317"),
  danger: C.rose,
  dangerSoft: P("#2E1719"),
} as const;

/** Focused-task screens use the same palette (kept as its own export for older code). */
export const dark = {
  bg: C.bg,
  surface: base.surface,
  surfaceAlt: base.surfaceAlt,
  line: base.line,
  ink: C.text,
  inkSoft: base.inkSoft,
  faint: base.faint,
  mint: C.mint,
  onMint: P("#062019"),
} as const;

/** Tinted tiles and their icon inks. */
export const hues = {
  peach: P("#2A2118"),
  peachInk: C.amber,
  mintSoft: base.primarySoft,
  mintInk: C.mint,
  lavender: P("#1C1B31"),
  lavenderInk: C.lavender,
  sky: P("#12262A"),
  skyInk: C.teal,

  indigo: C.lavender,
  amber: C.amber,
  green: C.emerald,
  orange: C.amber,
  rose: C.rose,

  coral: C.amber,
  coralSoft: P("#2A2118"),
  cyan: C.teal,
  cyanSoft: P("#12262A"),
  mint: C.mint,
  amberSoft: P("#2A2317"),
} as const;

export const palettes = { dark: base };

export const colors = {
  ...base,
  orange: C.amber,
  orangeSoft: hues.peach,
  info: C.teal,
  infoSoft: hues.sky,
  purple: C.lavender,
  purpleSoft: hues.lavender,
  green: C.emerald,
  greenLight: base.primarySoft,
  cream: C.bg,
  amber: C.amber,
  white: P("#FFFFFF"),
  black: P("#000000"),
  /** Text/icons on emerald or mint fills. */
  onPrimary: P("#04120F"),
  scrim: P("rgba(0,0,0,0.62)"),
  mint: C.mint,
  mintSoft: base.primarySoft,
  lavender: C.lavender,
  teal: C.teal,
} as const;

/** Hero panel gradient (deep emerald tonal). */
export const heroGradient = [P("#17604F"), P("#0F3E34"), P("#08251F")] as const;

const flat = (c: string) => [c, c] as const;
export const gradients = {
  hero: heroGradient,
  emerald: flat(C.emerald),
  sunrise: flat(C.amber),
  gold: flat(C.amber),
  night: flat(C.bg),
  danger: flat(C.rose),
  sky: flat(C.teal),
  violet: flat(C.lavender),
};

/** 8pt grid. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 40 } as const;
export const radius = { sm: 8, md: 10, lg: 16, xl: 20, pill: 999 } as const;

export const fonts = {
  body: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  heavy: "Inter_700Bold",
  display: "Inter_700Bold",
} as const;

/** 32/28 bold titles · 20 semibold sections · 16 body · 13 captions. */
export const type = {
  hero: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 38, fontWeight: "700" as const, letterSpacing: -0.8 },
  h1: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, fontWeight: "700" as const, letterSpacing: -0.6 },
  h2: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26, fontWeight: "600" as const, letterSpacing: -0.4 },
  h3: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, fontWeight: "600" as const, letterSpacing: -0.1 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, fontWeight: "400" as const },
  small: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, fontWeight: "500" as const },
  kicker: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, fontWeight: "500" as const },
  num: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, fontWeight: "700" as const, letterSpacing: -0.8 },
};

const soft = (y: number, blur: number, opacity: number, elevation: number) =>
  Platform.select({
    web: { boxShadow: `0 ${y}px ${blur}px rgba(0,0,0,${opacity})` },
    default: { shadowColor: P("#000"), shadowOpacity: opacity, shadowRadius: blur / 2, shadowOffset: { width: 0, height: y }, elevation },
  }) as object;

/** Depth is soft and dark; `glow` is emerald ambient light for primary controls. */
export const shadow = {
  sm: soft(2, 8, 0.35, 2),
  md: soft(12, 32, 0.5, 8),
  glow: Platform.select({
    web: { boxShadow: "0 8px 28px rgba(25,169,130,0.35)" },
    default: { shadowColor: C.emerald, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  }) as object,
};

export const motion = {
  spring: { damping: 20, stiffness: 260, mass: 0.9 },
  press: { damping: 18, stiffness: 420 },
  fast: 160,
  base: 240,
} as const;

export const TAB_BAR_HEIGHT = 64;

export const paperTheme = {
  ...(isLight ? MD3LightTheme : MD3DarkTheme),
  roundness: 3,
  colors: {
    ...(isLight ? MD3LightTheme : MD3DarkTheme).colors,
    primary: colors.primary,
    secondary: colors.lavender,
    surface: colors.surface,
    background: colors.bg,
    onSurface: colors.ink,
  },
};
