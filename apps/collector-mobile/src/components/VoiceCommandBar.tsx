// src/components/VoiceCommandBar.tsx
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, ScrollView, StyleSheet, View } from "react-native";
import { Tappable } from "../ui/Tappable";
import { Text } from "../ui/Text";

import { colors } from "../constants/theme";
import type { Language } from "../types/domain";
import { matchMaterial, parseSpokenNumber, isConfirmIntent, isCancelIntent } from "../services/voice/parser";
import { speak } from "../services/voice/speech";
import { VoiceInputButton } from "./VoiceInputButton";

import { P } from "../constants/palette";
type Props = {
  visible: boolean;
  language: Language;
  onClose: () => void;
  onMaterialPicked: (material: any) => void;
  onWeightPicked: (kg: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Global voice command bar.
 * Recognizes intents:
 *   "copper cable 35 kg"  → material + weight
 *   "thirty five kilos"   → weight
 *   "find copper price"   → price lookup (emitted as material)
 *   "confirm"             → confirm current action
 *   "cancel"              → cancel current action
 */
export function VoiceCommandBar({
  visible,
  language,
  onClose,
  onMaterialPicked,
  onWeightPicked,
  onConfirm,
  onCancel,
}: Props) {
  const [lastTranscript, setLastTranscript] = useState("");
  const [lastIntent, setLastIntent] = useState<string>("");

  const handleTranscript = (transcript: string) => {
    setLastTranscript(transcript);
    const lower = transcript.toLowerCase();

    // 1. Cancel?
    if (isCancelIntent(lower)) {
      setLastIntent("Cancel");
      speak("Cancelled", language);
      onCancel();
      setTimeout(onClose, 600);
      return;
    }

    // 2. Confirm?
    if (isConfirmIntent(lower)) {
      setLastIntent("Confirm");
      speak("Confirmed", language);
      onConfirm();
      setTimeout(onClose, 600);
      return;
    }

    // 3. Material?
    const material = matchMaterial(transcript);
    if (material) {
      setLastIntent(`Material: ${material}`);
      onMaterialPicked(material);
    }

    // 4. Weight?
    const kg = parseSpokenNumber(transcript, language);
    if (!Number.isNaN(kg) && kg > 0 && kg < 10000) {
      setLastIntent((prev) => `${prev ? prev + " · " : ""}Weight: ${kg} kg`);
      onWeightPicked(kg);
    }

    if (!material && (Number.isNaN(kg) || kg <= 0)) {
      setLastIntent("Not understood");
    }

    speak(transcript, language); // echo back
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Voice Command</Text>
            <Tappable onPress={onClose}>
              <Ionicons name="close" size={20} color={P("rgba(248,250,247,0.62)")} />
            </Tappable>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <VoiceInputButton
              language={language}
              label="Tap to speak"
              listeningLabel="Listening…"
              onResult={handleTranscript}
              size="large"
            />

            {lastTranscript ? (
              <View style={styles.resultBox}>
                <Text style={styles.resultLabel}>HEARD</Text>
                <Text style={styles.resultText}>“{lastTranscript}”</Text>
                {lastIntent ? (
                  <>
                    <Text style={[styles.resultLabel, { marginTop: 10 }]}>PARSED</Text>
                    <Text style={styles.intentText}>{lastIntent}</Text>
                  </>
                ) : null}
              </View>
            ) : (
              <View style={styles.hints}>
                <Text style={styles.hintTitle}>Try saying:</Text>
                <Text style={styles.hint}>• “Copper cable, thirty five kg”</Text>
                <Text style={styles.hint}>• “तांबा पैंतीस किलो”</Text>
                <Text style={styles.hint}>• “तांबे पस्तीस किलो”</Text>
                <Text style={styles.hint}>• “Confirm” / “हाँ” / “हो”</Text>
                <Text style={styles.hint}>• “Cancel” / “रद्द”</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: P("rgba(0,0,0,0.55)"), justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: "80%",
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 18, fontWeight: "900", color: colors.ink },
  close: { fontSize: 22, color: colors.muted, padding: 4 },
  body: { alignItems: "center", paddingBottom: 20 },

  resultBox: {
    marginTop: 24,
    padding: 16,
    borderRadius: 14,
    backgroundColor: P("#0B1A17"),
    borderWidth: 1,
    borderColor: colors.line,
    alignSelf: "stretch",
  },
  resultLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1, color: colors.muted },
  resultText: { marginTop: 4, fontSize: 16, fontWeight: "800", color: colors.ink },
  intentText: { marginTop: 4, fontSize: 14, fontWeight: "700", color: colors.green },

  hints: {
    marginTop: 24,
    padding: 16,
    borderRadius: 14,
    backgroundColor: P("#0B1A17"),
    borderWidth: 1,
    borderColor: colors.line,
    alignSelf: "stretch",
  },
  hintTitle: { fontSize: 12, fontWeight: "800", color: colors.ink, marginBottom: 8 },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 20 },
});