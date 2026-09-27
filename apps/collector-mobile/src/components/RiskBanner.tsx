// src/components/RiskBanner.tsx
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";
import { Text } from "../ui/Text";

import { colors } from "../constants/theme";
import { listRiskAlerts } from "../services/api/client";

import { P } from "../constants/palette";
type SeverityStyle = { bg: string; fg: string; icon: string };

const LOW_SEVERITY: SeverityStyle = { bg: P("rgba(124,196,204,0.10)"), fg: P("#7CC4CC"), icon: "information-circle-outline" };

const SEVERITY_STYLES: Record<string, SeverityStyle> = {
  critical: { bg: P("rgba(231,137,143,0.12)"), fg: P("#E7898F"), icon: "alert-circle-outline" },
  high:     { bg: P("rgba(229,184,106,0.10)"), fg: P("#E5B86A"), icon: "warning-outline" },
  medium:   { bg: P("rgba(229,184,106,0.08)"), fg: P("#E5B86A"), icon: "flash-outline" },
  low:      LOW_SEVERITY,
};

export function RiskBanner({ lotId }: { lotId?: string }) {
  const { data } = useQuery({
    queryKey: ["risk-alerts"],
    queryFn: () => listRiskAlerts(),
    staleTime: 60_000,
  });

  if (!data || data.length === 0) return null;

  // Filter to alerts relevant to this lot (or show top 2 overall)
  const relevant = lotId
    ? data.filter((a) => a.lot_id === lotId).slice(0, 2)
    : data.slice(0, 2);

  if (relevant.length === 0) return null;

  return (
    <View style={{ marginBottom: 12 }}>
      {relevant.map((alert) => {
        const s = SEVERITY_STYLES[alert.severity] ?? LOW_SEVERITY;
        return (
          <View key={alert.id} style={[styles.banner, { backgroundColor: s.bg }]}>
            <Ionicons name={s.icon as "warning-outline"} size={20} color={s.fg} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.type, { color: s.fg }]}>
                {alert.type.replace(/_/g, " ")}
              </Text>
              <Text style={[styles.message, { color: s.fg }]} numberOfLines={3}>
                {alert.message}
              </Text>
            </View>
            <Text style={[styles.score, { color: s.fg }]}>
              {Math.round(alert.risk_score)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: P("rgba(0,0,0,0.05)"),
  },
  icon: { fontSize: 20 },
  type: { fontSize: 10, fontWeight: "900", letterSpacing: 0.4 },
  message: { marginTop: 2, fontSize: 11, lineHeight: 15, fontWeight: "600" },
  score: { fontSize: 16, fontWeight: "900" },
});