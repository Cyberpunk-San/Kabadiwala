// src/components/ValuationCard.tsx
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Text } from "../ui/Text";

import { colors } from "../constants/theme";
import { getValuation } from "../services/api/client";
import { currency } from "../utils/format";

import { P } from "../constants/palette";
type Props = {
  material: string;
  quality: "low" | "medium" | "high";
  weightKg: number;
};

export function ValuationCard({ material, quality, weightKg }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["valuation", material, quality, weightKg],
    queryFn: () => getValuation({ material, quality, weightKg }),
    staleTime: 60_000,
  });

  if (!weightKg || weightKg <= 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Fair price estimate</Text>
        {data ? (
          <Text style={styles.confidence}>
            {Math.round(data.confidence * 100)}% confidence
          </Text>
        ) : null}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.green} style={{ marginVertical: 12 }} />
      ) : isError || !data ? (
        <Text style={styles.error}>Valuation unavailable</Text>
      ) : (
        <>
          <View style={styles.valuesRow}>
            <View>
              <Text style={styles.label}>FAIR RATE</Text>
              <Text style={styles.bigValue}>
                {currency(data.fair_price_per_kg)}
                <Text style={styles.unit}>/kg</Text>
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.label}>FAIR PAYOUT</Text>
              <Text style={styles.bigValueGreen}>
                {currency(data.fair_payout)}
              </Text>
            </View>
          </View>
          <Text style={styles.reasoning}>{data.reasoning}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: P("rgba(25,169,130,0.08)"),
    borderWidth: 1,
    borderColor: P("rgba(168,232,201,0.18)"),
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  kicker: { fontSize: 9, fontWeight: "900", color: P("#A8E8C9"), letterSpacing: 0.8 },
  confidence: { fontSize: 9, fontWeight: "700", color: P("#A8E8C9") },
  valuesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  label: { fontSize: 8, fontWeight: "900", color: P("#A8E8C9"), letterSpacing: 0.5 },
  bigValue: { marginTop: 4, fontSize: 18, fontWeight: "900", color: colors.green },
  bigValueGreen: { marginTop: 4, fontSize: 18, fontWeight: "900", color: colors.green },
  unit: { fontSize: 10, fontWeight: "700", color: colors.muted },
  reasoning: {
    marginTop: 10,
    fontSize: 10,
    color: P("rgba(248,250,247,0.62)"),
    lineHeight: 14,
    fontStyle: "italic",
  },
  error: { fontSize: 11, color: P("#E7898F"), fontWeight: "700", paddingVertical: 8 },
});