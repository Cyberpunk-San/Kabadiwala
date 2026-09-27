export type Language = "en" | "hi" | "mr";
export type Material =
  | "Copper cable"
  | "Server boards"
  | "Aluminium"
  | "Mixed e-waste"
  | "Lithium-ion batteries"
  | "Brass fittings"
  | "Printed Circuit Boards (PCB)"
  | "Electric motors"
  | "Iron & steel scrap"
  | "CRT & monitor glass"
  | "Lead acid batteries"
  | "Compressors & cooling units"
  // Household scrap — priced from city rate cards
  | "Newspaper"
  | "Books & notebooks"
  | "Cardboard"
  | "Mixed plastic"
  | "PET bottles"
  | "Stainless steel";

export type LotStatus = "DRAFT" | "IDENTIFIED" | "AVAILABLE" | "MATCHED" | "PICKUP_SCHEDULED" | "SOLD" | "PAID" | "AGGREGATED";

export type MaterialCategory = "Metals" | "Electronics" | "Batteries" | "Heavy Scrap" | "Paper" | "Plastic";

export interface MaterialMeta {
  material: Material;
  hindi: string;
  marathi: string;
  category: MaterialCategory;
  icon: string;
  hazard: boolean;
  basePricePerKg: number;
  safetyWarning?: string;
}

export const MATERIAL_METADATA: Record<Material, MaterialMeta> = {
  "Copper cable": {
    material: "Copper cable",
    hindi: "तांबा केबल",
    marathi: "तांबे वायर",
    category: "Metals",
    icon: "⚡",
    hazard: false,
    basePricePerKg: 620
  },
  "Server boards": {
    material: "Server boards",
    hindi: "सर्वर मदरबोर्ड",
    marathi: "सर्व्हर बोर्ड",
    category: "Electronics",
    icon: "💾",
    hazard: false,
    basePricePerKg: 510
  },
  "Aluminium": {
    material: "Aluminium",
    hindi: "एल्युमिनियम",
    marathi: "ॲल्युमिनियम",
    category: "Metals",
    icon: "🥫",
    hazard: false,
    basePricePerKg: 145
  },
  "Mixed e-waste": {
    material: "Mixed e-waste",
    hindi: "मिश्रित ई-कचरा",
    marathi: "मिश्र ई-कचरा",
    category: "Electronics",
    icon: "🔌",
    hazard: false,
    basePricePerKg: 85
  },
  "Lithium-ion batteries": {
    material: "Lithium-ion batteries",
    hindi: "लिथियम बैटरी",
    marathi: "लिथियम बॅटरी",
    category: "Batteries",
    icon: "🔋",
    hazard: true,
    basePricePerKg: 280,
    safetyWarning: "Fire and chemical risk! Never puncture, crush, or expose to water. Wear insulating gloves."
  },
  "Brass fittings": {
    material: "Brass fittings",
    hindi: "पीतल स्क्रैप",
    marathi: "पितळ",
    category: "Metals",
    icon: "🪙",
    hazard: false,
    basePricePerKg: 430
  },
  "Printed Circuit Boards (PCB)": {
    material: "Printed Circuit Boards (PCB)",
    hindi: "पीसीबी बोर्ड",
    marathi: "पीसीबी बोर्ड",
    category: "Electronics",
    icon: "🖨",
    hazard: false,
    basePricePerKg: 340
  },
  "Electric motors": {
    material: "Electric motors",
    hindi: "इलेक्ट्रिक मोटर",
    marathi: "इलेक्ट्रिक मोटर",
    category: "Heavy Scrap",
    icon: "⚙",
    hazard: false,
    basePricePerKg: 195
  },
  "Iron & steel scrap": {
    material: "Iron & steel scrap",
    hindi: "लोहा और स्टील",
    marathi: "लोखंड आणि स्टील",
    category: "Heavy Scrap",
    icon: "🔩",
    hazard: false,
    basePricePerKg: 38
  },
  "CRT & monitor glass": {
    material: "CRT & monitor glass",
    hindi: "सीआरटी स्क्रीन ग्लास",
    marathi: "सीआरटी काच",
    category: "Electronics",
    icon: "🖥",
    hazard: true,
    basePricePerKg: 18,
    safetyWarning: "Lead oxide and vacuum implosion hazard! Do not smash. Wear safety goggles."
  },
  "Lead acid batteries": {
    material: "Lead acid batteries",
    hindi: "लेड-एसिड बैटरी",
    marathi: "लेड ॲसिड बॅटरी",
    category: "Batteries",
    icon: "🛢",
    hazard: true,
    basePricePerKg: 98,
    safetyWarning: "Sulfuric acid and toxic heavy metal hazard! Keep upright. Wash skin immediately if contacted."
  },
  "Compressors & cooling units": {
    material: "Compressors & cooling units",
    hindi: "कंप्रेसर स्क्रैप",
    marathi: "कंप्रेसर",
    category: "Heavy Scrap",
    icon: "❄",
    hazard: false,
    basePricePerKg: 165
  },
  // basePricePerKg for household scrap = India median doorstep rate ÷ 0.70 (offline fallback only)
  "Newspaper": { material: "Newspaper", hindi: "अखबार (रद्दी)", marathi: "वर्तमानपत्र (रद्दी)", category: "Paper", icon: "N", hazard: false, basePricePerKg: 14.3 },
  "Books & notebooks": { material: "Books & notebooks", hindi: "किताबें और कॉपियाँ", marathi: "पुस्तके आणि वह्या", category: "Paper", icon: "B", hazard: false, basePricePerKg: 14.3 },
  "Cardboard": { material: "Cardboard", hindi: "गत्ता / कार्टन", marathi: "पुठ्ठा / कार्टन", category: "Paper", icon: "C", hazard: false, basePricePerKg: 12.9 },
  "Mixed plastic": { material: "Mixed plastic", hindi: "प्लास्टिक (बाल्टी, डिब्बे)", marathi: "प्लास्टिक (बादली, डबे)", category: "Plastic", icon: "P", hazard: false, basePricePerKg: 11.4 },
  "PET bottles": { material: "PET bottles", hindi: "प्लास्टिक बोतलें", marathi: "प्लास्टिक बाटल्या", category: "Plastic", icon: "P", hazard: false, basePricePerKg: 21.4 },
  "Stainless steel": { material: "Stainless steel", hindi: "स्टेनलेस स्टील (बर्तन)", marathi: "स्टेनलेस स्टील (भांडी)", category: "Metals", icon: "S", hazard: false, basePricePerKg: 57.1 }
};

