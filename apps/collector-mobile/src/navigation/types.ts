import type { Material } from "../types/domain";

export type RootTabParamList = {
  Home: undefined;
  Collect: undefined;
  Market: {
    material?: Material;
    quality?: "low" | "medium" | "high";
    weightKg?: number;
    imageUri?: string;
  } | undefined;
  BazarBhav: undefined;
  Earnings: undefined;
  Profile: undefined;
  Handover: {
    lotId?: string;
    material?: Material;
    weightKg?: number;
    netAmount?: number;
  } | undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  Handover: {
    lotId?: string;
    material?: Material;
    weightKg?: number;
    netAmount?: number;
  } | undefined;
  BazarBhav: undefined;
};

