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
  Earnings: undefined;
  Profile: undefined;
};
