export const currency = (amount: number) => `₹${Math.round(amount || 0).toLocaleString("en-IN")}`;

/** ₹1.2L / ₹12.5K style for tight spaces. */
export const compactCurrency = (amount: number) => {
  const n = Math.abs(amount || 0);
  if (n >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(1)}L`;
  if (n >= 10_000) return `₹${(amount / 1000).toFixed(1)}K`;
  return currency(amount);
};

export const relativeDate = (date: string, language: "en" | "hi" | "mr" = "en") => {
  const ageMin = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60_000));
  const words = {
    en: { now: "Just now", m: "m ago", h: "h ago", d: "d ago" },
    hi: { now: "अभी", m: " मिनट पहले", h: " घंटे पहले", d: " दिन पहले" },
    mr: { now: "आत्ताच", m: " मिनिटांपूर्वी", h: " तासांपूर्वी", d: " दिवसांपूर्वी" },
  }[language];
  if (ageMin < 1) return words.now;
  if (ageMin < 60) return `${ageMin}${words.m}`;
  if (ageMin < 60 * 24) return `${Math.round(ageMin / 60)}${words.h}`;
  return `${Math.round(ageMin / 1440)}${words.d}`;
};

/** YYYY-MM-DD for today + offsetDays, in the phone's local time zone. */
export const localDateISO = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** "Today" / "Tomorrow" / "Fri 3 Oct" for a YYYY-MM-DD pickup date. */
export const scheduleLabel = (isoDate: string, language: "en" | "hi" | "mr" = "en") => {
  const words = { en: ["Today", "Tomorrow"], hi: ["आज", "कल"], mr: ["आज", "उद्या"] }[language];
  if (isoDate === localDateISO(0)) return words[0]!;
  if (isoDate === localDateISO(1)) return words[1]!;
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d ?? 1);
  try {
    return date.toLocaleDateString(`${language}-IN`, { weekday: "short", day: "numeric", month: "short" });
  } catch {
    return isoDate;
  }
};
