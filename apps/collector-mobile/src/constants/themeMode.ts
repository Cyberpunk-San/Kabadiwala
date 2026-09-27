// src/constants/themeMode.ts — dark / light / match-the-phone.
// Styles are created once when each screen's module loads, so the choice is read synchronously at startup
// (web: localStorage, phone: expo-sqlite key-value store) and changing it reloads the app.
import { Appearance, DevSettings, Platform } from "react-native";

export type ThemePref = "dark" | "light" | "system";
export type ThemeMode = "dark" | "light";

const KEY = "@mhk_theme_pref";

function kv(): { getItemSync(k: string): string | null; setItemSync(k: string, v: string): void } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-sqlite/kv-store").Storage;
  } catch {
    return null;
  }
}

function readPref(): ThemePref {
  try {
    const raw = Platform.OS === "web" ? globalThis.localStorage?.getItem(KEY) : kv()?.getItemSync(KEY);
    return raw === "light" || raw === "system" || raw === "dark" ? raw : "dark";
  } catch {
    return "dark";
  }
}

export const THEME_PREF: ThemePref = readPref();
export const THEME_MODE: ThemeMode =
  THEME_PREF === "system" ? (Appearance.getColorScheme() === "light" ? "light" : "dark") : THEME_PREF;
export const isLight = THEME_MODE === "light";

/** Save the choice and restart the UI so every screen is rebuilt in the new colours. */
export function setThemePref(pref: ThemePref): void {
  try {
    if (Platform.OS === "web") globalThis.localStorage?.setItem(KEY, pref);
    else kv()?.setItemSync(KEY, pref);
  } catch {
    // Storage unavailable — keep the current theme.
    return;
  }
  if (Platform.OS === "web") globalThis.location?.reload();
  else DevSettings.reload();
}
