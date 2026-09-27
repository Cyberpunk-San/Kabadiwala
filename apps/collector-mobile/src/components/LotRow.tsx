// src/components/LotRow.tsx
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { Text } from "../ui/Text";
import Animated from "react-native-reanimated";

import { colors, radius, space } from "../constants/theme";
import { useTranslation } from "../hooks/useTranslation";
import type { TranslationKey } from "../i18n";
import { materialName, type Lot } from "../types/domain";
import { MaterialAvatar } from "../ui/materials";
import { Badge, enter, PressScale } from "../ui/primitives";
import { currency, relativeDate } from "../utils/format";

import { P } from "../constants/palette";
const STATUS_TONE: Partial<Record<Lot["status"], "primary" | "warn" | "info" | "muted">> = {
  PAID: "primary",
  SOLD: "primary",
  PICKUP_SCHEDULED: "info",
  AGGREGATED: "muted",
};

export function LotRow({ lot, index = 0, onPress }: { lot: Lot; index?: number; onPress?: () => void }) {
  const { t, language } = useTranslation();
  const pending = lot.syncState === "PENDING";
  return (
    <Animated.View entering={enter(index)}>
      <PressScale onPress={onPress} style={styles.row} accessibilityRole="button">
        <MaterialAvatar material={lot.material} size={42} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{materialName(lot.material, language)}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {lot.weightKg} {t("kg")} · {relativeDate(lot.createdAt, language)}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 5 }}>
          <Text style={styles.value}>{lot.expectedNetEarnings ? currency(lot.expectedNetEarnings) : "—"}</Text>
          {pending ? (
            <Badge label={t("pendingSync")} tone="warn" icon="cloud-upload-outline" />
          ) : (
            <Badge label={t(`status${lot.status}` as TranslationKey)} tone={STATUS_TONE[lot.status] ?? "muted"} />
          )}
        </View>
        {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.faint} /> : null}
      </PressScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, marginBottom: space.sm, borderRadius: radius.lg, backgroundColor: P("rgba(248,250,247,0.045)"), borderWidth: 1, borderColor: P("rgba(248,250,247,0.08)") },
  title: { fontSize: 15, fontWeight: "600", color: P("#F8FAF7") },
  sub: { marginTop: 3, fontSize: 13, color: P("rgba(248,250,247,0.62)") },
  value: { fontSize: 15, fontWeight: "600", color: P("#F8FAF7") },
});
