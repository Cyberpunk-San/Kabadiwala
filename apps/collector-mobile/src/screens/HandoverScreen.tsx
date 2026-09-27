// src/screens/HandoverScreen.tsx — QR + PIN pass the recycler uses to verify and pay.
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../ui/Text";
import QRCode from "react-native-qrcode-svg";
import Animated, { BounceIn, FadeInDown, ZoomIn } from "react-native-reanimated";

import { colors, gradients, radius, space, type } from "../constants/theme";
import { useScreenNarration } from "../hooks/useScreenNarration";
import { useTranslation } from "../hooks/useTranslation";
import { goTab } from "../navigation/ref";
import type { RootStackParamList } from "../navigation/types";
import { ApiError, confirmHandover, getLotPin, type HandoverReceipt } from "../services/api/client";
import { useAppStore } from "../store/appStore";
import { useAuthStore } from "../store/authStore";
import { materialName } from "../types/domain";
import { EmptyState, toast } from "../ui/feedback";
import { MaterialAvatar } from "../ui/materials";
import { Float, Skeleton } from "../ui/motion";
import { Badge, Button, Card, enter, GradientCard, Screen, TopBar, textStyles } from "../ui/primitives";
import { currency } from "../utils/format";

import { P } from "../constants/palette";
type Props = NativeStackScreenProps<RootStackParamList, "Handover">;

