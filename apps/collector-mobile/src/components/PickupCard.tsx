// src/components/PickupCard.tsx — one pickup request, used by customers and kabadiwalas.
import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "../ui/Text";
import Animated from "react-native-reanimated";

import { colors, radius, space } from "../constants/theme";
import { useTranslation } from "../hooks/useTranslation";
import type { Pickup, PickupStatus } from "../services/api/client";
import { materialName } from "../types/domain";
import { MaterialAvatar } from "../ui/materials";
import { PulseDot } from "../ui/motion";
import { Badge, enter, PressScale } from "../ui/primitives";
import { currency, localDateISO, relativeDate, scheduleLabel } from "../utils/format";
import { SLOT_KEY } from "./ScheduleChips";

export const PICKUP_TONE: Record<PickupStatus, "warn" | "info" | "primary" | "muted"> = {
  OPEN: "warn",
  ACCEPTED: "info",
  COMPLETED: "primary",
  CANCELLED: "muted",
};

export function PickupCard({ pickup, index = 0, onPress, footer, showRequester, kicker }: {
  pickup: Pickup;
  index?: number;
  onPress?: () => void;
  footer?: ReactNode;
  showRequester?: boolean;
  /** Route position, e.g. "Stop 2 · 1.4 km". */
  kicker?: string;
}) {
  const { t, language } = useTranslation();
  const live = pickup.status === "OPEN" || pickup.status === "ACCEPTED";
  return (
    <Animated.View entering={enter(index)}>
      <PressScale onPress={onPress} haptic={!!onPress} style={styles.card} accessibilityRole={onPress ? "button" : undefined}>
        <View style={styles.row}>
          <MaterialAvatar material={pickup.material} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{materialName(pickup.material, language)}</Text>
            <Text style={styles.sub} numberOfLines={1}>
              {pickup.actual_weight_kg ?? pickup.estimated_weight_kg} {t("kg")} · {relativeDate(pickup.created_at.endsWith("Z") ? pickup.created_at : `${pickup.created_at}Z`, language)}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 6 }}>
            <Text style={styles.value}>{currency(pickup.amount_paid ?? pickup.estimated_value)}</Text>
            {pickup.requester_type === "company" ? <Badge label={t("bulk")} tone="info" icon="business" /> : null}
          </View>
        </View>

        {showRequester ? (
          <View style={styles.meta}>
            <Ionicons name={pickup.requester_type === "company" ? "business-outline" : "home-outline"} size={14} color={colors.muted} />
            <Text style={styles.metaText} numberOfLines={1}>{pickup.requester_name}{pickup.address ? ` · ${pickup.address}` : ""}</Text>
            {pickup.distance_km != null ? <Badge label={t("kmAway", { n: pickup.distance_km })} tone="primary" icon="navigate" /> : null}
          </View>
        ) : null}

        <View style={styles.statusRow}>
          {live ? <PulseDot color={pickup.status === "OPEN" ? colors.accent : colors.info} size={7} /> : null}
          {kicker ? <Badge label={kicker} tone="primary" icon="navigate" /> : null}
          <Badge label={t(`status${pickup.status}` as "statusOPEN")} tone={PICKUP_TONE[pickup.status]} />
          {pickup.preferred_date ? (
            <View style={styles.when}>
              <Ionicons name="calendar-outline" size={13} color={live && pickup.preferred_date < localDateISO(0) ? colors.danger : colors.muted} />
              <Text style={[styles.metaText, live && pickup.preferred_date < localDateISO(0) && { color: colors.danger, fontWeight: "700" }]}>
                {scheduleLabel(pickup.preferred_date, language)} · {t(SLOT_KEY[pickup.preferred_slot ?? "anytime"])}
                {live && pickup.preferred_date < localDateISO(0) ? ` · ${t("overdue")}` : ""}
              </Text>
            </View>
          ) : pickup.preferred_time ? <Text style={styles.metaText}>· {pickup.preferred_time}</Text> : null}
          {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.faint} style={{ marginLeft: "auto" }} /> : null}
        </View>
        {footer}
      </PressScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.md, marginBottom: space.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  title: { fontSize: 15, fontWeight: "800", color: colors.ink },
  sub: { marginTop: 3, fontSize: 12, color: colors.muted },
  value: { fontSize: 15, fontWeight: "800", color: colors.primary },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: space.md },
  metaText: { flexShrink: 1, fontSize: 12, color: colors.muted },
  when: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: space.md },
});
