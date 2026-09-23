// src/screens/KycScreen.tsx
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
import { kycStart, kycVerify } from "../services/api/client";
import { useAuthStore } from "../store/authStore";

type Props = {
  onComplete: () => void;
};

export function KycScreen({ onComplete }: Props) {
  const collector = useAuthStore((s) => s.collector);
  const setCollector = useAuthStore((s) => s.setCollector);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [aadhaarLast4, setAadhaarLast4] = useState("");
  const [panMasked, setPanMasked] = useState("");
  const [bankLast4, setBankLast4] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const canStep2 = aadhaarLast4.length === 4;
  const canStep3 = panMasked.length >= 6;
  const canStep4 = bankLast4.length === 4;

  const handleStart = async () => {
    if (!collector) return;
    setIsBusy(true);
    try {
      const updated = await kycStart(collector.id, {
        aadhaar_last4: aadhaarLast4,
        pan_masked: panMasked,
        bank_account_last4: bankLast4,
      });
      await setCollector(updated);
      setStep(4);
    } catch (err: any) {
      Alert.alert("KYC failed", err?.message ?? "Please check your connection.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleVerify = async () => {
    if (!collector) return;
    setIsBusy(true);
    try {
      // Selfie is simulated — no camera capture in this demo
      const updated = await kycVerify(collector.id, undefined);
      await setCollector(updated);
      Alert.alert(
        "KYC verified ✓",
        "Your account is now verified. You can start collecting!",
        [{ text: "Continue", onPress: onComplete }]
      );
    } catch (err: any) {
      Alert.alert("Verification failed", err?.message ?? "Please try again.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.brand}>♻ KYC Verification</Text>
      <Text style={styles.subtitle}>
        Government ID verification keeps the platform trusted for everyone.
        This demo uses simulated verification.
      </Text>

      <View style={styles.stepper}>
        {[1, 2, 3, 4].map((n) => (
          <View key={n} style={[styles.stepDot, step >= n && styles.stepDotOn]} />
        ))}
      </View>

      {step === 1 && (
        <>
          <Text style={styles.stepTitle}>Aadhaar (last 4 digits)</Text>
          <Text style={styles.stepHelp}>
            We never store your full Aadhaar number — only the last 4 digits for
            reference. Real verification would use UIDAI's API.
          </Text>
          <TextInput
            style={styles.otpInput}
            placeholder="• • • •"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            maxLength={4}
            value={aadhaarLast4}
            onChangeText={(t) => setAadhaarLast4(t.replace(/\D/g, ""))}
          />
          <TouchableOpacity
            style={[styles.cta, !canStep2 && styles.ctaDisabled]}
            onPress={() => setStep(2)}
            disabled={!canStep2}
          >
            <Text style={styles.ctaText}>Next →</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 2 && (
        <>
          <Text style={styles.stepTitle}>PAN card number</Text>
          <Text style={styles.stepHelp}>
            Format: 5 letters, 4 digits, 1 letter (e.g. ABCPX1234K).
            We'll mask the middle for storage.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="ABCDE1234F"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            maxLength={10}
            value={panMasked}
            onChangeText={(t) => setPanMasked(t.toUpperCase())}
          />
          <TouchableOpacity
            style={[styles.cta, !canStep3 && styles.ctaDisabled]}
            onPress={() => setStep(3)}
            disabled={!canStep3}
          >
            <Text style={styles.ctaText}>Next →</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setStep(1)} style={styles.backLink}>
            <Text style={styles.backLinkText}>← Back</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 3 && (
        <>
          <Text style={styles.stepTitle}>Bank account (last 4 digits)</Text>
          <Text style={styles.stepHelp}>
            Payouts are settled directly to your bank/UPI. We only store the last
            4 digits.
          </Text>
          <TextInput
            style={styles.otpInput}
            placeholder="• • • •"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            maxLength={4}
            value={bankLast4}
            onChangeText={(t) => setBankLast4(t.replace(/\D/g, ""))}
          />
          <TouchableOpacity
            style={[styles.cta, (!canStep4 || isBusy) && styles.ctaDisabled]}
            onPress={handleStart}
            disabled={!canStep4 || isBusy}
          >
            {isBusy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.ctaText}>Submit details</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setStep(2)} style={styles.backLink}>
            <Text style={styles.backLinkText}>← Back</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 4 && (
        <>
          <View style={styles.successCircle}>
            <Text style={styles.successIcon}>📷</Text>
          </View>
          <Text style={styles.stepTitle}>Selfie verification</Text>
          <Text style={styles.stepHelp}>
            In a real app you'd take a selfie now for liveness + face match. For
            this demo we skip the camera and verify instantly.
          </Text>
          <TouchableOpacity
            style={[styles.cta, isBusy && styles.ctaDisabled]}
            onPress={handleVerify}
            disabled={isBusy}
          >
            {isBusy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.ctaText}>✓ Verify instantly (simulated)</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 24, paddingBottom: 40 },

  brand: { fontSize: 22, fontWeight: "900", color: colors.green },
  subtitle: { marginTop: 8, fontSize: 12, color: colors.muted, lineHeight: 17 },

  stepper: { flexDirection: "row", gap: 6, marginTop: 20, marginBottom: 28 },
  stepDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "#DBE3DC" },
  stepDotOn: { backgroundColor: colors.orange },

  stepTitle: { fontSize: 17, fontWeight: "800", color: colors.ink },
  stepHelp: { marginTop: 6, marginBottom: 16, fontSize: 12, color: colors.muted, lineHeight: 17 },

  input: {
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.green,
    backgroundColor: colors.white,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 3,
    color: colors.ink,
    textAlign: "center",
  },
  otpInput: {
    height: 64,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.green,
    backgroundColor: colors.white,
    fontSize: 28,
    letterSpacing: 14,
    fontWeight: "900",
    textAlign: "center",
    color: colors.green,
  },

  cta: {
    marginTop: 20,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaDisabled: { backgroundColor: "#B7C7BC" },
  ctaText: { color: colors.white, fontSize: 14, fontWeight: "800" },

  backLink: { marginTop: 14, alignItems: "center" },
  backLinkText: { color: colors.muted, fontSize: 12, fontWeight: "700" },

  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.greenLight,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 20,
  },
  successIcon: { fontSize: 38 },
});