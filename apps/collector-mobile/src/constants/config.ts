// src/constants/config.ts
import { Platform } from "react-native";
// Reads EXPO_PUBLIC_* env vars. If absent, falls back to sensible demo defaults.

export interface AppConfig {
  appEnv: "development" | "staging" | "production";
  apiBaseUrl: string;              // includes "/api" (no trailing slash)
  apiTimeoutMs: number;
  aiVisionApiUrl: string;
  aiVisionApiKey: string;
  mapsApiKey: string;
  defaultLatitude: number;
  defaultLongitude: number;
  defaultCity: string;
  defaultLocale: "en" | "hi" | "mr";
  ttsSpeechRate: number;
  currencySymbol: string;
  enableOfflineMode: boolean;
  syncIntervalMs: number;
  maxOfflineLots: number;
  useMockFallbacks: boolean;
  paymentGatewayKey: string;
  smsGatewayUrl: string;
  recyclerWebUrl: string;
  sentryDsn?: string;
}

const trimTrailingSlash = (s: string) => s.replace(/\/$/, "");

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const defaultBaseUrl = Platform.OS === "android"
  ? "http://10.0.2.2:8000/api"
  : "http://localhost:8000/api";
// Android emulator maps the host computer to 10.0.2.2, not localhost.
const resolvedBaseUrl = configuredBaseUrl
  ?.replace("http://localhost:", Platform.OS === "android" ? "http://10.0.2.2:" : "http://localhost:")
  .replace("http://127.0.0.1:", Platform.OS === "android" ? "http://10.0.2.2:" : "http://127.0.0.1:")
  ?? defaultBaseUrl;
const baseUrl = trimTrailingSlash(resolvedBaseUrl);

export const config: AppConfig = {
  appEnv: (process.env.EXPO_PUBLIC_APP_ENV as AppConfig["appEnv"]) ?? "development",

  // IMPORTANT: this includes "/api". Code appends "/v1/..." to it.
  apiBaseUrl: baseUrl,

  apiTimeoutMs: Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS ?? 15000),

  aiVisionApiUrl:
    process.env.EXPO_PUBLIC_AI_VISION_API_URL ?? `${baseUrl}/v1/vision/analyze`,
  aiVisionApiKey: process.env.EXPO_PUBLIC_AI_VISION_API_KEY ?? "",

  mapsApiKey: process.env.EXPO_PUBLIC_MAPS_API_KEY ?? "",
  defaultLatitude: Number(process.env.EXPO_PUBLIC_DEFAULT_LATITUDE ?? 18.5204),
  defaultLongitude: Number(process.env.EXPO_PUBLIC_DEFAULT_LONGITUDE ?? 73.8567),
  defaultCity: process.env.EXPO_PUBLIC_DEFAULT_CITY ?? "Pune",

  defaultLocale:
    (process.env.EXPO_PUBLIC_DEFAULT_LOCALE as AppConfig["defaultLocale"]) ?? "hi",

  ttsSpeechRate: Number(process.env.EXPO_PUBLIC_TTS_SPEECH_RATE ?? 0.92),
  currencySymbol: process.env.EXPO_PUBLIC_CURRENCY_SYMBOL ?? "₹",

  enableOfflineMode: process.env.EXPO_PUBLIC_ENABLE_OFFLINE_MODE !== "false",
  syncIntervalMs: Number(process.env.EXPO_PUBLIC_SYNC_INTERVAL_MS ?? 30000),
  maxOfflineLots: Number(process.env.EXPO_PUBLIC_MAX_OFFLINE_LOTS ?? 500),
  useMockFallbacks: process.env.EXPO_PUBLIC_USE_MOCK_FALLBACKS !== "false",

  paymentGatewayKey: process.env.EXPO_PUBLIC_PAYMENT_GATEWAY_KEY ?? "",
  smsGatewayUrl: process.env.EXPO_PUBLIC_SMS_GATEWAY_URL ?? "",
  recyclerWebUrl: process.env.EXPO_PUBLIC_RECYCLER_WEB_URL ?? "http://localhost:3000",
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || undefined,
};
