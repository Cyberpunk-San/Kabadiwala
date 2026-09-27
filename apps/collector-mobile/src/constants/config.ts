// src/constants/config.ts
// Reads EXPO_PUBLIC_* env vars (apps/collector-mobile/.env). Missing or invalid
// values fall back to working defaults.
//
// NOTE: EXPO_PUBLIC_* values are bundled into the app and readable by anyone.
// Never put keys or secrets here — AI keys live only in apps/backend/.env.
import Constants from "expo-constants";
import { Platform } from "react-native";

export interface AppConfig {
  apiBaseUrl: string;              // includes "/api" (no trailing slash)
  apiTimeoutMs: number;
  defaultLatitude: number;
  defaultLongitude: number;
  defaultLocale: "en" | "hi" | "mr";
  ttsSpeechRate: number;
  syncIntervalMs: number;
}

const trimTrailingSlash = (s: string) => s.replace(/\/$/, "");

/** A number from the env, or the fallback when unset / not a number / out of range. */
function num(raw: string | undefined, fallback: number, min = -Infinity, max = Infinity): number {
  const n = raw === undefined || raw.trim() === "" ? NaN : Number(raw);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

/**
 * "localhost" on a phone means the phone itself, not your PC. When running in
 * Expo Go we know the PC's LAN IP (the Metro host), so swap it in automatically.
 */
function resolveApiBase(raw: string): string {
  if (Platform.OS === "web" || !/localhost|127\.0\.0\.1/.test(raw)) return raw;
  const hostUri = Constants.expoConfig?.hostUri ?? "";
  const host = hostUri.split(":")[0];
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return raw.replace(/localhost|127\.0\.0\.1/, host);
  }
  // Android emulator reaches the host machine at 10.0.2.2.
  return Platform.OS === "android" ? raw.replace(/localhost|127\.0\.0\.1/, "10.0.2.2") : raw;
}

const rawLocale = process.env.EXPO_PUBLIC_DEFAULT_LOCALE;

export const config: AppConfig = {
  // IMPORTANT: this includes "/api". Code appends "/v1/..." to it.
  apiBaseUrl: trimTrailingSlash(resolveApiBase(process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8000/api")),
  apiTimeoutMs: num(process.env.EXPO_PUBLIC_API_TIMEOUT_MS, 15000, 1000, 120000),
  defaultLatitude: num(process.env.EXPO_PUBLIC_DEFAULT_LATITUDE, 18.5204, -90, 90),
  defaultLongitude: num(process.env.EXPO_PUBLIC_DEFAULT_LONGITUDE, 73.8567, -180, 180),
  defaultLocale: rawLocale === "en" || rawLocale === "hi" || rawLocale === "mr" ? rawLocale : "hi",
  ttsSpeechRate: num(process.env.EXPO_PUBLIC_TTS_SPEECH_RATE, 0.92, 0.1, 2),
  syncIntervalMs: num(process.env.EXPO_PUBLIC_SYNC_INTERVAL_MS, 30000, 5000, 3600000),
};

