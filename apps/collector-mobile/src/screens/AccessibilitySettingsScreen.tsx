// src/screens/AccessibilitySettingsScreen.tsx
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { colors } from "../constants/theme";
import { useAccessibilityStore } from "../store/accessibilityStore";
import { speak } from "../services/voice/speech";
import { useAppStore } from "../store/appStore";

export function AccessibilitySettingsScreen() {
  const language = useAppStore((s) => s.language);

  const voiceNavigationEnabled = useAccessibilityStore((s) => s.voiceNavigationEnabled);
  const voiceCommandsEnabled = useAccessibilityStore((s) => s.voiceCommandsEnabled);
  const simpleMode = useAccessibilityStore((s) => s.simpleMode);

  const toggleVoiceNavigation = useAccessibilityStore((s) => s.toggleVoiceNavigation);
  const toggleVoiceCommands = useAccessibilityStore((s) => s.toggleVoiceCommands);
  const toggleSimpleMode = useAccessibilityStore((s) => s.toggleSimpleMode);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>ACCESSIBILITY</Text>
      <Text style={styles.title}>Make the app work for you</Text>

      <Row
        title="Voice-guided navigation"
        subtitle="Speak a short description of each screen when it opens"
        value={voiceNavigationEnabled}
        onToggle={() => {
          toggleVoiceNavigation();
          speak(
            voiceNavigationEnabled ? "Voice navigation off" : "Voice navigation on",
            language
          );
        }}
      />

      <Row
        title="Voice commands"
        subtitle="Floating microphone button to speak commands"
        value={voiceCommandsEnabled}
        onToggle={() => {
          toggleVoiceCommands();
          speak(
            voiceCommandsEnabled ? "Voice commands off" : "Voice commands on",
            language
          );
        }}
      />

      <Row
        title="Simple mode (large text)"
        subtitle="Bigger fonts, more spacing, easier to read"
        value={simpleMode}
        onToggle={() => {
          toggleSimpleMode();
          speak(simpleMode ? "Simple mode off" : "Simple mode on", language);
        }}
      />
    </ScrollView>
  );
}

function Row({
  title,
  subtitle,
  value,
  onToggle,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSub}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: "#C5D0C7", true: "#74AF8A" }}
        thumbColor={colors.white}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 19, paddingBottom: 40 },
  kicker: { color: "#84948B", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  title: { marginTop: 4, marginBottom: 16, color: colors.ink, fontSize: 22, fontWeight: "800" },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardTitle: { fontSize: 13, fontWeight: "800", color: colors.ink },
  cardSub: { fontSize: 10, color: colors.muted, marginTop: 3, lineHeight: 14 },
});