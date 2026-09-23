// App.tsx
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { ActivityIndicator, StatusBar, StyleSheet, Text, View } from "react-native";
import { PaperProvider } from "react-native-paper";

import { colors, paperTheme } from "./src/constants/theme";
import { FloatingVoiceButton } from "./src/components/FloatingVoiceButton";
import type { RootStackParamList, RootTabParamList } from "./src/navigation/types";
import { AccessibilitySettingsScreen } from "./src/screens/AccessibilitySettingsScreen";
import { BazarBhavScreen } from "./src/screens/BazarBhavScreen";
import { CollectScreen } from "./src/screens/CollectScreen";
import { DemandsScreen } from "./src/screens/DemandsScreen";
import { EarningsScreen } from "./src/screens/EarningsScreen";
import { HandoverScreen } from "./src/screens/HandoverScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { KycScreen } from "./src/screens/KycScreen";
import { MarketScreen } from "./src/screens/MarketScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { OpportunityScreen } from "./src/screens/OpportunityScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { useAccessibilityStore } from "./src/store/accessibilityStore";
import { useAppStore } from "./src/store/appStore";
import { useAuthStore } from "./src/store/authStore";

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: "#87988F",
        tabBarStyle: {
          height: 68,
          paddingTop: 6,
          borderTopColor: "#E5EAE5",
          backgroundColor: colors.white,
        },
        tabBarLabelStyle: { fontSize: 9, fontWeight: "700" },
        tabBarIcon: ({ color }) => (
          <Text style={[styles.tabIcon, { color }]}>{iconFor(route.name)}</Text>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: "Home" }} />
      <Tab.Screen name="Opportunity" component={OpportunityScreen} options={{ title: "Opportunity" }} />
      <Tab.Screen name="Demands" component={DemandsScreen} options={{ title: "Demands" }} />
      <Tab.Screen name="Collect" component={CollectScreen} options={{ title: "Collect" }} />
      <Tab.Screen name="Market" component={MarketScreen} options={{ title: "Market" }} />
      <Tab.Screen name="BazarBhav" component={BazarBhavScreen} options={{ title: "Bhav" }} />
      <Tab.Screen name="Earnings" component={EarningsScreen} options={{ title: "Earnings" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const hydrateApp = useAppStore((s) => s.hydrate);
  const isAppHydrated = useAppStore((s) => s.isHydrated);

  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const isAuthHydrated = useAuthStore((s) => s.isHydrated);
  const collector = useAuthStore((s) => s.collector);

  const hydrateAccessibility = useAccessibilityStore((s) => s.hydrate);
  const isAccessibilityHydrated = useAccessibilityStore((s) => s.isHydrated);

  useEffect(() => { void hydrateApp(); }, [hydrateApp]);
  useEffect(() => { void hydrateAuth(); }, [hydrateAuth]);
  useEffect(() => { void hydrateAccessibility(); }, [hydrateAccessibility]);

  if (!isAppHydrated || !isAuthHydrated || !isAccessibilityHydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  const needsOnboarding = !collector;
  const needsKyc = collector && collector.kyc_status !== "VERIFIED";

  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />
      <View style={{ flex: 1 }}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {needsOnboarding ? (
            <Stack.Screen name="Onboarding">
              {() => <OnboardingScreen onComplete={() => {}} />}
            </Stack.Screen>
          ) : needsKyc ? (
            <Stack.Screen name="Kyc">
              {() => <KycScreen onComplete={() => {}} />}
            </Stack.Screen>
          ) : (
            <>
              <Stack.Screen name="Tabs" component={MainTabNavigator} />
              <Stack.Screen name="Handover" component={HandoverScreen} />
              <Stack.Screen name="BazarBhav" component={BazarBhavScreen} />
              <Stack.Screen name="Accessibility" component={AccessibilitySettingsScreen} />
            </>
          )}
        </Stack.Navigator>

        {!needsOnboarding && !needsKyc && <FloatingVoiceButton />}
      </View>
    </NavigationContainer>
  );
}

function iconFor(route: keyof RootTabParamList) {
  const icons: Partial<Record<keyof RootTabParamList, string>> = {
    Home: "⌂",
    Opportunity: "◎",
    Demands: "◫",
    Collect: "⌑",
    Market: "▱",
    BazarBhav: "₹",
    Earnings: "▥",
    Profile: "◯",
  };
  return icons[route] || "●";
}

export default function App() {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      }),
    []
  );

  return (
    <PaperProvider theme={paperTheme}>
      <QueryClientProvider client={queryClient}>
        <AppNavigator />
      </QueryClientProvider>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream,
  },
  tabIcon: { fontSize: 16, fontWeight: "800" },
});