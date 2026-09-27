// src/components/VoiceInputButton.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Tappable } from "../ui/Tappable";
import { Text } from "../ui/Text";

import { colors } from "../constants/theme";
import type { Language } from "../types/domain";
import { startListening, type RecognitionHandle } from "../services/voice/speechRecognition";

import { P } from "../constants/palette";
type Props = {
  language: Language;
  label: string;
  listeningLabel?: string;
  onResult: (transcript: string) => void;
  onError?: (msg: string) => void;
  size?: "normal" | "large";
};

/**
 * A tap-to-listen button that emits a single transcript.
 * Shows a red pulse while listening.
 */
export function VoiceInputButton({
  language,
  label,
  listeningLabel = "Listening…",
  onResult,
  onError,
  size = "normal",
}: Props) {
  const [isListening, setIsListening] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const handleRef = useRef<RecognitionHandle | null>(null);

  const start = async () => {
    setErrorText(null);
    setIsListening(true);

    const handle = await startListening(
      language,
      (result) => {
        onResult(result.transcript);
      },
      () => {
        setIsListening(false);
        handleRef.current = null;
      },
      (msg) => {
        setErrorText(msg);
        onError?.(msg);
      }
    );
    handleRef.current = handle;
  };

  const stop = () => {
    handleRef.current?.stop();
    setIsListening(false);
    handleRef.current = null;
  };

  return (
    <View style={styles.wrap}>
      <Tappable
        style={[
          styles.btn,
          size === "large" && styles.btnLarge,
          isListening && styles.btnActive,
        ]}
        onPress={isListening ? stop : start}
        activeOpacity={0.85}
      >
        {isListening ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <Ionicons name="mic-outline" size={16} color={P("#E5B86A")} />
        )}
        <Text style={[styles.label, size === "large" && styles.labelLarge]}>
          {isListening ? listeningLabel : label}
        </Text>
      </Tappable>

      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: P("rgba(248,250,247,0.06)"),
    borderWidth: 1,
    borderColor: P("rgba(229,184,106,0.35)"),
  },
  btnLarge: { paddingHorizontal: 20, paddingVertical: 14 },
  btnActive: { backgroundColor: P("#E7898F"), borderColor: P("#E7898F") },
  icon: { fontSize: 16 },
  label: { color: P("#E5B86A"), fontSize: 12, fontWeight: "700" },
  labelLarge: { fontSize: 14 },
  error: { marginTop: 4, fontSize: 10, color: P("#E7898F"), fontWeight: "700" },
});