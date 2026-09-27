import { StyleSheet, View } from "react-native";
import { Text } from "../ui/Text";

import { colors } from "../constants/theme";
import { MATERIAL_METADATA, type Lot } from "../types/domain";
import { currency, relativeDate } from "../utils/format";

import { P } from "../constants/palette";
type Props = { lot: Lot; syncedLabel: string; pendingLabel: string };

export function LotCard({ lot, syncedLabel, pendingLabel }: Props) {
  const isPending = lot.syncState === "PENDING";
  const icon = MATERIAL_METADATA[lot.material]?.icon || "◉";
  return <View style={styles.row}>
    <View style={[styles.icon, isPending ? styles.pendingIcon : styles.syncedIcon]}><Text>{icon}</Text></View>

    <View style={styles.copy}>
      <Text style={styles.title}>{lot.material}</Text>
      <Text style={styles.sub}>{lot.weightKg} kg · {relativeDate(lot.createdAt)}</Text>
    </View>
    <View style={styles.right}>
      <Text style={styles.value}>{lot.expectedNetEarnings ? currency(lot.expectedNetEarnings) : "—"}</Text>
      <Text style={[styles.status, isPending ? styles.pending : styles.synced]}>{isPending ? pendingLabel : syncedLabel}</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.line },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  pendingIcon: { backgroundColor: P("rgba(248,250,247,0.06)") },
  syncedIcon: { backgroundColor: colors.greenLight },
  copy: { flex: 1 },
  title: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  sub: { marginTop: 3, color: colors.muted, fontSize: 10 },
  right: { alignItems: "flex-end" },
  value: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  status: { marginTop: 3, fontSize: 9, fontWeight: "700" },
  pending: { color: P("#E5B86A") },
  synced: { color: P("#A8E8C9") }
});
