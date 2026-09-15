import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { ActivityIndicator, StatusBar, StyleSheet, Text, View } from "react-native";
import { PaperProvider } from "react-native-paper";

import { colors, paperTheme } from "./src/constants/theme";
import type { RootTabParamList } from "./src/navigation/types";
import { CollectScreen } from "./src/screens/CollectScreen";
import { EarningsScreen } from "./src/screens/EarningsScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { MarketScreen } from "./src/screens/MarketScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { useAppStore } from "./src/store/appStore";

const Tab = createBottomTabNavigator<RootTabParamList>();

function AppNavigator() {
  const hydrate = useAppStore((state) => state.hydrate);
  const isHydrated = useAppStore((state) => state.isHydrated);

  useEffect(() => { void hydrate(); }, [hydrate]);
  if (!isHydrated) return <View style={styles.loading}><ActivityIndicator size="large" color={colors.green} /></View>;

  return <NavigationContainer>
    <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: colors.green,
      tabBarInactiveTintColor: "#87988F",
      tabBarStyle: { height: 65, paddingTop: 6, borderTopColor: "#E5EAE5", backgroundColor: colors.white },
      tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
      tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>{iconFor(route.name)}</Text>
    })}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: "Home" }} />
      <Tab.Screen name="Collect" component={CollectScreen} options={{ title: "Collect" }} />
      <Tab.Screen name="Market" component={MarketScreen} options={{ title: "Market" }} />
      <Tab.Screen name="Earnings" component={EarningsScreen} options={{ title: "Earnings" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </Tab.Navigator>
  </NavigationContainer>;
}

function iconFor(route: keyof RootTabParamList) {
  const icons: Record<keyof RootTabParamList, string> = {
    Home: "⌂",
    Collect: "⌑",
    Market: "▱",
    Earnings: "▥",
    Profile: "◯"
  };
  return icons[route];
}

export default function App() {
  const queryClient = useMemo(() => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } }), []);
  return <PaperProvider theme={paperTheme}><QueryClientProvider client={queryClient}><AppNavigator /></QueryClientProvider></PaperProvider>;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream }, tabIcon: { fontSize: 19, fontWeight: "700" } });
