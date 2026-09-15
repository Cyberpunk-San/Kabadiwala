import * as Speech from "expo-speech";

import type { Language } from "../../types/domain";

const locales: Record<Language, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };

export function speak(text: string, language: Language) {
  Speech.stop();
  Speech.speak(text, { language: locales[language], rate: 0.92 });
}
