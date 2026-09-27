import { StyleSheet, View } from "react-native";
import { Text } from "../ui/Text";

import { colors } from "../constants/theme";

import { P } from "../constants/palette";
type Props = { material: string; price: string; note: string; badge?: string };

export function MaterialCard({ material, price, note, badge }: Props) {
  return <View style={styles.card}>
    <View style={styles.visual}><Text style={styles.visualText}>〰</Text></View>
    <View style={styles.copy}>
      {badge ? <Text style={styles.badge}>{badge}</Text> : null}
      <Text style={styles.title}>{material}</Text>
      <Text style={styles.note}>{note}</Text>
    </View>
    <Text style={styles.price}>{price}<Text style={styles.unit}>/kg</Text></Text>
  </View>;
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 11, padding: 13, borderRadius: 18, backgroundColor: P("rgba(248,250,247,0.045)"), borderWidth: 1, borderColor: colors.line },
  visual: { width: 49, height: 49, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: P("#020705") },
  visualText: { color: P("#E5B86A"), fontSize: 30, fontWeight: "700" },
  copy: { flex: 1 },
  badge: { alignSelf: "flex-start", marginBottom: 4, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, overflow: "hidden", color: P("#E5B86A"), backgroundColor: P("#FFF0BA"), fontSize: 8, fontWeight: "800", letterSpacing: .6 },
  title: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  note: { marginTop: 3, color: colors.muted, fontSize: 10 },
  price: { color: colors.green, fontSize: 15, fontWeight: "800" },
  unit: { color: colors.muted, fontSize: 9, fontWeight: "500" }
});
