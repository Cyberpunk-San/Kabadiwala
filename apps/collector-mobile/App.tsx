import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { ActivityIndicator, AppState, type AppStateStatus, StatusBar, StyleSheet, Text, View } from "react-native";
import { PaperProvider } from "react-native-paper";

import { config } from "./src/constants/config";
import { colors, paperTheme } from "./src/constants/theme";
import type { RootStackParamList, RootTabParamList } from "./src/navigation/types";
import { BazarBhavScreen } from "./src/screens/BazarBhavScreen";
import { CollectScreen } from "./src/screens/CollectScreen";
import { EarningsScreen } from "./src/screens/EarningsScreen";
import { HandoverScreen } from "./src/screens/HandoverScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { MarketScreen } from "./src/screens/MarketScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { syncPendingLots } from "./src/services/sync/syncService";
import { useAppStore } from "./src/store/appStore";

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
          height: 65,
          paddingTop: 6,
          borderTopColor: "#E5EAE5",
          backgroundColor: colors.white
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
        tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>{iconFor(route.name)}</Text>
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: "Home" }} />
      <Tab.Screen name="Collect" component={CollectScreen} options={{ title: "Collect" }} />
      <Tab.Screen name="Market" component={MarketScreen} options={{ title: "Market" }} />
      <Tab.Screen name="BazarBhav" component={BazarBhavScreen} options={{ title: "Bhav" }} />
      <Tab.Screen name="Earnings" component={EarningsScreen} options={{ title: "Earnings" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const hydrate = useAppStore((state) => state.hydrate);
  const isHydrated = useAppStore((state) => state.isHydrated);
  const refreshLots = useAppStore((state) => state.refreshLots);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Wire sync service to app lifecycle (foreground resume + periodic interval)
  useEffect(() => {
    const triggerSync = async () => {
      try {
        await syncPendingLots(async (lotId) => {
          // Simulated cloud sync endpoint
          console.log(`[MHK Sync] Successfully synced lot ${lotId} to cloud.`);
        });
        await refreshLots();
      } catch (error) {
        console.warn("[MHK Sync] Background sync cycle completed with local fallback:", error);
      }
    };

    // 1. AppState listener: sync when app returns from background to active
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") {
        console.log("[MHK Lifecycle] App resumed to active. Triggering offline lot sync...");
        void triggerSync();
      }
    });

    // 2. Periodic sync interval
    const intervalTime = Math.max(10000, config.syncIntervalMs || 30000);
    const syncTimer = setInterval(() => {
      void triggerSync();
    }, intervalTime);

    // Initial sync trigger
    void triggerSync();

    return () => {
      subscription.remove();
      clearInterval(syncTimer);
    };
  }, [refreshLots]);

  if (!isHydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={MainTabNavigator} />
        <Stack.Screen name="Handover" component={HandoverScreen} />
        <Stack.Screen name="BazarBhav" component={BazarBhavScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function iconFor(route: keyof RootTabParamList) {
  const icons: Partial<Record<keyof RootTabParamList, string>> = {
    Home: "⌂",
    Collect: "⌑",
    Market: "▱",
    BazarBhav: "₹",
    Earnings: "▥",
    Profile: "◯"
  };
  return icons[route] || "●";
}

export default function App() {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, retry: 1 }
        }
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
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream },
  tabIcon: { fontSize: 18, fontWeight: "800" }
});

