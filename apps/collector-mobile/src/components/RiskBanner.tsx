// src/components/RiskBanner.tsx
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../constants/theme";
import { listRiskAlerts } from "../services/api/client";

const SEVERITY_STYLES: Record<string, { bg: string; fg: string; icon: string }> = {
  critical: { bg: "#FEE2E2", fg: "#991B1B", icon: "🚨" },
  high:     { bg: "#FEF3C7", fg: "#92400E", icon: "⚠️" },
  medium:   { bg: "#FEF9C3", fg: "#854D0E", icon: "⚡" },
  low:      { bg: "#DBEAFE", fg: "#1E40AF", icon: "ℹ️" },
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
        const s = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.low;
        return (
          <View key={alert.id} style={[styles.banner, { backgroundColor: s.bg }]}>
            <Text style={styles.icon}>{s.icon}</Text>
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
    borderColor: "rgba(0,0,0,0.05)",
  },
  icon: { fontSize: 20 },
  type: { fontSize: 10, fontWeight: "900", letterSpacing: 0.4 },
  message: { marginTop: 2, fontSize: 11, lineHeight: 15, fontWeight: "600" },
  score: { fontSize: 16, fontWeight: "900" },
});