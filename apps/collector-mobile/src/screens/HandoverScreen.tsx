// apps/collector-mobile/src/screens/HandoverScreen.tsx
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";

import { RiskBanner } from "../components/RiskBanner";
import { colors } from "../constants/theme";
import { useTranslation } from "../hooks/useTranslation";
import { confirmHandover, getLotPin } from "../services/api/client";
import { useAppStore } from "../store/appStore";
import { currency } from "../utils/format";
import type { Material } from "../types/domain";

interface HandoverProps {
  navigation: {
    navigate: (screen: string, params?: any) => void;
    goBack: () => void;
  };
  route: {
    params?: {
      lotId?: string;
      material?: Material;
      weightKg?: number;
      netAmount?: number;
    };
  };
}

export function HandoverScreen({ navigation, route }: HandoverProps) {
  const { t } = useTranslation();
  const lots = useAppStore((state) => state.lots);
  const updateLotStatus = useAppStore((state) => state.updateLotStatus);

  const lotId = route.params?.lotId ?? lots[0]?.id ?? "lot_demo_copper_01";
  const currentLot = lots.find((l) => l.id === lotId) ?? {
    id: lotId,
    material: route.params?.material ?? "Copper cable",
    weightKg: route.params?.weightKg ?? 35,
    quality: "medium" as const,
    expectedNetEarnings: route.params?.netAmount ?? 18450,
    status: "PICKUP_SCHEDULED" as const,
  };

  const [pickupPin, setPickupPin] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isSettled, setIsSettled] = useState(
    currentLot.status === "SOLD" || currentLot.status === "PAID"
  );
  const [utrNumber, setUtrNumber] = useState<string>("");
  const [eprCertId, setEprCertId] = useState<string>("");
  const [isBusy, setIsBusy] = useState(false);

  // ─── Fetch the server-owned PIN for this lot ─────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setPickupPin(null);
    setPinError(null);

    getLotPin(currentLot.id)
      .then((pin) => {
        if (!cancelled) setPickupPin(pin);
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn("[handover] PIN fetch failed:", err);
          setPinError("Could not load PIN — check backend connection.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentLot.id]);

  // QR payload includes the real PIN + lot metadata.
  const qrPayload = useMemo(
    () =>
      JSON.stringify({
        lotId: currentLot.id,
        material: currentLot.material,
        weightKg: currentLot.weightKg,
        amount: currentLot.expectedNetEarnings,
        pin: pickupPin ?? "----",
        hub: "Pune Bhosari Cluster",
        sig: "MHK_OK",
      }),
    [currentLot, pickupPin]
  );

  // ─── Confirm handover via the backend ────────────────────────────────────
  const confirmHandoverAction = async () => {
    if (!pickupPin) {
      Alert.alert("Please wait", "PIN not loaded yet.");
      return;
    }
    setIsBusy(true);
    try {
      const receipt = await confirmHandover({
        lotId: currentLot.id,
        pickupPin,
        recyclerId: "REC-PUNE-01",
        recyclerName: "EcoCycle Recyclers Pvt Ltd",
        auditedWeightKg: currentLot.weightKg,
        agreedPayout: currentLot.expectedNetEarnings ?? 0,
        paymentMode: "UPI",
      });

      setUtrNumber(receipt.utr_number);
      setEprCertId(receipt.epr_certificate_id);
      setIsSettled(true);
      await updateLotStatus(currentLot.id, "PAID");

      Alert.alert(
        "✓ " + t("handoverSuccess"),
        `${t("instantPayoutSim")}\nUTR: ${receipt.utr_number}\nAmount: ${currency(receipt.amount_paid)}`,
        [
          { text: "View Earnings", onPress: () => navigation.navigate("Earnings") },
          { text: "Back to Home", onPress: () => navigation.navigate("Home") },
        ]
      );
    } catch (err: any) {
      Alert.alert(
        "Handover failed",
        err?.message ?? "Could not reach the backend. Check your connection."
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Risk alerts for this lot (if any) */}
      <RiskBanner lotId={currentLot.id} />

      {/* Top bar */}
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.verifiedBadge}>
          <Text style={styles.verifiedBadgeText}>✓ {t("traceabilityPass")}</Text>
        </View>
      </View>

      <Text style={styles.kicker}>SECURE DIGITAL HANDOVER</Text>
      <Text style={styles.title}>{t("handoverPass")}</Text>

      {/* Pass Card */}
      <View style={styles.passCard}>
        <View style={styles.passHeader}>
          <View>
            <Text style={styles.brandTitle}>MAI HU KABADIWALA</Text>
            <Text style={styles.lotIdText}>{currentLot.id}</Text>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>
              {isSettled ? "PAID & SETTLED" : "READY FOR DROP-OFF"}
            </Text>
          </View>
        </View>

        {/* QR */}
        <View style={styles.qrWrapper}>
          <QRCode
            value={qrPayload}
            size={168}
            color={colors.ink}
            backgroundColor={colors.white}
            quietZone={4}
          />
        </View>

        <Text style={styles.scanHint}>{t("scanQrPrompt")}</Text>

        {/* PIN */}
        <View style={styles.pinBox}>
          <Text style={styles.pinLabel}>{t("orSharePin")}:</Text>
          {pickupPin ? (
            <View style={styles.pinDigits}>
              {pickupPin.split("").map((digit, index) => (
                <View key={index} style={styles.pinBoxDigit}>
                  <Text style={styles.pinDigitText}>{digit}</Text>
                </View>
              ))}
            </View>
          ) : pinError ? (
            <Text style={styles.pinError}>{pinError}</Text>
          ) : (
            <ActivityIndicator color={colors.green} style={{ marginVertical: 8 }} />
          )}
        </View>

        {/* Details */}
        <View style={styles.detailsGrid}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>{t("material")}</Text>
            <Text style={styles.detailVal}>{currentLot.material}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>{t("weight")}</Text>
            <Text style={styles.detailVal}>{currentLot.weightKg} kg</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Quality</Text>
            <Text style={styles.detailVal}>{currentLot.quality.toUpperCase()}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>{t("takeHome")}</Text>
            <Text style={styles.detailValGreen}>
              {currency(currentLot.expectedNetEarnings ?? 0)}
            </Text>
          </View>
        </View>
      </View>

      {/* Settlement */}
      {isSettled ? (
        <View style={styles.receiptCard}>
          <View style={styles.receiptHeader}>
            <Text style={styles.receiptIcon}>✓</Text>
            <View>
              <Text style={styles.receiptTitle}>{t("instantPayoutSim")}</Text>
              <Text style={styles.receiptStatus}>Payment Complete</Text>
            </View>
          </View>
          <View style={styles.receiptDivider} />
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>{t("utrNumber")}:</Text>
            <Text style={styles.receiptVal}>{utrNumber || "—"}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>EPR Certificate:</Text>
            <Text style={styles.receiptVal}>{eprCertId || "—"}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Mode:</Text>
            <Text style={styles.receiptVal}>UPI Instant / Auto-Clear</Text>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.actionBtn, (!pickupPin || isBusy) && styles.actionBtnDisabled]}
          onPress={confirmHandoverAction}
          disabled={!pickupPin || isBusy}
        >
          {isBusy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Text style={styles.actionBtnText}>🤝 {t("confirmHandover")}</Text>
              <Text style={styles.actionSubtext}>
                Simulate Recycler Verification & Instant Credit
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Web guide */}
      <View style={styles.webGuideCard}>
        <Text style={styles.webGuideTitle}>Recycler Web Integration</Text>
        <Text style={styles.webGuideText}>
          Recyclers open{" "}
          <Text style={styles.bold}>apps/recycler-web/index.html</Text> in any browser,
          enter Lot ID <Text style={styles.bold}>{currentLot.id}</Text> and PIN{" "}
          <Text style={styles.bold}>{pickupPin ?? "----"}</Text> to inspect and approve
          this lot.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 18, paddingBottom: 40 },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#E2EBE4",
  },
  backBtnText: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  verifiedBadge: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.greenLight,
  },
  verifiedBadgeText: { color: colors.green, fontSize: 10, fontWeight: "800" },

  kicker: { color: "#84948B", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  title: {
    marginTop: 4,
    marginBottom: 14,
    color: colors.ink,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },

  passCard: {
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
  },
  passHeader: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2EE",
  },
  brandTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.green,
    letterSpacing: 0.8,
  },
  lotIdText: {
    fontSize: 10,
    color: colors.muted,
    fontWeight: "700",
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#FDF2E9",
  },
  statusPillText: { fontSize: 8, fontWeight: "800", color: "#C05621" },

  qrWrapper: {
    position: "relative",
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  scanHint: {
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
    marginBottom: 12,
  },

  pinBox: {
    width: "100%",
    backgroundColor: "#F8FAF9",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2EAE3",
  },
  pinLabel: {
    fontSize: 10,
    color: colors.muted,
    fontWeight: "700",
    marginBottom: 6,
  },
  pinDigits: { flexDirection: "row", gap: 8 },
  pinBoxDigit: {
    width: 38,
    height: 42,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  pinDigitText: { fontSize: 20, fontWeight: "900", color: colors.green },
  pinError: {
    fontSize: 11,
    color: "#C53030",
    fontWeight: "700",
    paddingVertical: 6,
  },

  detailsGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: 1,
    borderTopColor: "#EEF2EE",
    paddingTop: 12,
  },
  detailItem: { width: "50%", paddingVertical: 6 },
  detailLabel: { fontSize: 9, color: colors.muted, fontWeight: "700" },
  detailVal: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.ink,
    marginTop: 2,
  },
  detailValGreen: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.green,
    marginTop: 2,
  },

  actionBtn: {
    marginTop: 14,
    backgroundColor: colors.green,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  actionBtnDisabled: { backgroundColor: "#B7C7BC" },
  actionBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  actionSubtext: { color: "#D1EADB", fontSize: 10, marginTop: 3 },

  receiptCard: {
    marginTop: 14,
    backgroundColor: "#EDFDF3",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#A3E6B9",
  },
  receiptHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  receiptIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.green,
    color: colors.white,
    textAlign: "center",
    paddingTop: 4,
    fontSize: 18,
    fontWeight: "900",
  },
  receiptTitle: { fontSize: 14, fontWeight: "900", color: colors.green },
  receiptStatus: { fontSize: 10, color: "#2B7A4B", fontWeight: "700" },
  receiptDivider: {
    height: 1,
    backgroundColor: "#C3EDD2",
    marginVertical: 10,
  },
  receiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  receiptLabel: { fontSize: 10, color: "#2B7A4B", fontWeight: "600" },
  receiptVal: {
    fontSize: 10,
    color: colors.ink,
    fontWeight: "800",
    maxWidth: "60%",
    textAlign: "right",
  },

  webGuideCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  webGuideTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: 4,
  },
  webGuideText: { fontSize: 10, color: colors.muted, lineHeight: 15 },
  bold: { fontWeight: "800", color: colors.green },
});
