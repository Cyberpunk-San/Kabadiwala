// src/screens/OnboardingScreen.tsx — language → phone + OTP (simulated) → name.
import { Ionicons } from "@expo/vector-icons";
import { useRef, useState, type ComponentRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { AnimatedText, Text } from "../ui/Text";
import Animated, { FadeInDown, FadeInRight, FadeOutLeft, ZoomIn } from "react-native-reanimated";

import { colors, gradients, radius, space, type } from "../constants/theme";
import { useTranslation } from "../hooks/useTranslation";
import { ApiError, loginAny, registerCollector, registerCompany, registerHousehold, type CompanyProfile, type Role } from "../services/api/client";
import { getCurrentCoordinates } from "../services/location/gpsService";
import { useAppStore } from "../store/appStore";
import { useAuthStore } from "../store/authStore";
import type { Language } from "../types/domain";
import { toast } from "../ui/feedback";
import { Float, ProgressBar } from "../ui/motion";
import { Button, Chip, enter, GradientCard, type IconName, PressScale, Screen, textStyles } from "../ui/primitives";

import { P } from "../constants/palette";
const LANGUAGES: Array<{ id: Language; native: string; label: string }> = [
  { id: "hi", native: "हिन्दी", label: "Hindi" },
  { id: "mr", native: "मराठी", label: "Marathi" },
  { id: "en", native: "English", label: "English" },
];

const DEMO_OTP = "1234";

const ROLES: Array<{ id: Role; icon: IconName; title: "roleKabadiwala" | "roleHousehold" | "roleCompany"; hint: "roleKabadiwalaHint" | "roleHouseholdHint" | "roleCompanyHint"; color: string }> = [
  { id: "kabadiwala", icon: "bicycle", title: "roleKabadiwala", hint: "roleKabadiwalaHint", color: colors.primary },
  { id: "household", icon: "home", title: "roleHousehold", hint: "roleHouseholdHint", color: colors.orange },
  { id: "company", icon: "business", title: "roleCompany", hint: "roleCompanyHint", color: colors.info },
];

export function OnboardingScreen() {
  const { t, language } = useTranslation();
  const setLanguage = useAppStore((s) => s.setLanguage);
  const signIn = useAuthStore((s) => s.signIn);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState(false);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [role, setRole] = useState<Role>("kabadiwala");
  const [companyType, setCompanyType] = useState<CompanyProfile["company_type"]>("seller");
  const [busy, setBusy] = useState(false);
  const otpRef = useRef<ComponentRef<typeof TextInput>>(null);

  const digits = phone.replace(/\D/g, "").slice(-10);
  const normalizedPhone = `+91${digits}`;

  const sendOtp = () => {
    setOtpSent(true);
    setOtp("");
    toast.info(t("otpSent"));
    setTimeout(() => otpRef.current?.focus(), 250);
  };

  // Existing users skip the name step entirely.
  const verifyOtp = async () => {
    if (otp !== DEMO_OTP) {
      setOtpError(true);
      return;
    }
    setBusy(true);
    try {
      const result = await loginAny(normalizedPhone);
      const who = result.collector?.name ?? result.household?.name ?? result.company?.name ?? "";
      toast.success(t("welcomeBack", { name: who.split(" ")[0] ?? who }));
      await signIn(result);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setStep(3);
      else toast.error(t("serverDown"), t("serverDownMsg"));
    } finally {
      setBusy(false);
    }
  };

  const createAccount = async () => {
    setBusy(true);
    try {
      // Location helps match nearby kabadiwalas / buyers; skipped silently if denied.
      const loc = await getCurrentCoordinates().catch(() => undefined);
      const geo = loc ? { latitude: loc.latitude, longitude: loc.longitude } : {};
      if (role === "kabadiwala") {
        const collector = await registerCollector({ phone: normalizedPhone, name: name.trim(), language, operating_area: area.trim() || undefined, collection_radius_km: 10, ...geo });
        await signIn({ role, collector });
      } else if (role === "household") {
        const household = await registerHousehold({ phone: normalizedPhone, name: name.trim(), language, address: area.trim() || undefined, ...geo });
        await signIn({ role, household });
      } else {
        const company = await registerCompany({ phone: normalizedPhone, name: name.trim(), company_type: companyType, address: area.trim() || undefined, ...geo });
        await signIn({ role, company });
      }
    } catch (err) {
      toast.error(t("signupFailed"), err instanceof ApiError ? err.message : t("serverDownMsg"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Animated.View entering={enter(0)}>
        <GradientCard colorsList={gradients.hero} style={styles.hero}>
          <Float>
            <Animated.View entering={ZoomIn.delay(150).springify().damping(10)} style={styles.logo}>
              <Ionicons name="sync-outline" size={36} color={P("#A8E8C9")} />
            </Animated.View>
          </Float>
          <Text style={styles.brand}>Mai Hu Kabadiwala</Text>
          <Text style={styles.tagline}>{t("obTagline")}</Text>
          {step === 1 ? (
            <View style={{ gap: 8, marginTop: space.lg, alignSelf: "stretch" }}>
              {(["obFeature1", "obFeature2", "obFeature3"] as const).map((k, i) => (
                <Animated.View key={k} entering={FadeInDown.delay(300 + i * 120).springify()} style={styles.feature}>
                  <Ionicons name={(["sparkles", "shield-checkmark", "mic"] as const)[i]} size={16} color={P("#A8E8C9")} />
                  <Text style={styles.featureText}>{t(k)}</Text>
                </Animated.View>
              ))}
            </View>
          ) : null}
        </GradientCard>
      </Animated.View>

      <View style={{ marginVertical: space.xl }}>
        <ProgressBar progress={step / 3} height={6} />
      </View>

      {step === 1 && (
        <Animated.View key="s1" entering={FadeInRight.springify().damping(18)} exiting={FadeOutLeft}>
          <Text style={styles.stepTitle}>{t("chooseLanguage")}</Text>
          <View style={styles.langGrid}>
            {LANGUAGES.map((l, i) => {
              const on = language === l.id;
              return (
                <Animated.View key={l.id} entering={enter(i + 1)} style={{ flex: 1 }}>
                  <PressScale onPress={() => setLanguage(l.id)} style={[styles.langCard, on && styles.langCardOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                    {on ? (
                      <Animated.View entering={ZoomIn} style={styles.langCheck}>
                        <Ionicons name="checkmark" size={14} color={colors.white} />
                      </Animated.View>
                    ) : null}
                    <Text style={[styles.langNative, on && { color: colors.primary }]}>{l.native}</Text>
                    <Text style={styles.langLabel}>{l.label}</Text>
                  </PressScale>
                </Animated.View>
              );
            })}
          </View>
          <Button label={t("continue")} icon="arrow-forward" onPress={() => setStep(2)} style={{ marginTop: space.xl }} />
        </Animated.View>
      )}

      {step === 2 && (
        <Animated.View key="s2" entering={FadeInRight.springify().damping(18)} exiting={FadeOutLeft}>
          <Text style={styles.stepTitle}>{t("phoneTitle")}</Text>
          <View style={styles.phoneRow}>
            <View style={styles.cc}><Text style={styles.ccText}>🇮🇳 +91</Text></View>
            <TextInput
              style={styles.phoneInput}
              placeholder="98765 43210"
              placeholderTextColor={colors.faint}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(v) => { setPhone(v.replace(/\D/g, "")); setOtpSent(false); }}
              maxLength={10}
              autoFocus
              accessibilityLabel={t("phoneTitle")}
            />
          </View>

          {!otpSent ? (
            <Button label={t("sendOtp")} icon="chatbubble-ellipses" onPress={sendOtp} disabled={digits.length !== 10} style={{ marginTop: space.lg }} />
          ) : (
            <Animated.View entering={FadeInDown.springify()}>
              <Text style={[textStyles.small, { marginTop: space.xl, marginBottom: space.sm }]}>{t("enterOtp")}</Text>
              <PressScale haptic={false} onPress={() => otpRef.current?.focus()} style={styles.otpRow}>
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} style={[styles.otpBox, otp.length === i && styles.otpBoxActive, otpError && styles.otpBoxError]}>
                    <Text style={styles.otpDigit}>{otp[i] ?? ""}</Text>
                  </View>
                ))}
              </PressScale>
              <TextInput
                ref={otpRef}
                value={otp}
                onChangeText={(v) => { setOtp(v.replace(/\D/g, "").slice(0, 4)); setOtpError(false); }}
                keyboardType="number-pad"
                maxLength={4}
                style={styles.hiddenInput}
                accessibilityLabel={t("enterOtp")}
              />
              {otpError ? <AnimatedText entering={FadeInDown} style={styles.error}>{t("invalidOtp")}</AnimatedText> : null}
              <Button label={t("verify")} icon="checkmark-circle" onPress={verifyOtp} loading={busy} disabled={otp.length !== 4} style={{ marginTop: space.lg }} />
            </Animated.View>
          )}
          <Button label={t("back")} variant="ghost" icon="arrow-back" onPress={() => setStep(1)} style={{ marginTop: space.md }} />
        </Animated.View>
      )}

      {step === 3 && (
        <Animated.View key="s3" entering={FadeInRight.springify().damping(18)} exiting={FadeOutLeft}>
          <Text style={styles.stepTitle}>{t("roleTitle")}</Text>
          <View style={{ gap: space.sm, marginBottom: space.xl }}>
            {ROLES.map((r, i) => {
              const on = role === r.id;
              return (
                <Animated.View key={r.id} entering={enter(i)}>
                  <PressScale onPress={() => setRole(r.id)} style={[styles.roleCard, on && { borderColor: r.color, backgroundColor: colors.surface }]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                    <View style={[styles.roleIcon, { backgroundColor: on ? r.color : colors.surfaceAlt }]}>
                      <Ionicons name={r.icon} size={24} color={on ? colors.white : colors.muted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.roleTitle}>{t(r.title)}</Text>
                      <Text style={textStyles.small}>{t(r.hint)}</Text>
                    </View>
                    <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={22} color={on ? r.color : colors.faint} />
                  </PressScale>
                </Animated.View>
              );
            })}
          </View>

          {role === "company" ? (
            <Animated.View entering={FadeInDown.springify()} style={{ marginBottom: space.lg }}>
              <Text style={[textStyles.small, { marginBottom: space.sm }]}>{t("companyType")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                <Chip label={t("typeSeller")} active={companyType === "seller"} onPress={() => setCompanyType("seller")} icon="cube" />
                <Chip label={t("typeBuyer")} active={companyType === "buyer"} onPress={() => setCompanyType("buyer")} icon="cart" />
                <Chip label={t("typeBoth")} active={companyType === "both"} onPress={() => setCompanyType("both")} icon="swap-horizontal" />
              </View>
            </Animated.View>
          ) : null}

          <TextInput style={styles.input} placeholder={role === "company" ? t("companyName") : t("yourName")} placeholderTextColor={colors.faint} value={name} onChangeText={setName} maxLength={60} autoFocus accessibilityLabel={t("yourName")} />
          <TextInput style={[styles.input, { marginTop: space.md }]} placeholder={role === "kabadiwala" ? t("area") : t("address")} placeholderTextColor={colors.faint} value={area} onChangeText={setArea} maxLength={80} accessibilityLabel={t("area")} />
          <Button label={t("createAccount")} icon="rocket" onPress={createAccount} loading={busy} disabled={name.trim().length < 2} style={{ marginTop: space.xl }} />
          <Button label={t("changePhone")} variant="ghost" icon="arrow-back" onPress={() => setStep(2)} style={{ marginTop: space.md }} />
        </Animated.View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingVertical: space.xxl },
  logo: { width: 84, height: 84, borderRadius: 28, backgroundColor: P("rgba(255,255,255,0.14)"), alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: P("rgba(255,255,255,0.25)") },
  brand: { ...type.h1, color: P("#F8FAF7"), marginTop: space.lg },
  tagline: { marginTop: 4, fontSize: 15, color: P("#A8E8C9"), fontWeight: "600" },
  feature: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: radius.md, backgroundColor: P("rgba(255,255,255,0.08)") },
  featureText: { flex: 1, color: P("#F8FAF7"), fontSize: 13, fontWeight: "600" },

  stepTitle: { ...type.h2, color: colors.ink, marginBottom: space.lg },
  langGrid: { flexDirection: "row", gap: space.sm },
  langCard: { alignItems: "center", paddingVertical: space.xl, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.line },
  langCardOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  langCheck: { position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  langNative: { fontSize: 20, fontWeight: "800", color: colors.ink },
  langLabel: { marginTop: 4, fontSize: 12, color: colors.muted, fontWeight: "600" },

  phoneRow: { flexDirection: "row", gap: space.sm },
  cc: { paddingHorizontal: 14, justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line },
  ccText: { fontSize: 16, fontWeight: "700", color: colors.ink },
  phoneInput: { flex: 1, fontSize: 22, fontWeight: "800", letterSpacing: 1.5, color: colors.ink, paddingHorizontal: 16, paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line },
  otpRow: { flexDirection: "row", gap: space.md, justifyContent: "center" },
  otpBox: { width: 60, height: 66, borderRadius: radius.md, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  otpBoxActive: { borderColor: colors.primary },
  otpBoxError: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  otpDigit: { fontSize: 28, fontWeight: "800", color: colors.ink },
  hiddenInput: { position: "absolute", opacity: 0, height: 1, width: 1 },
  error: { marginTop: space.sm, color: colors.danger, fontWeight: "700", textAlign: "center" },
  roleCard: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface },
  roleIcon: { width: 50, height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  roleTitle: { fontSize: 16, fontWeight: "800", color: colors.ink },
  input: { fontSize: 17, fontWeight: "600", color: colors.ink, paddingHorizontal: 16, paddingVertical: 15, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line },
});
