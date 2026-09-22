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
  | "Compressors & cooling units";

export type LotStatus = "DRAFT" | "IDENTIFIED" | "AVAILABLE" | "MATCHED" | "PICKUP_SCHEDULED" | "SOLD" | "PAID";

export interface MaterialMeta {
  material: Material;
  hindi: string;
  marathi: string;
  category: "Metals" | "Electronics" | "Batteries" | "Heavy Scrap";
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
  }
};

export interface MaterialPrediction {
  material: Material;
  category: string;
  quality: "low" | "medium" | "high";
  hazard: boolean;
  confidence: number;
  safetyMessage?: string;
}

export interface BazarPriceItem {
  id: string;
  material: Material;
  category: "Metals" | "Electronics" | "Batteries" | "Heavy Scrap";
  currentPrice: number;
  previousPrice: number;
  changePercent: number;
  trend: "up" | "down" | "stable";
  demand: "HIGH" | "MODERATE" | "LOW";
  history7Days: { day: string; price: number }[];
  advice: string;
  adviceHi: string;
  adviceMr: string;
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
  id: string;
  material: Material;
  quality: "low" | "medium" | "high";
  weightKg: number;
  status: LotStatus;
  imageUri?: string;
  createdAt: string;
  expectedNetEarnings?: number;
  syncState: "PENDING" | "SYNCED";
}

export interface CreateLotInput {
  material: Material;
  quality: "low" | "medium" | "high";
  weightKg: number;
  imageUri?: string;
  expectedNetEarnings?: number;
  status?: LotStatus;
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
