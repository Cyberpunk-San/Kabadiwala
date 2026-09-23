// src/services/voice/speechRecognition.ts
/**
 * Speech-to-Text service.
 *
 * Uses expo-speech-recognition on native (Android/iOS),
 * falls back to the Web Speech API on browsers that support it.
 *
 * If neither is available, returns { available: false } so callers can show
 * a graceful "voice not available" message.
 */

import { Platform } from "react-native";

import type { Language } from "../../types/domain";

export type RecognitionResult = {
  transcript: string;
  confidence: number;
};

export type RecognitionHandle = {
  stop: () => void;
};

const LANG_TAGS: Record<Language, string> = {
  en: "en-IN",
  hi: "hi-IN",
  mr: "mr-IN",
};

// ─── Availability check ──────────────────────────────────────────────────────

let _nativeModule: any = null;
let _nativeModuleChecked = false;

async function loadNativeModule() {
  if (_nativeModuleChecked) return _nativeModule;
  _nativeModuleChecked = true;
  if (Platform.OS === "web") return null;
  try {
    // Dynamic import so web bundling doesn't break
    const mod = await import("expo-speech-recognition");
    _nativeModule = mod?.ExpoSpeechRecognitionModule ?? null;
  } catch {
    _nativeModule = null;
  }
  return _nativeModule;
}

export async function isSpeechRecognitionAvailable(): Promise<boolean> {
  if (Platform.OS === "web") {
    return (
      typeof window !== "undefined" &&
      ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)
    );
  }
  const mod = await loadNativeModule();
  return mod !== null;
}

// ─── Native: expo-speech-recognition ─────────────────────────────────────────

async function startNative(
  language: Language,
  onResult: (r: RecognitionResult) => void,
  onEnd: () => void,
  onError: (msg: string) => void
): Promise<RecognitionHandle> {
  const mod = await loadNativeModule();
  if (!mod) {
    onError("Speech recognition not available on this device");
    return { stop: () => {} };
  }

  // Subscribe to events
  const resultSub = mod.addListener("result", (event: any) => {
    const transcript = event?.results?.[0]?.transcript ?? "";
    const confidence = event?.results?.[0]?.confidence ?? 0.5;
    if (transcript) onResult({ transcript, confidence });
  });

  const endSub = mod.addListener("end", () => onEnd());

  const errorSub = mod.addListener("error", (event: any) => {
    onError(event?.message ?? "Recognition error");
  });

  try {
    mod.start({
      lang: LANG_TAGS[language],
      interimResults: false,
      continuous: false,
      requiresOnDeviceRecognition: false,
      addsPunctuation: false,
    });
  } catch (err) {
    onError(String(err));
  }

  return {
    stop: () => {
      try {
        mod.stop();
      } catch {}
      resultSub?.remove?.();
      endSub?.remove?.();
      errorSub?.remove?.();
    },
  };
}

// ─── Web: Web Speech API ─────────────────────────────────────────────────────

async function startWeb(
  language: Language,
  onResult: (r: RecognitionResult) => void,
  onEnd: () => void,
  onError: (msg: string) => void
): Promise<RecognitionHandle> {
  const W = window as any;
  const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
  if (!Ctor) {
    onError("Speech recognition not supported in this browser");
    return { stop: () => {} };
  }

  const rec = new Ctor();
  rec.lang = LANG_TAGS[language];
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.continuous = false;

  rec.onresult = (event: any) => {
    const transcript = event.results?.[0]?.[0]?.transcript ?? "";
    const confidence = event.results?.[0]?.[0]?.confidence ?? 0.5;
    if (transcript) onResult({ transcript, confidence });
  };
  rec.onerror = (event: any) => {
    onError(event?.error ?? "Recognition error");
  };
  rec.onend = () => onEnd();

  try {
    rec.start();
  } catch (err) {
    onError(String(err));
  }

  return {
    stop: () => {
      try {
        rec.stop();
      } catch {}
    },
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Start a single-utterance recognition session.
 * Returns a handle you can call `.stop()` on.
 *
 * The callbacks fire asynchronously:
 *   - onResult: fires once with the final transcript
 *   - onEnd:    fires when recognition stops (whether or not a result arrived)
 *   - onError:  fires on permission/engine errors
 */
export async function startListening(
  language: Language,
  onResult: (r: RecognitionResult) => void,
  onEnd: () => void,
  onError: (msg: string) => void
): Promise<RecognitionHandle> {
  if (Platform.OS === "web") {
    return startWeb(language, onResult, onEnd, onError);
  }
  return startNative(language, onResult, onEnd, onError);
}