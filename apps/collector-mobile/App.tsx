// App.tsx
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { PaperProvider } from "react-native-paper";

import { colors, paperTheme } from "./src/constants/theme";
import { config } from "./src/constants/config";
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

function RoleSelectionScreen({ onSelect }: { onSelect: (role: "collector" | "recycler") => void }) {
  const openRecyclerPortal = async () => {
    try {
      await Linking.openURL(config.recyclerWebUrl);
    } catch {
      Alert.alert("Recycler portal", `Open this address in a browser:\n${config.recyclerWebUrl}`);
    }
  };

  return (
    <View style={styles.roleScreen}>
      <Text style={styles.roleBrand}>♻ Mai Hu Kabadiwala</Text>
      <Text style={styles.roleTitle}>Aap kaun hain?</Text>
      <Text style={styles.roleSubtitle}>Apna role choose karke shuru karein</Text>

      <TouchableOpacity style={styles.roleCard} onPress={() => onSelect("collector")}>
        <Text style={styles.roleIcon}>🛺</Text>
        <View style={styles.roleCopy}>
          <Text style={styles.roleCardTitle}>Kabadiwala / Collector</Text>
          <Text style={styles.roleCardText}>Scrap collect karein, price dekhein aur buyer ko handover karein.</Text>
        </View>
        <Text style={styles.roleArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.roleCard} onPress={openRecyclerPortal}>
        <Text style={styles.roleIcon}>🏭</Text>
        <View style={styles.roleCopy}>
          <Text style={styles.roleCardTitle}>Recycler / Buyer</Text>
          <Text style={styles.roleCardText}>Recycler web portal kholen aur lots verify karein.</Text>
        </View>
        <Text style={styles.roleArrow}>›</Text>
      </TouchableOpacity>

      <Text style={styles.roleHint}>Recycler portal: {config.recyclerWebUrl}</Text>
    </View>
  );
}

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
  const [selectedRole, setSelectedRole] = useState<"collector" | "recycler" | null>(null);

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

  const needsOnboarding = !collector && selectedRole === "collector";
  const needsKyc = collector && collector.kyc_status !== "VERIFIED";

  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />
      <View style={{ flex: 1 }}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!collector && !selectedRole ? (
            <Stack.Screen name="Onboarding">
              {() => <RoleSelectionScreen onSelect={setSelectedRole} />}
            </Stack.Screen>
          ) : needsOnboarding ? (
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

        {collector && !needsKyc && <FloatingVoiceButton />}
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
  roleScreen: {
    flex: 1,
    backgroundColor: colors.cream,
    padding: 24,
    justifyContent: "center",
  },
  roleBrand: { color: colors.green, fontSize: 18, fontWeight: "900", marginBottom: 34 },
  roleTitle: { color: colors.ink, fontSize: 30, fontWeight: "900" },
  roleSubtitle: { color: colors.muted, fontSize: 14, marginTop: 8, marginBottom: 24 },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2EAE3",
  },
  roleIcon: { fontSize: 28, marginRight: 14 },
  roleCopy: { flex: 1 },
  roleCardTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  roleCardText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  roleArrow: { color: colors.green, fontSize: 28, marginLeft: 8 },
  roleHint: { color: colors.muted, fontSize: 10, textAlign: "center", marginTop: 14 },
  tabIcon: { fontSize: 16, fontWeight: "800" },
});
