// src/components/FloatingVoiceButton.tsx
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import { colors } from "../constants/theme";
import { useAccessibilityStore } from "../store/accessibilityStore";
import { useAppStore } from "../store/appStore";
import { useAuthStore } from "../store/authStore";
import { VoiceCommandBar } from "./VoiceCommandBar";
import { matchMaterial } from "../services/voice/parser";
import { speak } from "../services/voice/speech";

/**
 * Global floating mic button (bottom-right corner).
 * Opens the voice command bar; forwards intents to the app.
 */
export function FloatingVoiceButton() {
  const nav = useNavigation<any>();
  const language = useAppStore((s) => s.language);
  const collector = useAuthStore((s) => s.collector);
  const enabled = useAccessibilityStore((s) => s.voiceCommandsEnabled);

  const [open, setOpen] = useState(false);

  if (!enabled) return null;

  const handleMaterial = (mat: any) => {
    speak(`Opening ${mat} in marketplace`, language);
    nav.navigate("Market", { material: mat, quality: "medium", weightKg: 35 });
    setTimeout(() => setOpen(false), 800);
  };

  const handleWeight = (kg: number) => {
    // Navigate to Collect with prefilled weight
    nav.navigate("Collect", { prefillWeightKg: kg });
    setTimeout(() => setOpen(false), 800);
  };

  const handleConfirm = () => {
    // Confirm current lot in Handover if open
    nav.navigate("Handover", {});
    setTimeout(() => setOpen(false), 800);
  };

  const handleCancel = () => setOpen(false);

  return (
    <>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setOpen(true)}
        accessibilityLabel="Voice command"
        activeOpacity={0.9}
      >
        <Text style={styles.fabIcon}>🎤</Text>
      </TouchableOpacity>

      <VoiceCommandBar
        visible={open}
        language={language}
        onClose={() => setOpen(false)}
        onMaterialPicked={handleMaterial}
        onWeightPicked={handleWeight}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 16,
    bottom: 84,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 1000,
  },
  fabIcon: { fontSize: 24 },
});