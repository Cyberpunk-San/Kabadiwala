export type Language = "en" | "hi" | "mr";
export type Material = "Copper cable" | "Server boards" | "Aluminium" | "Mixed e-waste";
export type LotStatus = "DRAFT" | "IDENTIFIED" | "AVAILABLE" | "MATCHED" | "PICKUP_SCHEDULED" | "SOLD" | "PAID";

export interface MaterialPrediction {
  material: Material;
  category: string;
  quality: "low" | "medium" | "high";
  hazard: boolean;
  confidence: number;
  safetyMessage?: string;
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