export interface MaterialPrediction {
  material: Material;
  category: string;
  quality: "low" | "medium" | "high";
  hazard: boolean;
  confidence: number;
  safetyMessage?: string;
  alternatives?: Array<{ material: Material; confidence: number }>;
  /** Where the answer came from: cloud AI, server AI, or a fallback. */
  source?: "huggingface" | "local" | "fallback";
}

export interface BazarPriceItem {
  id: string;
  material: Material;
  category: MaterialCategory;
  currentPrice: number;
  previousPrice: number;
  changePercent: number;
  trend: "up" | "down" | "stable";
  demand: "HIGH" | "MODERATE" | "LOW";
  history7Days: { day: string; price: number }[];
  advice: string;
  adviceHi: string;
  adviceMr: string;
  /** Present when the price came from the server for the user's location. */
  live?: LivePriceInfo;
}

export interface PremiumReason {
  kind: "industry" | "buyers" | "demand";
  label: string;
  detail: string;
  distance_km: number | null;
  pct: number;
}

export interface LivePriceInfo {
  marketPrice: number;        // dealer-level value before the local premium
  premiumPct: number;         // nearby industry + buyers + open demand, 0–15%
  reasons: PremiumReason[];
  doorstepPrice: number;      // what a household is paid
  basis: "live" | "rate_card" | "reference";
  source: string;             // e.g. "Copper (COMEX) (live)" or "Pune rate card"
}

export interface HandoverPayload {
  lotId: string;
  collectorId: string;
  collectorName: string;
  material: Material;
  weightKg: number;
  quality: "low" | "medium" | "high";
  expectedNetEarnings: number;
  recyclerName?: string;
  pickupPin: string;
  createdAt: string;
  verificationHash: string;
}

export interface RecyclerOffer {
  id: string;
  recyclerName: string;
  verified: boolean;
  rating: number;
  listedPricePerKg: number;
  pickupCost: number;
  handlingCost: number;
  platformFee: number;
  distanceKm: number;
  paymentReliability: number;
}

export interface LotEvent {
  id: string;
  lotId: string;
  type: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

export interface Lot {
  /** Same id locally and on the server (offline lots are created on the server with this id). */
  id: string;
  material: Material;
  quality: "low" | "medium" | "high";
  weightKg: number;
  status: LotStatus;
  /** Cover photo (first of imageUris). */
  imageUri?: string;
  /** Every photo taken of this lot (before-handover evidence). */
  imageUris?: string[];
  createdAt: string;
  expectedNetEarnings?: number;
  syncState: "PENDING" | "SYNCED";
  recyclerId?: string;
  recyclerName?: string;
}

export interface CreateLotInput {
  id?: string;
  material: Material;
  quality: "low" | "medium" | "high";
  weightKg: number;
  imageUri?: string;
  imageUris?: string[];
  expectedNetEarnings?: number;
  status?: LotStatus;
  syncState?: Lot["syncState"];
  createdAt?: string;
  recyclerId?: string;
  recyclerName?: string;
}

export const ALL_MATERIALS = Object.keys(MATERIAL_METADATA) as Material[];

export function isMaterial(value: unknown): value is Material {
  return typeof value === "string" && value in MATERIAL_METADATA;
}

export function materialName(material: Material, language: Language): string {
  const meta = MATERIAL_METADATA[material];
  if (!meta) return material;
  return language === "hi" ? meta.hindi : language === "mr" ? meta.marathi : material;
}

export type UserRole = "kabadiwala" | "user" | "admin";

export interface UserProfile {
  id: string;
  name: string;
  initials: string;
  role: UserRole;
  cluster: string;
  collectorId?: string; // only for kabadiwala
  monthlyAamdani?: number; // only for kabadiwala
  greenKgSaved?: number; // only for kabadiwala
  co2OffsetKg?: number; // only for kabadiwala
  tier?: "bronze" | "silver" | "gold" | "platinum"; // only for kabadiwala
  weeklyGoal?: number; // only for kabadiwala
  // for user (household)
  address?: string;
  lastPickupDate?: string;
  // for admin
  jurisdiction?: string;
}

export interface AdminStats {
  totalCollectors: number;
  totalLotsToday: number;
  totalKgToday: number;
  totalEarningsToday: number;
  hazardLotsOpen: number;
  pendingSyncLots: number;
  eprTonnageMonth: number;
  topCluster: string;
}
