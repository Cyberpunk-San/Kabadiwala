// src/navigation/types.ts
import type { Material } from "../types/domain";

export type RootTabParamList = {
  Home: undefined;
  Opportunity: undefined;
  Demands: undefined;
  Collect: { prefillWeightKg?: number } | undefined;
  Market: {
    material?: Material;
    quality?: "low" | "medium" | "high";
    weightKg?: number;
    imageUri?: string;
  } | undefined;
  BazarBhav: undefined;
  Earnings: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Kyc: undefined;
  Tabs: undefined;
  Handover: {
    lotId?: string;
    material?: Material;
    weightKg?: number;
    netAmount?: number;
  } | undefined;
  BazarBhav: undefined;
  Accessibility: undefined;
};
