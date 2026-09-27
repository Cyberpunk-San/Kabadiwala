// src/screens/RequestPickupScreen.tsx — household/company asks nearby kabadiwalas to collect scrap.
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Image, StyleSheet, TextInput, View } from "react-native";
import { Text } from "../ui/Text";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import { colors, radius, space, type } from "../constants/theme";
import { useTranslation } from "../hooks/useTranslation";
import { go } from "../navigation/ref";
import { analyseMaterial, ApiError, createPickup, type PickupSlot } from "../services/api/client";
import { getCurrentCoordinates } from "../services/location/gpsService";
import { useBazarPrices } from "../data/prices";
import { useAccount, useAuthStore } from "../store/authStore";
import { ALL_MATERIALS, MATERIAL_METADATA, materialName, type Material } from "../types/domain";
import { toast } from "../ui/feedback";
import { ScheduleChips, SLOT_KEY } from "../components/ScheduleChips";
import { MaterialAvatar } from "../ui/materials";
import { AnimatedNumber, ScanOverlay } from "../ui/motion";
import { Button, Card, Chip, enter, InkTitle, PressScale, Screen, textStyles } from "../ui/primitives";
import { currency, localDateISO, scheduleLabel } from "../utils/format";

import { P } from "../constants/palette";
const DOORSTEP_FACTOR = 0.7; // same as the backend estimate

