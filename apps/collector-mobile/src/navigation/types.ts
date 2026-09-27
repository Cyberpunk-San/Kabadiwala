// src/navigation/types.ts
import type { NavigatorScreenParams } from "@react-navigation/native";

import type { Material } from "../types/domain";

export type MarketParams = {
  material?: Material;
  quality?: "low" | "medium" | "high";
  weightKg?: number;
  imageUri?: string;
  /** All photos of the lot; imageUri is the first. */
  imageUris?: string[];
  /** Sell an existing lot (e.g. one created by a completed pickup) instead of a new one. */
  lotId?: string;
};

/** Kabadiwala tabs. */
export type RootTabParamList = {
  Home: undefined;
  Market: MarketParams | undefined;
  Collect: { prefillMaterial?: Material; prefillWeightKg?: number } | undefined;
  Earnings: undefined;
  Profile: undefined;
};

/** Household / company tabs. */
export type CustomerTabParamList = {
  CustomerHome: undefined;
  Request: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Kyc: undefined;
  Tabs: NavigatorScreenParams<RootTabParamList> | undefined;
  CustomerTabs: NavigatorScreenParams<CustomerTabParamList> | undefined;
  Handover: { lotId: string };
  BazarBhav: undefined;
  Opportunity: undefined;
  Regional: undefined;
  MaterialDetail: { material: Material };
  Search: undefined;
  Notifications: undefined;
  Settings: undefined;
  Demands: undefined;
  Pickups: undefined;
  PickupDetail: { pickupId: string };
  Assistant: { prompt?: string } | undefined;
  Accessibility: undefined;
};

