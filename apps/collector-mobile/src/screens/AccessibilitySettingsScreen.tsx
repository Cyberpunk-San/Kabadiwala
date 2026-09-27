// src/screens/AccessibilitySettingsScreen.tsx
import { StyleSheet, Switch, View } from "react-native";
import { Text } from "../ui/Text";

import { colors } from "../constants/theme";
import { useAccessibilityStore } from "../store/accessibilityStore";
import { speak } from "../services/voice/speech";
import { useAppStore } from "../store/appStore";
import { goBack } from "../navigation/ref";
import { Screen, TopBar } from "../ui/primitives";

import { P } from "../constants/palette";
export function AccessibilitySettingsScreen() {
  const language = useAppStore((s) => s.language);

  const voiceNavigationEnabled = useAccessibilityStore((s) => s.voiceNavigationEnabled);
  const voiceCommandsEnabled = useAccessibilityStore((s) => s.voiceCommandsEnabled);
  const simpleMode = useAccessibilityStore((s) => s.simpleMode);

  const toggleVoiceNavigation = useAccessibilityStore((s) => s.toggleVoiceNavigation);
  const toggleVoiceCommands = useAccessibilityStore((s) => s.toggleVoiceCommands);
  const toggleSimpleMode = useAccessibilityStore((s) => s.toggleSimpleMode);

  return (
    <Screen>
      <TopBar kicker="Accessibility" title="Make the app work for you" onBack={goBack} />

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
    </Screen>
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
        trackColor={{ false: P("rgba(248,250,247,0.15)"), true: P("#19A982") }}
        thumbColor={value ? P("#A8E8C9") : P("#F8FAF7")}
      />
    </View>
  );
}

const styles = StyleSheet.create({

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: P("rgba(248,250,247,0.045)"),
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardTitle: { fontSize: 15, fontWeight: "600", color: colors.ink },
  cardSub: { fontSize: 13, color: colors.muted, marginTop: 3, lineHeight: 18 },
});