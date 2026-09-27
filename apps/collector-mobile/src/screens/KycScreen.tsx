// src/screens/KycScreen.tsx — simulated KYC (Aadhaar last4 → PAN → bank last4 → selfie).
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Text } from "../ui/Text";
import Animated, { BounceIn, FadeInRight, FadeOutLeft } from "react-native-reanimated";

import { colors, radius, space, type } from "../constants/theme";
import { useTranslation } from "../hooks/useTranslation";
import type { TranslationKey } from "../i18n";
import { ApiError, kycStart, kycVerify } from "../services/api/client";
import { useAuthStore } from "../store/authStore";
import { toast } from "../ui/feedback";
import { Float, ProgressBar } from "../ui/motion";
import { Button, Card, IconTile, type IconName, Screen, textStyles } from "../ui/primitives";

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** Never send the full PAN: keep first 5 + last 1 characters. */
const maskPan = (pan: string) => `${pan.slice(0, 5)}****${pan.slice(9)}`;

const STEPS: Array<{ icon: IconName; title: TranslationKey; help: TranslationKey }> = [
  { icon: "finger-print", title: "aadhaarTitle", help: "aadhaarHelp" },
  { icon: "card", title: "panTitle", help: "panHelp" },
  { icon: "business", title: "bankTitle", help: "bankHelp" },
  { icon: "happy", title: "selfieTitle", help: "selfieHelp" },
];

export function KycScreen() {
  const { t } = useTranslation();
  const collector = useAuthStore((s) => s.collector);
  const setCollector = useAuthStore((s) => s.setCollector);
  const signOut = useAuthStore((s) => s.signOut);

  const [step, setStep] = useState(collector?.kyc_status === "IN_PROGRESS" ? 3 : 0);
  const [aadhaar, setAadhaar] = useState("");
  const [pan, setPan] = useState("");
  const [bank, setBank] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const panValid = PAN_RE.test(pan);
  const current = STEPS[step]!;

  const submitDetails = async () => {
    if (!collector) return;
    setBusy(true);
    try {
      const updated = await kycStart(collector.id, { aadhaar_last4: aadhaar, pan_masked: maskPan(pan), bank_account_last4: bank });
      await setCollector(updated);
      setStep(3);
    } catch (err) {
      toast.error(t("serverDown"), err instanceof ApiError ? err.message : t("serverDownMsg"));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!collector) return;
    setBusy(true);
    try {
      const updated = await kycVerify(collector.id, undefined);
      setDone(true);
      toast.success(t("kycDone"));
      // Let the celebration play before the navigator swaps to the main app.
      setTimeout(() => void setCollector(updated), 1200);
    } catch (err) {
      toast.error(t("serverDown"), err instanceof ApiError ? err.message : t("serverDownMsg"));
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Screen contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
        <View style={{ alignItems: "center" }}>
          <Animated.View entering={BounceIn.duration(900)} style={styles.doneCircle}>
            <Ionicons name="shield-checkmark" size={64} color={colors.white} />
          </Animated.View>
          <Text style={[styles.title, { marginTop: space.xl, textAlign: "center" }]}>{t("kycDone")}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={textStyles.kicker}>KYC · {step + 1}/4</Text>
      <Text style={styles.title}>{t("kycTitle")}</Text>
      <Text style={[textStyles.body, { marginTop: 6 }]}>{t("kycSubtitle")}</Text>
      <View style={{ marginVertical: space.xl }}>
        <ProgressBar progress={(step + 1) / 4} height={6} />
      </View>

      <Animated.View key={step} entering={FadeInRight.springify().damping(18)} exiting={FadeOutLeft}>
        <Card style={{ alignItems: "center", paddingVertical: space.xxl }}>
          <Float><IconTile icon={current.icon} size={72} /></Float>
          <Text style={[styles.stepTitle, { marginTop: space.lg }]}>{t(current.title)}</Text>
          <Text style={[textStyles.small, { textAlign: "center", marginTop: 6 }]}>{t(current.help)}</Text>

          {step === 0 && (
            <TextInput style={styles.codeInput} value={aadhaar} onChangeText={(v) => setAadhaar(v.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" maxLength={4} placeholder="• • • •" placeholderTextColor={colors.faint} autoFocus accessibilityLabel={t("aadhaarTitle")} />
          )}
          {step === 1 && (
            <>
              <TextInput style={[styles.codeInput, { letterSpacing: 3, fontSize: 22 }]} value={pan} onChangeText={(v) => setPan(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))} autoCapitalize="characters" maxLength={10} placeholder="ABCDE1234F" placeholderTextColor={colors.faint} autoFocus accessibilityLabel={t("panTitle")} />
              {pan.length === 10 && !panValid ? <Text style={styles.error}>{t("panInvalid")}</Text> : null}
            </>
          )}
          {step === 2 && (
            <TextInput style={styles.codeInput} value={bank} onChangeText={(v) => setBank(v.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" maxLength={4} placeholder="• • • •" placeholderTextColor={colors.faint} autoFocus accessibilityLabel={t("bankTitle")} />
          )}
        </Card>

        <View style={{ marginTop: space.xl, gap: space.md }}>
          {step === 0 && <Button label={t("next")} icon="arrow-forward" disabled={aadhaar.length !== 4} onPress={() => setStep(1)} />}
          {step === 1 && <Button label={t("next")} icon="arrow-forward" disabled={!panValid} onPress={() => setStep(2)} />}
          {step === 2 && <Button label={t("submit")} icon="cloud-upload" disabled={bank.length !== 4} loading={busy} onPress={submitDetails} />}
          {step === 3 && <Button label={t("verifyNow")} icon="shield-checkmark" loading={busy} onPress={verify} />}
          {step > 0 && step < 3 ? <Button label={t("back")} variant="ghost" icon="arrow-back" onPress={() => setStep(step - 1)} /> : null}
          {step === 0 ? <Button label={t("signOut")} variant="ghost" icon="log-out-outline" onPress={() => void signOut()} /> : null}
        </View>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...type.h1, color: colors.ink, marginTop: 4 },
  stepTitle: { ...type.h2, color: colors.ink, textAlign: "center" },
  codeInput: { marginTop: space.xl, minWidth: 200, textAlign: "center", fontSize: 30, fontWeight: "800", letterSpacing: 10, color: colors.ink, paddingVertical: 14, paddingHorizontal: 20, borderRadius: radius.md, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.bg },
  error: { marginTop: space.sm, color: colors.danger, fontWeight: "700" },
  doneCircle: { width: 130, height: 130, borderRadius: 65, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
});
