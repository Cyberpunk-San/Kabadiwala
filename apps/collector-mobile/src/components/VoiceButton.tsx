import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { colors } from "../constants/theme";

type Props = { label: string; onPress: () => void };

export function VoiceButton({ label, onPress }: Props) {
  return <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={onPress}>
    <View style={styles.icon}><Text style={styles.iconText}>●</Text></View>
    <Text style={styles.label}>{label}</Text>
  </TouchableOpacity>;
}

const styles = StyleSheet.create({
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 11, borderRadius: 12, backgroundColor: "#FFF0D8" },
  icon: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#E9823C", alignItems: "center", justifyContent: "center" },
  iconText: { color: colors.white, fontSize: 9 },
  label: { color: "#835A17", fontSize: 12, fontWeight: "700" }
});
