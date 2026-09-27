import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { Tappable } from "../ui/Tappable";
import { Text } from "../ui/Text";

import { colors } from "../constants/theme";
import type { RecyclerOffer } from "../types/domain";
import { currency } from "../utils/format";

import { P } from "../constants/palette";
type Props = { offer: RecyclerOffer; net: number; costs: number; best?: boolean; chooseLabel: string; onChoose: () => void };

export function PriceCard({ offer, net, costs, best, chooseLabel, onChoose }: Props) {
  return <View style={[styles.card, best && styles.best]}>
    <View style={styles.head}>
      <View style={styles.buyer}><View style={styles.logo}><Ionicons name="business-outline" size={18} color={P("#A8E8C9")} /></View><View><Text style={styles.name}>{offer.recyclerName} {offer.verified ? "✓" : ""}</Text><Text style={styles.meta}>★ {offer.rating} · {offer.distanceKm} km</Text></View></View>
      <Text style={styles.price}>{currency(offer.listedPricePerKg)}<Text style={styles.unit}>/kg</Text></Text>
    </View>
    <View style={styles.costs}><Text>Pickup + handling</Text><Text>−{currency(costs)}</Text></View>
    <View style={styles.total}><View><Text style={styles.takeHome}>TAKE HOME</Text><Text style={styles.net}>{currency(net)}</Text></View><Tappable style={[styles.choose, best && styles.chooseBest]} onPress={onChoose}><Text style={[styles.chooseText, best && styles.chooseTextBest]}>{chooseLabel}</Text></Tappable></View>
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 18, backgroundColor: P("rgba(248,250,247,0.045)") },
  best: { borderWidth: 2, borderColor: P("rgba(168,232,201,0.45)") },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  buyer: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  logo: { width: 35, height: 35, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.greenLight },
  name: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  meta: { marginTop: 3, color: colors.muted, fontSize: 9 },
  price: { color: colors.green, fontSize: 15, fontWeight: "800" },
  unit: { color: colors.muted, fontSize: 9, fontWeight: "500" },
  costs: { flexDirection: "row", justifyContent: "space-between", marginVertical: 11, paddingVertical: 9, borderTopWidth: 1, borderBottomWidth: 1, borderColor: P("#E4EAE4"), borderStyle: "dashed", color: colors.muted },
  total: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  takeHome: { color: colors.muted, fontSize: 9, fontWeight: "700", letterSpacing: .5 },
  net: { marginTop: 2, color: colors.green, fontSize: 18, fontWeight: "800" },
  choose: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9, backgroundColor: P("rgba(248,250,247,0.07)") },
  chooseBest: { backgroundColor: colors.green },
  chooseText: { color: P("#A8E8C9"), fontSize: 10, fontWeight: "800" },
  chooseTextBest: { color: colors.white }
});