export function HandoverScreen({ route, navigation }: Props) {
  const { t, language } = useTranslation();
  useScreenNarration("Handover");
  const lot = useAppStore((s) => s.lots.find((l) => l.id === route.params.lotId));
  const updateLotStatus = useAppStore((s) => s.updateLotStatus);
  const syncNow = useAppStore((s) => s.syncNow);
  const collectorId = useAuthStore((s) => s.collector?.id);
  const refreshAuth = useAuthStore((s) => s.refresh);
  const [receipt, setReceipt] = useState<HandoverReceipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const pending = lot?.syncState === "PENDING";
  const pinQuery = useQuery({
    queryKey: ["pin", lot?.id],
    queryFn: () => getLotPin(lot!.id),
    enabled: !!lot && !pending,
    staleTime: Infinity,
  });

  if (!lot) {
    return (
      <Screen>
        <TopBar title={t("handoverPass")} onBack={() => navigation.goBack()} />
        <EmptyState icon="alert-circle-outline" title={t("pinError")} />
      </Screen>
    );
  }

  const settled = !!receipt || lot.status === "PAID" || lot.status === "SOLD";
  const pin = pinQuery.data;
  const qrValue = JSON.stringify({ lotId: lot.id, pin: pin ?? "" });

  const confirm = async () => {
    if (!pin) return;
    setBusy(true);
    try {
      const r = await confirmHandover({
        lotId: lot.id,
        pickupPin: pin,
        recyclerId: lot.recyclerId,
        recyclerName: lot.recyclerName,
        auditedWeightKg: lot.weightKg,
        agreedPayout: lot.expectedNetEarnings ?? 0,
        paymentMode: "UPI",
      });
      setReceipt(r);
      await updateLotStatus(lot.id, "PAID");
      void refreshAuth();
      toast.success(t("handoverSuccess"), currency(r.amount_paid));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        await updateLotStatus(lot.id, "PAID");
        toast.info(t("alreadyPaid"));
      } else {
        toast.error(t("serverDown"), err instanceof ApiError ? err.message : t("serverDownMsg"));
      }
    } finally {
      setBusy(false);
    }
  };

  const sync = async () => {
    setSyncing(true);
    await syncNow(collectorId);
    setSyncing(false);
  };

  return (
    <Screen>
      <TopBar kicker={t("handoverKicker")} title={t("handoverPass")} onBack={() => navigation.goBack()} />

      <Animated.View entering={enter(1)}>
        <GradientCard colorsList={settled ? gradients.emerald : gradients.night} style={{ alignItems: "center" }}>
          <View style={styles.passHead}>
            <MaterialAvatar material={lot.material} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.passMaterial} numberOfLines={1}>{materialName(lot.material, language)}</Text>
              <Text style={styles.passId} numberOfLines={1}>{lot.id}</Text>
            </View>
            <Badge label={settled ? t("paid") : pending ? t("waitingSync") : t("readyDropoff")} tone="light" icon={settled ? "checkmark-circle" : "time"} />
          </View>

          {settled ? (
            <Animated.View entering={BounceIn.duration(800)} style={styles.paidCircle}>
              <Ionicons name="checkmark" size={72} color={colors.onPrimary} />
            </Animated.View>
          ) : pending ? (
            <View style={styles.qrPlaceholder}>
              <Float><Ionicons name="cloud-upload-outline" size={56} color={P("#A8E8C9")} /></Float>
              <Text style={styles.waitText}>{t("waitingSyncMsg")}</Text>
              <Button label={t("syncNow")} icon="sync" variant="light" size="md" loading={syncing} onPress={sync} style={{ marginTop: space.md }} />
            </View>
          ) : (
            <>
              <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.qrBox}>
                {pin ? <QRCode value={qrValue} size={210} color="#04120F" backgroundColor="#FFFFFF" quietZone={8} ecl="M" /> : <Skeleton height={226} width={226} />}
              </Animated.View>
              <Text style={styles.scanHint}>{t("scanQr")}</Text>
              <Text style={styles.orPin}>{t("orPin")}</Text>
              <View style={styles.pinRow}>
                {pinQuery.isError ? (
                  <Button label={t("retry")} icon="refresh" variant="light" size="md" onPress={() => void pinQuery.refetch()} />
                ) : (
                  (pin ?? "····").split("").map((d, i) => (
                    <Animated.View key={i} entering={FadeInDown.delay(200 + i * 90).springify()} style={styles.pinDigit}>
                      <Text style={styles.pinText}>{d}</Text>
                    </Animated.View>
                  ))
                )}
              </View>
            </>
          )}
        </GradientCard>
      </Animated.View>

      <Animated.View entering={enter(2)}>
        <Card style={{ marginTop: space.md }}>
          <View style={styles.grid}>
            {[
              [t("weight"), `${lot.weightKg} ${t("kg")}`],
              [t("quality"), t(lot.quality)],
              [t("takeHome"), currency(receipt?.amount_paid ?? lot.expectedNetEarnings ?? 0)],
              [t("recyclerLbl"), lot.recyclerName ?? "—"],
            ].map(([label, value]) => (
              <View key={label} style={styles.gridItem}>
                <Text style={styles.gridLabel}>{label}</Text>
                <Text style={styles.gridValue} numberOfLines={2}>{value}</Text>
              </View>
            ))}
          </View>
          {lot.imageUris?.length ? (
            <>
              <Text style={[styles.gridLabel, { marginTop: space.md }]}>{t("lotPhotos")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
                {lot.imageUris.map((uri, i) => (
                  <Image key={uri + i} source={{ uri }} style={styles.photo} accessibilityLabel={`${t("lotPhotos")} ${i + 1}`} />
                ))}
              </ScrollView>
            </>
          ) : null}
        </Card>
      </Animated.View>

      {receipt ? (
        <Animated.View entering={FadeInDown.springify()}>
          <Card tone="soft" style={{ marginTop: space.md }}>
            <Text style={styles.receiptTitle}>{t("settled")}</Text>
            {[
              [t("utr"), receipt.utr_number],
              [t("epr"), receipt.epr_certificate_id],
              [t("carbon"), `${receipt.carbon_offset_kg} kg`],
              [t("mode"), receipt.payment_mode],
            ].map(([label, value]) => (
              <View key={label} style={styles.receiptRow}>
                <Text style={textStyles.small}>{label}</Text>
                <Text style={styles.receiptValue} selectable>{value}</Text>
              </View>
            ))}
          </Card>
          <Button label={t("earningsTitle")} icon="wallet" onPress={() => goTab("Earnings")} style={{ marginTop: space.lg }} />
        </Animated.View>
      ) : !settled && !pending ? (
        <Animated.View entering={enter(3)}>
          <Text style={[textStyles.small, { textAlign: "center", marginTop: space.lg }]}>{t("confirmHint")}</Text>
          <Button label={t("confirmHandover")} icon="hand-left" onPress={confirm} loading={busy} disabled={!pin} style={{ marginTop: space.sm }} />
          {pin ? <Text style={[textStyles.small, { textAlign: "center", marginTop: space.md }]}>{t("recyclerGuide", { lot: lot.id, pin })}</Text> : null}
        </Animated.View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  photoRow: { gap: space.sm, marginTop: space.sm },
  photo: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  passHead: { flexDirection: "row", alignItems: "center", gap: space.md, alignSelf: "stretch" },
  passMaterial: { fontSize: 17, fontWeight: "800", color: P("#F8FAF7") },
  passId: { fontSize: 11, color: P("#A8E8C9"), fontFamily: "monospace" },
  qrBox: { marginTop: space.xl, padding: 14, borderRadius: radius.lg, backgroundColor: colors.white },
  scanHint: { marginTop: space.md, color: P("rgba(248,250,247,0.62)"), fontSize: 13, fontWeight: "600" },
  orPin: { marginTop: space.lg, color: P("#A8E8C9"), fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  pinRow: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
  pinDigit: { width: 54, height: 64, borderRadius: radius.md, backgroundColor: P("rgba(255,255,255,0.14)"), borderWidth: 1, borderColor: P("rgba(255,255,255,0.3)"), alignItems: "center", justifyContent: "center" },
  pinText: { fontSize: 32, fontWeight: "800", color: P("#F8FAF7") },
  qrPlaceholder: { alignItems: "center", paddingVertical: space.xxl },
  waitText: { marginTop: space.md, color: P("rgba(248,250,247,0.62)"), textAlign: "center", fontSize: 14 },
  paidCircle: { marginVertical: space.xxl, width: 130, height: 130, borderRadius: 65, backgroundColor: P("#A8E8C9"), alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: space.md },
  gridItem: { width: "50%" },
  gridLabel: { fontSize: 11, fontWeight: "700", color: colors.muted },
  gridValue: { marginTop: 3, fontSize: 15, fontWeight: "800", color: colors.ink },
  receiptTitle: { ...type.h3, color: colors.primary, marginBottom: space.sm },
  receiptRow: { flexDirection: "row", justifyContent: "space-between", gap: space.md, paddingVertical: 6 },
  receiptValue: { flexShrink: 1, fontSize: 13, fontWeight: "700", color: colors.ink, textAlign: "right" },
});