export function RequestPickupScreen() {
  const { t, language } = useTranslation();
  const { role, id } = useAccount();
  const household = useAuthStore((s) => s.household);
  const company = useAuthStore((s) => s.company);
  const queryClient = useQueryClient();

  const bulk = role === "company";
  const weights = bulk ? [50, 100, 250, 500, 1000] : [2, 5, 10, 25, 50];
  const [material, setMaterial] = useState<Material>("Mixed e-waste");
  const [weight, setWeight] = useState(String(bulk ? 100 : 5));
  const [address, setAddress] = useState(household?.address ?? company?.address ?? "");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number }>();
  const [day, setDay] = useState(localDateISO(0));
  const [slot, setSlot] = useState<PickupSlot>("anytime");
  const [notes, setNotes] = useState("");
  const [imageUri, setImageUri] = useState<string>();
  const [analysing, setAnalysing] = useState(false);
  const [busy, setBusy] = useState(false);

  const prices = useBazarPrices();
  const kg = Number(weight.replace(",", "."));
  const weightOk = Number.isFinite(kg) && kg > 0 && kg <= 100000;
  const rate = prices.find((p) => p.material === material)?.currentPrice ?? MATERIAL_METADATA[material].basePricePerKg;
  const estimate = weightOk ? Math.round(rate * DOORSTEP_FACTOR * kg) : 0;

  const scan = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.5, base64: true, allowsEditing: true, aspect: [1, 1] };
    const res = perm.granted ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const asset = res.canceled ? undefined : res.assets[0];
    if (!asset) return;
    setImageUri(asset.uri);
    setAnalysing(true);
    const pred = await analyseMaterial(asset.base64 ?? "");
    setAnalysing(false);
    if (pred.confidence >= 0.35) {
      setMaterial(pred.material);
      toast.success(materialName(pred.material, language), t("sure", { n: Math.round(pred.confidence * 100) }));
    } else toast.info(t("notSure"));
  };

  const locate = async () => {
    const loc = await getCurrentCoordinates();
    if (loc) {
      setCoords({ latitude: loc.latitude, longitude: loc.longitude });
      toast.success(t("locationSet"));
    } else toast.warn(t("locationDenied"));
  };

  const submit = async () => {
    if (!id || (role !== "household" && role !== "company")) return;
    setBusy(true);
    try {
      const p = await createPickup({
        requester_type: role, requester_id: id, material, estimated_weight_kg: kg,
        address: address.trim() || undefined, ...coords, notes: notes.trim() || undefined,
        preferred_date: day, preferred_slot: slot, preferred_time: `${scheduleLabel(day, language)} · ${t(SLOT_KEY[slot])}`,
      });
      await queryClient.invalidateQueries({ queryKey: ["my-pickups"] });
      toast.success(t("requestSent"), t("requestSentMsg"));
      setImageUri(undefined);
      setNotes("");
      go("PickupDetail", { pickupId: p.id });
    } catch (err) {
      toast.error(t("serverDown"), err instanceof ApiError ? err.message : t("serverDownMsg"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen withTabBar>
      <Animated.View entering={enter(0)}>
        <Text style={textStyles.kicker}>{bulk ? t("bulk") : t("roleHousehold")}</Text>
        <InkTitle style={styles.title}>{t("requestPickup")}</InkTitle>
      </Animated.View>

      {/* Optional AI photo */}
      <Animated.View entering={enter(1)}>
        <PressScale onPress={scan} style={styles.photoCard} accessibilityRole="button" accessibilityLabel={t("takePhoto")}>
          {imageUri ? (
            <Animated.View entering={ZoomIn} style={StyleSheet.absoluteFill}>
              <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} />
              <ScanOverlay active={analysing} />
            </Animated.View>
          ) : (
            <>
              <Ionicons name="camera" size={32} color={colors.primary} />
              <Text style={styles.photoText}>{t("takePhoto")} · AI</Text>
              <Text style={textStyles.small}>{t("scanHint")}</Text>
            </>
          )}
        </PressScale>
      </Animated.View>

      <Card style={{ marginTop: space.md }}>
        <Text style={styles.label}>{t("whatScrap")}</Text>
        <View style={styles.grid}>
          {ALL_MATERIALS.map((m) => {
            const on = m === material;
            return (
              <PressScale key={m} onPress={() => setMaterial(m)} style={[styles.cell, on && styles.cellOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                <MaterialAvatar material={m} size={32} />
                <Text style={[styles.cellText, on && { color: colors.primary }]} numberOfLines={2}>{materialName(m, language)}</Text>
              </PressScale>
            );
          })}
        </View>

        <Text style={[styles.label, { marginTop: space.lg }]}>{t("howMuch")}</Text>
        <View style={styles.weightRow}>
          <TextInput value={weight} onChangeText={(v) => setWeight(v.replace(/[^0-9.,]/g, ""))} keyboardType="decimal-pad" style={styles.weightInput} maxLength={7} accessibilityLabel={t("weight")} />
          <Text style={styles.kg}>{t("kg")}</Text>
        </View>
        <View style={styles.chips}>
          {weights.map((w) => <Chip key={w} label={`${w} ${t("kg")}`} active={kg === w} onPress={() => setWeight(String(w))} />)}
        </View>

        <Text style={[styles.label, { marginTop: space.lg }]}>{t("whereFrom")}</Text>
        <TextInput value={address} onChangeText={setAddress} placeholder={t("address")} placeholderTextColor={colors.faint} style={styles.input} multiline accessibilityLabel={t("address")} />
        <Button label={coords ? t("locationSet") : t("useMyLocation")} icon={coords ? "checkmark-circle" : "locate"} variant="secondary" size="md" onPress={locate} style={{ marginTop: space.sm }} />

        <View style={{ marginTop: space.lg }}>
          <ScheduleChips date={day} slot={slot} onDate={setDay} onSlot={setSlot} />
        </View>

        <TextInput value={notes} onChangeText={setNotes} placeholder={t("notes")} placeholderTextColor={colors.faint} style={[styles.input, { marginTop: space.lg }]} maxLength={500} multiline accessibilityLabel={t("notes")} />
      </Card>

      <Animated.View entering={FadeIn}>
        <Card tone="soft" style={styles.estimate}>
          <View style={{ flex: 1 }}>
            <Text style={textStyles.kicker}>{t("estimatedValue")}</Text>
            <AnimatedNumber value={estimate} format={currency} style={styles.estimateValue} />
          </View>
          <MaterialAvatar material={material} size={48} />
        </Card>
      </Animated.View>

      <Button label={t("requestPickup")} icon="send" onPress={submit} loading={busy} disabled={!weightOk || analysing} style={{ marginTop: space.lg }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...type.h1, color: colors.ink, marginTop: 2, marginBottom: space.lg },
  photoCard: { height: 150, borderRadius: radius.xl, overflow: "hidden", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: P("rgba(248,250,247,0.04)"), borderWidth: 2, borderStyle: "dashed", borderColor: P("rgba(168,232,201,0.3)") },
  photoText: { fontSize: 15, fontWeight: "800", color: colors.primary },
  label: { fontSize: 14, fontWeight: "800", color: colors.ink, marginBottom: space.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  cell: { width: 96, flexGrow: 1, alignItems: "center", gap: 6, paddingVertical: space.sm, paddingHorizontal: 4, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 2, borderColor: "transparent" },
  cellOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  cellText: { fontSize: 11, fontWeight: "700", color: colors.inkSoft, textAlign: "center" },
  weightRow: { flexDirection: "row", alignItems: "baseline", gap: 8, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 2, borderColor: colors.line },
  weightInput: { flex: 1, fontSize: 28, fontWeight: "800", color: colors.ink, paddingVertical: 8 },
  kg: { fontSize: 16, fontWeight: "700", color: colors.muted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm },
  input: { fontSize: 15, color: colors.ink, padding: space.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.bg, minHeight: 48 },
  estimate: { flexDirection: "row", alignItems: "center", marginTop: space.md },
  estimateValue: { marginTop: 4, fontSize: 26, fontWeight: "800", color: colors.primary },
});
