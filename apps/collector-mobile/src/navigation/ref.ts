// src/navigation/ref.ts — navigate from anywhere (tab screens, stack screens, voice FAB, assistant actions).
import { createNavigationContainerRef } from "@react-navigation/native";

import type { CustomerTabParamList, RootStackParamList, RootTabParamList } from "./types";

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function goTab<K extends keyof RootTabParamList>(screen: K, params?: RootTabParamList[K]) {
  if (!navigationRef.isReady()) return;
  // Cast: NavigatorScreenParams' union form is hard for TS to infer from a generic key.
  navigationRef.navigate("Tabs", { screen, params } as never);
}

export function go<K extends Exclude<keyof RootStackParamList, "Tabs" | "CustomerTabs">>(screen: K, ...params: undefined extends RootStackParamList[K] ? [RootStackParamList[K]?] : [RootStackParamList[K]]) {
  if (!navigationRef.isReady()) return;
  (navigationRef.navigate as (s: string, p?: unknown) => void)(screen, params[0]);
}

export function goCustomerTab<K extends keyof CustomerTabParamList>(screen: K) {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate("CustomerTabs", { screen } as never);
}

export function goBack() {
  if (!navigationRef.isReady()) return;
  if (navigationRef.canGoBack()) navigationRef.goBack();
  // Households/companies have their own tabs — there is no kabadiwala "Home".
  else if (navigationRef.getRootState()?.routeNames.includes("CustomerTabs")) goCustomerTab("CustomerHome");
  else goTab("Home");
}

// Dev-only (web): lets automated visual checks open any screen directly. Not present in production builds.
if (__DEV__ && typeof window !== "undefined") {
  (window as unknown as { __mhkNav?: typeof navigationRef }).__mhkNav = navigationRef;
}
