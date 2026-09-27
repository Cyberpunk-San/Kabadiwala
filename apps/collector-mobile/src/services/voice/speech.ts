import * as Speech from "expo-speech";

import { config } from "../../constants/config";
import type { Language } from "../../types/domain";

const locales: Record<Language, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };

export function speak(text: string, language: Language) {
  Speech.stop();
  // Strip emoji/markdown so the voice doesn't read symbols aloud.
  const clean = text.replace(/[*_#`>]/g, "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "");
  Speech.speak(clean, { language: locales[language], rate: config.ttsSpeechRate });
}

export function stopSpeaking() {
  Speech.stop();
}
