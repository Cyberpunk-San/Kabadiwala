// App.tsx
import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { Mukta_400Regular, Mukta_500Medium, Mukta_600SemiBold, Mukta_700Bold } from "@expo-google-fonts/mukta";
import { useFonts } from "expo-font";
import { AppFrame } from "./src/ui/frame";
import { useLivePrices } from "./src/hooks/useLivePrices";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "./src/ui/Text";
import { PaperProvider } from "react-native-paper";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { FloatingVoiceButton } from "./src/components/FloatingVoiceButton";
import { colors, fonts, paperTheme } from "./src/constants/theme";
import { CinematicBackdrop, RingLogo } from "./src/ui/backdrop";

/** Product wordmark (one place to change the brand name). */
const APP_NAME = "Mai Hu Kabadiwala";
import { navigationRef } from "./src/navigation/ref";
import type { CustomerTabParamList, RootStackParamList, RootTabParamList } from "./src/navigation/types";
import { AccessibilitySettingsScreen } from "./src/screens/AccessibilitySettingsScreen";
import { AssistantScreen } from "./src/screens/AssistantScreen";
import { BazarBhavScreen } from "./src/screens/BazarBhavScreen";
import { CollectScreen } from "./src/screens/CollectScreen";
import { CustomerHomeScreen } from "./src/screens/CustomerHomeScreen";
import { DemandsScreen } from "./src/screens/DemandsScreen";
import { EarningsScreen } from "./src/screens/EarningsScreen";
import { HandoverScreen } from "./src/screens/HandoverScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { KycScreen } from "./src/screens/KycScreen";
import { MarketScreen } from "./src/screens/MarketScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { OpportunityScreen } from "./src/screens/OpportunityScreen";
import { PickupDetailScreen } from "./src/screens/PickupDetailScreen";
import { PickupsScreen } from "./src/screens/PickupsScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { MaterialDetailScreen } from "./src/screens/MaterialDetailScreen";
import { NotificationsScreen } from "./src/screens/NotificationsScreen";
import { RegionalScreen } from "./src/screens/RegionalScreen";
import { SearchScreen } from "./src/screens/SearchScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { RequestPickupScreen } from "./src/screens/RequestPickupScreen";
import { useAccessibilityStore } from "./src/store/accessibilityStore";
import { startSyncLoop, useAppStore } from "./src/store/appStore";
import { useAuthStore } from "./src/store/authStore";
import { DialogHost, ToastHost } from "./src/ui/feedback";
import { TabBar } from "./src/ui/TabBar";

import { isLight } from "./src/constants/themeMode";
import { P } from "./src/constants/palette";
const Tab = createBottomTabNavigator<RootTabParamList>();
const CustomerTab = createBottomTabNavigator<CustomerTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.primary } };

function MainTabs() {
  return (
    <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, animation: "fade" }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Market" component={MarketScreen} />
      <Tab.Screen name="Collect" component={CollectScreen} />
      <Tab.Screen name="Earnings" component={EarningsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

/** Households and companies: request pickups, track them, profile. */
function CustomerTabs() {
  return (
    <CustomerTab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, animation: "fade" }}>
      <CustomerTab.Screen name="CustomerHome" component={CustomerHomeScreen} />
      <CustomerTab.Screen name="Request" component={RequestPickupScreen} />
      <CustomerTab.Screen name="Profile" component={ProfileScreen} />
    </CustomerTab.Navigator>
  );
}

/** Launch screen: the cinematic environment, a glowing ring and restrained type. */
function Splash() {
  return (
    <View style={styles.splash}>
      <StatusBar style={isLight ? "dark" : "light"} />
      <CinematicBackdrop />
      <Animated.View entering={FadeIn.duration(900)} style={styles.splashCenter}>
        <RingLogo size={84} />
        <Animated.Text entering={FadeInDown.delay(350).duration(700)} style={styles.splashTitle}>{APP_NAME}</Animated.Text>
        <Animated.Text entering={FadeInDown.delay(500).duration(700)} style={styles.splashSub}>मैं हूँ कबाड़ीवाला</Animated.Text>
      </Animated.View>
      <Animated.Text entering={FadeIn.delay(900).duration(800)} style={styles.splashFoot}>Collect smarter. Earn more.</Animated.Text>
    </View>
  );
}

