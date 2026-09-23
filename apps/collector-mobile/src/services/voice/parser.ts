// src/services/voice/parser.ts
/**
 * Turn spoken text into structured values.
 *
 * Handles:
 *   - Number words in English, Hindi, Marathi ("thirty five" → 35)
 *   - Material names ("copper", "तांबा", "तांबे" → "Copper cable")
 *   - Intent detection ("confirm", "हाँ", "हो" → confirm)
 */

import { MATERIAL_METADATA, type Material, type Language } from "../../types/domain";

// ─── Number words ────────────────────────────────────────────────────────────

const EN_ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19,
};

const EN_TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};

const HI_ONES: Record<string, number> = {
  "शून्य": 0, "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5,
  "छह": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10, "ग्यारह": 11,
  "बारह": 12, "तेरह": 13, "चौदह": 14, "पंद्रह": 15, "सोलह": 16,
  "सत्रह": 17, "अठारह": 18, "उन्नीस": 19, "बीस": 20, "तीस": 30,
  "चालीस": 40, "पचास": 50, "साठ": 60, "सत्तर": 70, "अस्सी": 80, "नब्बे": 90,
};

const MR_ONES: Record<string, number> = {
  "शून्य": 0, "एक": 1, "दोन": 2, "तीन": 3, "चार": 4, "पाच": 5,
  "सहा": 6, "सात": 7, "आठ": 8, "नऊ": 9, "दहा": 10, "अकरा": 11,
  "बारा": 12, "तेरा": 13, "चौदा": 14, "पंधरा": 15, "सोळा": 16,
  "सतरा": 17, "अठरा": 18, "एकोणीस": 19, "वीस": 20, "तीस": 30,
  "चाळीस": 40, "पन्नास": 50, "साठ": 60, "सत्तर": 70, "ऐंशी": 80, "नव्वद": 90,
};

/**
 * Parse a spoken number in "thirty five" / "पैंतीस" style, or "35" digits.
 * Returns NaN if nothing parseable.
 */
export function parseSpokenNumber(text: string, language: Language): number {
  const cleaned = text.toLowerCase().trim();

  // 1. Direct digits
  const digits = cleaned.match(/\d+(\.\d+)?/);
  if (digits) return parseFloat(digits[0]);

  // 2. English compound: "thirty five"
  const words = cleaned.split(/\s+/);
  let enTotal = 0;
  let enMatched = false;
  for (const w of words) {
    if (w in EN_TENS) {
      enTotal += EN_TENS[w]!;
      enMatched = true;
    } else if (w in EN_ONES) {
      enTotal += EN_ONES[w]!;
      enMatched = true;
    }
  }
  if (enMatched) return enTotal;

  // 3. Hindi / Marathi direct word
  const dict = language === "mr" ? MR_ONES : HI_ONES;
  for (const w of words) {
    if (w in dict) return dict[w]!;
  }

  return NaN;
}

// ─── Material matching ───────────────────────────────────────────────────────

type MaterialKey = {
  material: Material;
  tokens: string[];
};

const MATERIAL_TOKENS: MaterialKey[] = (Object.keys(MATERIAL_METADATA) as Material[]).map((m) => {
  const meta = MATERIAL_METADATA[m];
  const tokens = [
    m.toLowerCase(),
    ...m.toLowerCase().split(/[\s()+]+/),
    meta.hindi,
    meta.marathi,
    ...meta.hindi.split(/\s+/),
    ...meta.marathi.split(/\s+/),
  ].filter((t) => t.length >= 3);
  return { material: m, tokens: Array.from(new Set(tokens)) };
});

/**
 * Find the best-matching material from a spoken phrase.
 * Returns null if no token matches.
 */
export function matchMaterial(text: string): Material | null {
  const lower = text.toLowerCase();

  // Exact/strong token match
  for (const { material, tokens } of MATERIAL_TOKENS) {
    for (const tok of tokens) {
      if (lower.includes(tok.toLowerCase())) {
        return material;
      }
    }
  }
  return null;
}

// ─── Intent detection ────────────────────────────────────────────────────────

const CONFIRM_TOKENS = [
  "confirm", "yes", "haan", "ha", "ok", "okay", "accept",
  "हाँ", "हां", "ठीक", "ठिक", "हो", "होय", "पुष्टी",
];

const CANCEL_TOKENS = ["cancel", "no", "stop", "नहीं", "नही", "रद्द"];

export function isConfirmIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return CONFIRM_TOKENS.some((t) => lower.includes(t.toLowerCase()));
}

export function isCancelIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return CANCEL_TOKENS.some((t) => lower.includes(t.toLowerCase()));
}