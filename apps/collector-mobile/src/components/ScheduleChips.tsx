// src/components/ScheduleChips.tsx — pick a pickup day (next 7 days) and a time slot.
import { StyleSheet, View } from "react-native";
import { Text } from "../ui/Text";

import { colors, space } from "../constants/theme";
import { useTranslation } from "../hooks/useTranslation";
import type { PickupSlot } from "../services/api/client";
import { Chip } from "../ui/primitives";
import { localDateISO, scheduleLabel } from "../utils/format";

export const SLOT_KEY = {
  morning: "timeMorning",
  afternoon: "timeAfternoon",
  evening: "timeEvening",
  anytime: "timeAnytime",
} as const satisfies Record<PickupSlot, string>;

const SLOTS = Object.keys(SLOT_KEY) as PickupSlot[];
const DAYS_AHEAD = 7;

export function ScheduleChips({ date, slot, onDate, onSlot }: {
  date: string;
  slot: PickupSlot;
  onDate: (isoDate: string) => void;
  onSlot: (slot: PickupSlot) => void;
}) {
  const { t, language } = useTranslation();
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => localDateISO(i));
  return (
    <View>
      <Text style={styles.label}>{t("pickupDay")}</Text>
      <View style={styles.chips}>
        {days.map((d) => <Chip key={d} label={scheduleLabel(d, language)} icon="calendar" active={date === d} onPress={() => onDate(d)} />)}
      </View>
      <Text style={[styles.label, { marginTop: space.md }]}>{t("preferredTime")}</Text>
      <View style={styles.chips}>
        {SLOTS.map((s) => <Chip key={s} label={t(SLOT_KEY[s])} active={slot === s} onPress={() => onSlot(s)} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: "800", color: colors.ink, marginBottom: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
