// src/screens/OnboardingScreen.tsx
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { colors } from "../constants/theme";
import { registerCollector, loginCollector } from "../services/api/client";
import { useAuthStore } from "../store/authStore";
import type { Language } from "../types/domain";

type Props = {
  onComplete: () => void;
};

const LANGUAGES: Array<{ id: Language; native: string; label: string }> = [
  { id: "hi", native: "हिन्दी",   label: "Hindi"   },
  { id: "mr", native: "मराठी",   label: "Marathi" },
  { id: "en", native: "English", label: "English" },
];

export function OnboardingScreen({ onComplete }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [language, setLanguage] = useState<Language>("hi");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [operatingArea, setOperatingArea] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const setCollector = useAuthStore((s) => s.setCollector);

  const digits = phone.replace(/\D/g, "");
  const canSendOtp = digits.length >= 10;
  const canVerifyOtp = otp.replace(/\D/g, "").length === 4;
  const canFinish = name.trim().length >= 2;

  const handleSendOtp = () => {
    // Simulated OTP — always 1234
    Alert.alert(
      "OTP sent (simulated)",
      `A 4-digit code was sent to +91${digits.slice(-10)}.\n\nFor this demo, the OTP is always 1234.`,
      [{ text: "Got it", onPress: () => setStep(2) }]
    );
  };

  const handleVerifyOtp = () => {
    if (otp !== "1234") {
      Alert.alert("Invalid OTP", "For this demo, the OTP is always 1234.");
      return;
    }
    setStep(3);
  };

  const handleFinish = async () => {
    if (!canFinish) return;
    setIsBusy(true);
    try {
      const normalizedPhone = phone.startsWith("+") ? phone : `+91${digits.slice(-10)}`;

      let profile;
      try {
        // Existing collector?
        profile = await loginCollector(normalizedPhone);
      } catch {
        // New collector — register
        profile = await registerCollector({
          phone: normalizedPhone,
          name: name.trim(),
          language,
          operating_area: operatingArea.trim() || undefined,
          collection_radius_km: 10,
        });
      }
      await setCollector(profile);
      onComplete();
    } catch (err: any) {
      Alert.alert(
        "Signup failed",
        err?.message ?? "Could not reach the backend. Is the server running?"
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.brand}>♻ Mai Hu Kabadiwala</Text>
        <Text style={styles.subtitle}>
          {step === 1 ? "Choose your language" :
           step === 2 ? "Verify your phone" :
           "Tell us about yourself"}
        </Text>
      </View>

      <View style={styles.stepper}>
        <View style={[styles.stepDot, step >= 1 && styles.stepDotOn]} />
        <View style={[styles.stepDot, step >= 2 && styles.stepDotOn]} />
        <View style={[styles.stepDot, step >= 3 && styles.stepDotOn]} />
      </View>

      {/* Step 1: Language */}
      {step === 1 && (
        <>
          <Text style={styles.label}>App language</Text>
          <View style={styles.langGrid}>
            {LANGUAGES.map((l) => (
              <TouchableOpacity
                key={l.id}
                onPress={() => setLanguage(l.id)}
                style={[styles.langCard, language === l.id && styles.langCardOn]}
              >
                <Text style={[styles.langNative, language === l.id && styles.langTextOn]}>
                  {l.native}
                </Text>
                <Text style={[styles.langName, language === l.id && styles.langTextOn]}>
                  {l.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.cta} onPress={() => setStep(2)}>
            <Text style={styles.ctaText}>Continue →</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Step 2: Phone + OTP */}
      {step === 2 && (
        <>
          <Text style={styles.label}>Mobile number</Text>
          <View style={styles.phoneRow}>
            <View style={styles.countryCode}>
              <Text style={styles.countryCodeText}>+91</Text>
            </View>
            <TextInput
              style={styles.phoneInput}
              placeholder="98765 43210"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={10}
              editable={!canVerifyOtp}
            />
          </View>

          <TouchableOpacity
            style={[styles.cta, !canSendOtp && styles.ctaDisabled]}
            onPress={handleSendOtp}
            disabled={!canSendOtp || canVerifyOtp}
          >
            <Text style={styles.ctaText}>
              {canVerifyOtp ? "OTP sent ✓" : "Send OTP"}
            </Text>
          </TouchableOpacity>

          {canSendOtp && (
            <>
              <Text style={[styles.label, { marginTop: 20 }]}>Enter OTP</Text>
              <TextInput
                style={styles.otpInput}
                placeholder="1 2 3 4"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                value={otp}
                onChangeText={setOtp}
                maxLength={4}
              />
              <TouchableOpacity
                style={[styles.cta, !canVerifyOtp && styles.ctaDisabled, { marginTop: 12 }]}
                onPress={handleVerifyOtp}
                disabled={!canVerifyOtp}
              >
                <Text style={styles.ctaText}>Verify</Text>
              </TouchableOpacity>
              <Text style={styles.hint}>Demo hint: OTP is 1234</Text>
            </>
          )}

          <TouchableOpacity onPress={() => setStep(1)} style={styles.backLink}>
            <Text style={styles.backLinkText}>← Change language</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Step 3: Profile */}
      {step === 3 && (
        <>
          <Text style={styles.label}>Your name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Ramesh Kumar"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
            maxLength={60}
          />

          <Text style={[styles.label, { marginTop: 14 }]}>Operating area (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Bhosari MIDC, Pune"
            placeholderTextColor={colors.muted}
            value={operatingArea}
            onChangeText={setOperatingArea}
            maxLength={80}
          />

          <TouchableOpacity
            style={[styles.cta, !canFinish && styles.ctaDisabled, { marginTop: 24 }]}
            onPress={handleFinish}
            disabled={!canFinish || isBusy}
          >
            {isBusy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.ctaText}>Create my account →</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setStep(2)} style={styles.backLink}>
            <Text style={styles.backLinkText}>← Change phone</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 24, paddingBottom: 40 },

  header: { marginBottom: 20 },
  brand: { fontSize: 24, fontWeight: "900", color: colors.green },
  subtitle: { marginTop: 6, fontSize: 14, color: colors.muted },

  stepper: { flexDirection: "row", gap: 6, marginBottom: 24 },
  stepDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "#DBE3DC" },
  stepDotOn: { backgroundColor: colors.orange },

  label: { fontSize: 12, fontWeight: "800", color: "#53675E", marginBottom: 8 },

  langGrid: { gap: 10, marginBottom: 20 },
  langCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  langCardOn: { borderColor: colors.green, backgroundColor: colors.greenLight },
  langNative: { fontSize: 18, fontWeight: "800", color: colors.ink },
  langName: { fontSize: 11, color: colors.muted, marginTop: 2 },
  langTextOn: { color: colors.green },

  input: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    fontSize: 14,
    color: colors.ink,
  },

  phoneRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  countryCode: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.greenLight,
    alignItems: "center",
    justifyContent: "center",
  },
  countryCodeText: { fontSize: 15, fontWeight: "800", color: colors.green },
  phoneInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    fontSize: 15,
    color: colors.ink,
  },

  otpInput: {
    height: 60,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.green,
    backgroundColor: colors.white,
    fontSize: 26,
    letterSpacing: 12,
    fontWeight: "900",
    textAlign: "center",
    color: colors.green,
  },

  hint: { marginTop: 8, fontSize: 11, color: colors.muted, textAlign: "center" },

  cta: {
    marginTop: 16,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaDisabled: { backgroundColor: "#B7C7BC" },
  ctaText: { color: colors.white, fontSize: 14, fontWeight: "800" },

  backLink: { marginTop: 16, alignItems: "center" },
  backLinkText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
});