function AppNavigator() {
  const hydrateApp = useAppStore((s) => s.hydrate);
  const isAppHydrated = useAppStore((s) => s.isHydrated);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const isAuthHydrated = useAuthStore((s) => s.isHydrated);
  const role = useAuthStore((s) => s.role);
  const collector = useAuthStore((s) => s.collector);
  const hydrateAccessibility = useAccessibilityStore((s) => s.hydrate);
  // Today's prices for where the user is (live metals / city rate cards + nearby industry).
  useLivePrices();
  const isAccessibilityHydrated = useAccessibilityStore((s) => s.isHydrated);

  useEffect(() => {
    void hydrateApp();
    void hydrateAuth();
    void hydrateAccessibility();
  }, [hydrateApp, hydrateAuth, hydrateAccessibility]);

  // Background sync: health check, offline queue flush, server lot refresh.
  const collectorId = collector?.id;
  useEffect(() => {
    if (!collectorId || !isAppHydrated) return;
    return startSyncLoop(() => useAuthStore.getState().collector?.id);
  }, [collectorId, isAppHydrated]);

  // A returning user on a fresh install gets their saved language.
  const collectorLanguage = collector?.language;
  useEffect(() => {
    if (collectorLanguage && isAppHydrated) setLanguage(collectorLanguage);
    // Only when the logged-in account changes, not on every language switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectorId, isAppHydrated]);

  if (!isAppHydrated || !isAuthHydrated || !isAccessibilityHydrated) return <Splash />;

  // Any signed-in role skips onboarding; only kabadiwalas need KYC.
  const needsOnboarding = !role;
  const needsKyc = role === "kabadiwala" && collector?.kyc_status !== "VERIFIED";
  const isCustomer = role === "household" || role === "company";

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <StatusBar style={isLight ? "dark" : "light"} />
      <View style={{ flex: 1 }}>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: colors.bg } }}>
          {needsOnboarding ? (
            <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: "fade" }} />
          ) : needsKyc ? (
            <Stack.Screen name="Kyc" component={KycScreen} options={{ animation: "fade" }} />
          ) : (
            <>
              {isCustomer ? (
                <Stack.Screen name="CustomerTabs" component={CustomerTabs} options={{ animation: "fade" }} />
              ) : (
                <Stack.Screen name="Tabs" component={MainTabs} options={{ animation: "fade" }} />
              )}
              <Stack.Screen name="Handover" component={HandoverScreen} options={{ animation: "fade_from_bottom" }} />
              <Stack.Screen name="BazarBhav" component={BazarBhavScreen} />
              <Stack.Screen name="Opportunity" component={OpportunityScreen} />
              <Stack.Screen name="Regional" component={RegionalScreen} />
              <Stack.Screen name="MaterialDetail" component={MaterialDetailScreen} />
              <Stack.Screen name="Search" component={SearchScreen} options={{ animation: "fade_from_bottom" }} />
              <Stack.Screen name="Notifications" component={NotificationsScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="Demands" component={DemandsScreen} />
              <Stack.Screen name="Pickups" component={PickupsScreen} />
              <Stack.Screen name="PickupDetail" component={PickupDetailScreen} />
              <Stack.Screen name="Assistant" component={AssistantScreen} options={{ animation: "fade_from_bottom" }} />
              <Stack.Screen name="Accessibility" component={AccessibilitySettingsScreen} />
            </>
          )}
        </Stack.Navigator>
        {!needsOnboarding && !needsKyc && !isCustomer ? <FloatingVoiceButton /> : null}
      </View>
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    Mukta_400Regular, Mukta_500Medium, Mukta_600SemiBold, Mukta_700Bold,
  });
  const queryClient = useMemo(
    // networkMode "always": with no signal, requests fail fast so screens fall back to on-device
    // data or show Retry — instead of React Query pausing them and leaving blank/empty screens.
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, networkMode: "always" }, mutations: { networkMode: "always" } } }),
    []
  );

  // Blank paper until the typefaces arrive (a flash of system font would break the print look).
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <QueryClientProvider client={queryClient}>
          <AppFrame>
            <AppNavigator />
            <ToastHost />
            <DialogHost />
          </AppFrame>
        </QueryClientProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: P("#030907") },
  splashCenter: { alignItems: "center" },
  splashTitle: { marginTop: 36, fontFamily: fonts.semibold, fontSize: 26, letterSpacing: -0.6, color: P("#F8FAF7") },
  splashSub: { marginTop: 6, fontFamily: fonts.body, fontSize: 15, letterSpacing: 0.2, color: P("rgba(248,250,247,0.55)") },
  splashFoot: { position: "absolute", bottom: 56, fontFamily: fonts.medium, fontSize: 13, letterSpacing: 0.4, color: P("rgba(248,250,247,0.38)") },
});

