// src/services/voice/narration.ts
/**
 * Voice-guided navigation.
 * Speaks a short description of each screen when it mounts (if enabled).
 */

import { speak } from "./speech";
import type { Language } from "../../types/domain";

export const SCREEN_NARRATIONS: Record<string, Record<Language, string>> = {
  Home: {
    en: "Home screen. Your weekly earnings, best materials, and quick actions are here.",
    hi: "होम स्क्रीन। आपकी साप्ताहिक कमाई, बेहतरीन सामग्री और त्वरित कार्य यहाँ हैं।",
    mr: "मुख्यपृष्ठ. तुमची साप्ताहिक कमाई, सर्वोत्तम साहित्य आणि त्वरित क्रिया येथे आहेत.",
  },
  Collect: {
    en: "Collect screen. Take a photo of the scrap, then confirm the material and weight.",
    hi: "कलेक्शन स्क्रीन। कबाड़ की फोटो लें, फिर सामग्री और वजन की पुष्टि करें।",
    mr: "संकलन स्क्रीन. कबाडाचा फोटो घ्या, नंतर साहित्य आणि वजनाची खात्री करा.",
  },
  Market: {
    en: "Market screen. Recycler offers sorted by take-home earnings.",
    hi: "बाज़ार स्क्रीन। रीसाइक्लर के ऑफर आपकी कमाई के हिसाब से क्रमबद्ध हैं।",
    mr: "बाजार स्क्रीन. रीसायकलरच्या ऑफर तुमच्या कमाईनुसार क्रमवारीत आहेत.",
  },
  BazarBhav: {
    en: "Bazar Bhav screen. Today's scrap rates with seven day trends.",
    hi: "बाज़ार भाव स्क्रीन। आज के कबाड़ भाव और सात दिनों का रुझान।",
    mr: "बाजार भाव स्क्रीन. आजचे कबाड दर आणि सात दिवसांचा कल.",
  },
  Earnings: {
    en: "Earnings screen. Your weekly income and material breakdown.",
    hi: "कमाई स्क्रीन। आपकी साप्ताहिक आय और सामग्री का विवरण।",
    mr: "कमाई स्क्रीन. तुमची साप्ताहिक उत्पन्न आणि साहित्याचे विभाजन.",
  },
  Profile: {
    en: "Profile screen. Your identity card, KYC status, and settings.",
    hi: "प्रोफ़ाइल स्क्रीन। आपका पहचान पत्र, केवाईसी स्थिति और सेटिंग्स।",
    mr: "प्रोफाइल स्क्रीन. तुमचे ओळखपत्र, केवायसी स्थिती आणि सेटिंग्ज.",
  },
};

export function narrateScreen(screenName: string, language: Language, enabled: boolean) {
  if (!enabled) return;
  const text = SCREEN_NARRATIONS[screenName]?.[language];
  if (text) speak(text, language);
}