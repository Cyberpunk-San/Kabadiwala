// src/screens/SettingsScreen.tsx — account, location, language, accessibility, log out.
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { colors, dark as D, radius, space } from "../constants/theme";
import { useTranslation } from "../hooks/useTranslation";
import { go, goBack } from "../navigation/ref";
import { updateCollector } from "../services/api/client";
import { getCurrentCoordinates } from "../services/location/gpsService";
import { useAppStore } from "../store/appStore";
import { useAuthStore } from "../store/authStore";
import type { Language } from "../types/domain";
import { THEME_MODE, THEME_PREF, setThemePref, type ThemePref } from "../constants/themeMode";
import { dialog, Sheet, toast } from "../ui/feedback";
import { Card, ListRow, Screen, TopBar } from "../ui/primitives";
import { Text } from "../ui/Text";

const LANGS: Array<{ id: Language; label: string }> = [
  { id: "hi", label: "हिंदी" },
  { id: "mr", label: "मराठी" },
  { id: "en", label: "English" },
];

export function SettingsScreen() {
  const { t, language } = useTranslation();
  const setLanguage = useAppStore((s) => s.setLanguage);
  const resetForSignOut = useAppStore((s) => s.resetForSignOut);
  const collector = useAuthStore((s) => s.collector);
  const setCollector = useAuthStore((s) => s.setCollector);
  const signOut = useAuthStore((s) => s.signOut);
  const [langOpen, setLangOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const THEMES: Array<{ id: ThemePref; label: string; icon: "moon-outline" | "sunny-outline" | "phone-portrait-outline" }> = [
    { id: "dark", label: t("themeDark"), icon: "moon-outline" },
    { id: "light", label: t("themeLight"), icon: "sunny-outline" },
    { id: "system", label: t("themeSystem"), icon: "phone-portrait-outline" },
  ];
  const [locating, setLocating] = useState(false);

  const chooseLanguage = async (lang: Language) => {
    setLangOpen(false);
    setLanguage(lang);
    if (collector) {
      try {
        await setCollector(await updateCollector(collector.id, { language: lang }));
      } catch {
        // Saved on the phone; the server copy updates next time.
      }
    }
  };

  const refreshLocation = async () => {
    setLocating(true);
    try {
      const loc = await getCurrentCoordinates();
      if (!loc) return toast.warn(t("locationDenied"));
      if (collector) await setCollector(await updateCollector(collector.id, { latitude: loc.latitude, longitude: loc.longitude }));
      toast.success(t("locationSet"));
    } catch {
      toast.error(t("serverDown"), t("serverDownMsg"));
    } finally {
      setLocating(false);
    }
  };

  const logOut = () =>
    dialog.show({
      icon: "log-out-outline",
      tone: "danger",
      title: t("logOutConfirm"),
      message: t("logOutMsg"),
      actions: [
        { label: t("logOut"), variant: "danger", onPress: () => void resetForSignOut().then(signOut) },
        { label: t("cancel"), variant: "secondary" },
      ],
    });

  return (
    <Screen dark>
      <TopBar title={t("settings")} onBack={goBack} />

      <Text style={styles.group}>{t("sAccount")}</Text>
      <Card style={styles.card}>
        {collector ? (
          <ListRow
            icon="shield-checkmark-outline"
            title={t("sIdentity")}
            value={collector.kyc_status === "VERIFIED" ? t("verified") : t("pending")}
            onPress={collector.kyc_status === "VERIFIED" ? undefined : () => go("Kyc")}
          />
        ) : null}
        <ListRow icon="location-outline" title={t("sLocation")} value={locating ? t("loading") : collector?.operating_area ?? undefined} onPress={refreshLocation} />
        <ListRow icon="language-outline" title={t("language")} value={LANGS.find((l) => l.id === language)?.label} onPress={() => setLangOpen(true)} />
        <ListRow icon={THEME_MODE === "light" ? "sunny-outline" : "moon-outline"} title={t("appearance")} value={THEMES.find((x) => x.id === THEME_PREF)?.label} onPress={() => setThemeOpen(true)} />
        <ListRow icon="notifications-outline" title={t("notifications")} onPress={() => go("Notifications")} last />
      </Card>

      <Text style={styles.group}>{t("accessibility")}</Text>
      <Card style={styles.card}>
        <ListRow icon="accessibility-outline" title={t("a11yTitle")} onPress={() => go("Accessibility")} last />
      </Card>

      <Text style={styles.group}>{t("sAbout")}</Text>
      <Card style={styles.card}>
        <ListRow icon="help-circle-outline" title={t("sHelp")} onPress={() => go("Assistant")} />
        <ListRow icon="information-circle-outline" title="Mai Hu Kabadiwala" value={t("version", { v: Constants.expoConfig?.version ?? "1.0.0" })} last />
      </Card>

      <Card style={[styles.card, { marginTop: space.xl }]}>
        <ListRow icon="log-out-outline" title={t("logOut")} onPress={logOut} danger last />
      </Card>

      <Sheet visible={langOpen} onClose={() => setLangOpen(false)} title={t("chooseLanguage")}>
        <View style={{ paddingBottom: space.sm }}>
          {LANGS.map((l, i) => (
            <ListRow
              key={l.id}
              title={l.label}
              onPress={() => void chooseLanguage(l.id)}
              right={l.id === language ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : <View />}
              last={i === LANGS.length - 1}
            />
          ))}
        </View>
      </Sheet>

      <Sheet visible={themeOpen} onClose={() => setThemeOpen(false)} title={t("appearance")}>
        <View style={{ paddingBottom: space.sm }}>
          {THEMES.map((x, i) => (
            <ListRow
              key={x.id}
              icon={x.icon}
              title={x.label}
              onPress={() => {
                setThemeOpen(false);
                if (x.id !== THEME_PREF) setThemePref(x.id);
              }}
              right={x.id === THEME_PREF ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : <View />}
              last={i === THEMES.length - 1}
            />
          ))}
          <Text style={styles.themeNote}>{t("themeNote")}</Text>
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  themeNote: { fontSize: 13, lineHeight: 18, color: colors.inkSoft, marginTop: space.sm, paddingHorizontal: space.xs },
  group: { fontSize: 13, fontWeight: "500", color: D.inkSoft, marginTop: space.lg, marginBottom: space.sm },
  card: { paddingVertical: 0, borderRadius: radius.lg },
});
