import { StyleSheet, View } from "react-native";
import { Tappable } from "../ui/Tappable";
import { Text } from "../ui/Text";

import { colors } from "../constants/theme";

import { P } from "../constants/palette";
type Props = { label: string; onPress: () => void };

export function VoiceButton({ label, onPress }: Props) {
  return <Tappable accessibilityRole="button" style={styles.button} onPress={onPress}>
    <View style={styles.icon}><Text style={styles.iconText}>●</Text></View>
    <Text style={styles.label}>{label}</Text>
  </Tappable>;
}

const styles = StyleSheet.create({
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 11, borderRadius: 12, backgroundColor: P("rgba(248,250,247,0.06)") },
  icon: { width: 20, height: 20, borderRadius: 10, backgroundColor: P("#19A982"), alignItems: "center", justifyContent: "center" },
  iconText: { color: colors.white, fontSize: 9 },
  label: { color: P("#E5B86A"), fontSize: 12, fontWeight: "700" }
});
