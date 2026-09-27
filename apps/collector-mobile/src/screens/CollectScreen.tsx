// src/screens/CollectScreen.tsx — photo → AI identification → confirm material & weight → market.
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, TextInput, View } from "react-native";
import { Text } from "../ui/Text";
import Animated, { FadeIn, FadeInDown, Layout, ZoomIn } from "react-native-reanimated";

import { VoiceInputButton } from "../components/VoiceInputButton";
import { colors, radius, space, type } from "../constants/theme";
import { combinePredictions } from "../features/lots/photoConsensus";
import { valuateLot } from "../features/lots/valuationEngine";
import { useScreenNarration } from "../hooks/useScreenNarration";
import { useTranslation } from "../hooks/useTranslation";
import type { TranslationKey } from "../i18n";
import type { RootTabParamList } from "../navigation/types";
import { analyseMaterial, getValuation } from "../services/api/client";
import { matchMaterial, parseSpokenNumber } from "../services/voice/parser";
import { speak } from "../services/voice/speech";
import { ALL_MATERIALS, MATERIAL_METADATA, materialName, type Material, type MaterialPrediction } from "../types/domain";
import { Sheet, toast } from "../ui/feedback";
import { MaterialAvatar } from "../ui/materials";
import { AnimatedNumber, Float, ProgressBar, ScanOverlay } from "../ui/motion";
import { Badge, Button, Card, Chip, enter, InkTitle, PressScale, Screen, textStyles } from "../ui/primitives";
import { currency } from "../utils/format";

import { P } from "../constants/palette";
type Props = BottomTabScreenProps<RootTabParamList, "Collect">;
type Quality = "low" | "medium" | "high";

const LOW_CONFIDENCE = 0.35;
const QUICK_WEIGHTS = [5, 10, 25, 50, 100];
const MAX_PHOTOS = 4;

type Photo = { uri: string; prediction?: MaterialPrediction };

export function CollectScreen({ route, navigation }: Props) {
  const { t, language } = useTranslation();
  useScreenNarration("Collect");

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [activePhoto, setActivePhoto] = useState(0);
  const [analysing, setAnalysing] = useState(false);
  const [manual, setManual] = useState(false);
  const [material, setMaterial] = useState<Material>("Copper cable");
  const [quality, setQuality] = useState<Quality>("medium");
  const [weightText, setWeightText] = useState("10");
  const [hazardOpen, setHazardOpen] = useState(false);
  const [hazardAcked, setHazardAcked] = useState<Material | null>(null);

  // Prefill from Demands / Opportunity / voice commands.
  const prefillMaterial = route.params?.prefillMaterial;
  const prefillWeight = route.params?.prefillWeightKg;
  useEffect(() => {
    if (prefillMaterial) {
      setMaterial(prefillMaterial);
      setManual(true);
    }
    if (prefillWeight) setWeightText(String(prefillWeight));
  }, [prefillMaterial, prefillWeight]);

  // Several photos of one lot → one combined answer (and a warning if they disagree).
  const consensus = useMemo(
    () => combinePredictions(photos.flatMap((p) => (p.prediction ? [p.prediction] : []))),
    [photos]
  );
  const prediction = consensus?.prediction;
  const shownPhoto = photos[Math.min(activePhoto, photos.length - 1)];

  const weightKg = Number(weightText.replace(",", "."));
  const weightValid = Number.isFinite(weightKg) && weightKg >= 0.1 && weightKg <= 5000;
  const confirming = manual || !!prediction;
  const meta = MATERIAL_METADATA[material];
  const step = !confirming ? 0 : 1;

  const selectMaterial = (m: Material, announce = false) => {
    setMaterial(m);
    if (announce) speak(materialName(m, language), language);
    if (MATERIAL_METADATA[m].hazard && hazardAcked !== m) {
      setHazardOpen(true);
      speak(`${t("hazardAlert")}. ${MATERIAL_METADATA[m].safetyWarning ?? ""}`, language);
    }
  };

  const pick = async (source: "camera" | "gallery") => {
    try {
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          toast.warn(t("cameraDenied"), t("cameraDeniedMsg"));
          return;
        }
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.5, base64: true, allowsEditing: true, aspect: [1, 1] };
      const result = source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return;

      const index = photos.length;
      setPhotos((prev) => [...prev, { uri: asset.uri }]);
      setActivePhoto(index);
      setAnalysing(true);
      const res = await analyseMaterial(asset.base64 ?? "");
      const next = [...photos, { uri: asset.uri, prediction: res }];
      setPhotos(next);

      const combined = combinePredictions(next.flatMap((p) => (p.prediction ? [p.prediction] : [])));
      if (combined) {
        setQuality(combined.prediction.quality);
        if (combined.prediction.confidence >= LOW_CONFIDENCE && combined.prediction.material !== material) {
          selectMaterial(combined.prediction.material, true);
        }
      }
    } catch (err) {
      console.warn("[collect] picker failed:", err);
      toast.error(t("cameraDenied"), t("cameraDeniedMsg"));
    } finally {
      setAnalysing(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setActivePhoto(0);
  };

  const reset = () => {
    setPhotos([]);
    setActivePhoto(0);
    setManual(false);
    setHazardAcked(null);
    navigation.setParams({ prefillMaterial: undefined, prefillWeightKg: undefined });
  };

  const onVoiceMaterial = (text: string) => {
    const m = matchMaterial(text);
    if (m) selectMaterial(m, true);
    else toast.warn(t("notUnderstood"), `"${text}"`);
  };
  const onVoiceWeight = (text: string) => {
    const kg = parseSpokenNumber(text, language);
    if (!Number.isNaN(kg) && kg > 0 && kg <= 5000) {
      setWeightText(String(kg));
      speak(`${kg} ${t("kg")}`, language);
    } else toast.warn(t("notUnderstood"), `"${text}"`);
  };

  const goToMarket = () => {
    if (!weightValid) {
      toast.warn(t("weightInvalid"));
      return;
    }
    if (meta.hazard && hazardAcked !== material) {
      setHazardOpen(true);
      return;
    }
    const uris = photos.map((p) => p.uri);
    navigation.navigate("Market", { material, quality, weightKg, imageUri: uris[0], imageUris: uris.length ? uris : undefined });
  };

  const lowConfidence = prediction && prediction.confidence < LOW_CONFIDENCE;
  const sourceKey: TranslationKey = prediction?.source === "huggingface" ? "sourceHf" : prediction?.source === "local" ? "sourceLocal" : "sourceFallback";

  return (
    <Screen withTabBar>
      <Animated.View entering={enter(0)}>
        <Text style={textStyles.kicker}>{t("scanKicker")}</Text>
        <InkTitle style={styles.title}>{t("scanTitle")}</InkTitle>
      </Animated.View>

      {/* Stepper */}
      <View style={styles.stepper}>
        {(["stepPhoto", "stepConfirm", "stepSell"] as const).map((k, i) => (
          <View key={k} style={{ flex: 1, gap: 6 }}>
            <ProgressBar progress={i <= step ? 1 : 0} height={5} color={i <= step ? colors.orange : colors.line} />
            <Text style={[styles.stepLabel, i <= step && { color: colors.ink }]}>{t(k)}</Text>
          </View>
        ))}
      </View>

      {/* Capture / preview */}
      {shownPhoto ? (
        <>
        <Animated.View entering={ZoomIn.springify().damping(16)} style={styles.previewWrap}>
          <Image source={{ uri: shownPhoto.uri }} style={styles.preview} />
          <ScanOverlay active={analysing} />
          {analysing ? (
            <Animated.View entering={FadeIn} style={styles.analysingPill}>
              <Ionicons name="sparkles" size={14} color={colors.white} />
              <Text style={styles.analysingText}>{t("analysing")}</Text>
            </Animated.View>
          ) : null}
          <PressScale onPress={reset} style={styles.retake} accessibilityLabel={t("retake")}>
            <Ionicons name="refresh" size={18} color={colors.white} />
          </PressScale>
        </Animated.View>

        <View style={styles.thumbRow}>
          {photos.map((ph, i) => (
            <PressScale key={ph.uri + i} onPress={() => setActivePhoto(i)} style={[styles.thumb, i === activePhoto && styles.thumbOn]} accessibilityLabel={`${t("lotPhotos")} ${i + 1}`}>
              <Image source={{ uri: ph.uri }} style={StyleSheet.absoluteFill} />
              {!analysing ? (
                <PressScale onPress={() => removePhoto(i)} style={styles.thumbRemove} accessibilityLabel={t("removePhoto")}>
                  <Ionicons name="close" size={12} color={colors.white} />
                </PressScale>
              ) : null}
            </PressScale>
          ))}
          {photos.length < MAX_PHOTOS && !analysing ? (
            <PressScale onPress={() => pick("camera")} onLongPress={() => pick("gallery")} style={[styles.thumb, styles.thumbAdd]} accessibilityLabel={t("addPhoto")}>
              <Ionicons name="add" size={22} color={colors.primary} />
            </PressScale>
          ) : null}
          <Text style={styles.thumbCount}>{t("photosCount", { n: photos.length, max: MAX_PHOTOS })}</Text>
        </View>
        {photos.length === 1 && !analysing ? <Text style={styles.moreHint}>{t("morePhotosHint")}</Text> : null}
        </>
      ) : !manual ? (
        <Animated.View entering={enter(1)} style={styles.captureCard}>
          <ScanOverlay active={false} />
          <Float>
            <View style={styles.captureIcon}>
              <Ionicons name="camera" size={40} color={colors.primary} />
            </View>
          </Float>
          <Text style={styles.captureHint}>{t("scanHint")}</Text>
          <View style={styles.captureBtns}>
            <Button label={t("takePhoto")} icon="camera" onPress={() => pick("camera")} style={{ flex: 1.3 }} />
            <Button label={t("fromGallery")} icon="images" variant="secondary" onPress={() => pick("gallery")} style={{ flex: 1 }} />
          </View>
          <PressScale onPress={() => setManual(true)} style={styles.manualLink}>
            <Text style={styles.manualText}>{t("manualEntry")}</Text>
          </PressScale>
        </Animated.View>
      ) : null}

      {/* AI result */}
      {prediction && !analysing ? (
        <Animated.View entering={FadeInDown.springify().damping(16)}>
          <Card style={{ marginTop: space.md }} tone={lowConfidence ? "warn" : "surface"}>
            <View style={styles.resultHead}>
              <Text style={textStyles.kicker}>{t("aiResult")}</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {consensus && consensus.photoCount > 1 ? <Badge label={t("photosCount", { n: consensus.photoCount, max: MAX_PHOTOS })} tone="info" icon="images" /> : null}
                <Badge label={t(sourceKey)} tone={prediction.source === "fallback" ? "muted" : "primary"} icon="hardware-chip-outline" />
              </View>
            </View>
            {lowConfidence ? (
              <Text style={styles.notSure}>{prediction.source === "fallback" && prediction.safetyMessage ? prediction.safetyMessage : t("notSure")}</Text>
            ) : (
              <>
                <View style={styles.resultRow}>
                  <MaterialAvatar material={prediction.material} size={56} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName}>{materialName(prediction.material, language)}</Text>
                    <Text style={textStyles.small}>{t("sure", { n: Math.round(prediction.confidence * 100) })}</Text>
                  </View>
                </View>
                <View style={{ marginTop: space.md }}>
                  <ProgressBar progress={prediction.confidence} color={prediction.confidence > 0.6 ? colors.primary : colors.accent} />
                </View>
              </>
            )}
            {prediction.alternatives?.length ? (
              <>
                <Text style={[textStyles.small, { marginTop: space.md, marginBottom: space.sm }]}>{t("couldAlsoBe")}</Text>
                <View style={styles.chips}>
                  {prediction.alternatives.map((a) => (
                    <Chip key={a.material} label={`${materialName(a.material, language)} · ${Math.round(a.confidence * 100)}%`} onPress={() => selectMaterial(a.material, true)} />
                  ))}
                </View>
              </>
            ) : null}
          </Card>
          {consensus?.conflicting.length ? (
            <Card tone="warn" style={{ marginTop: space.md }}>
              <View style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
                <Ionicons name="git-branch" size={24} color={P("#E5B86A")} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.safetyTitle}>{t("mixedLot")}</Text>
                  <Text style={styles.safetyText}>
                    {t("mixedLotMsg", { items: consensus.conflicting.map((m) => materialName(m, language)).join(", ") })}
                  </Text>
                </View>
              </View>
              <Button label={t("sellAsMixed")} icon="layers" variant="secondary" size="md" onPress={() => selectMaterial("Mixed e-waste", true)} style={{ marginTop: space.md }} />
            </Card>
          ) : null}
        </Animated.View>
      ) : null}

      {/* Confirm material + weight */}
      {confirming && !analysing ? (
        <Animated.View entering={FadeInDown.delay(120).springify().damping(16)} layout={Layout.springify()}>
          <Card style={{ marginTop: space.md }}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>{t("chooseMaterial")}</Text>
              <VoiceInputButton language={language} label={t("speakMaterial")} onResult={onVoiceMaterial} />
            </View>
            <View style={styles.materialGrid}>
              {ALL_MATERIALS.map((m) => {
                const on = m === material;
                const hazard = MATERIAL_METADATA[m].hazard;
                return (
                  <PressScale key={m} onPress={() => selectMaterial(m)} style={[styles.matCell, on && styles.matCellOn, hazard && !on && styles.matCellHazard]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                    <MaterialAvatar material={m} size={34} />
                    <Text style={[styles.matText, on && { color: colors.primary }]} numberOfLines={2}>{materialName(m, language)}</Text>
                    {hazard ? <Ionicons name="warning" size={13} color={colors.danger} style={styles.matWarn} /> : null}
                  </PressScale>
                );
              })}
            </View>

            <View style={[styles.labelRow, { marginTop: space.lg }]}>
              <Text style={styles.label}>{t("weight")}</Text>
              <VoiceInputButton language={language} label={t("speakWeight")} onResult={onVoiceWeight} />
            </View>
            <View style={styles.weightRow}>
              <PressScale onPress={() => setWeightText(String(Math.max(0.5, (weightValid ? weightKg : 1) - 1)))} style={styles.weightBtn} accessibilityLabel="-1 kg">
                <Ionicons name="remove" size={24} color={colors.primary} />
              </PressScale>
              <View style={styles.weightBox}>
                <TextInput value={weightText} onChangeText={(v) => setWeightText(v.replace(/[^0-9.,]/g, ""))} keyboardType="decimal-pad" style={styles.weightInput} accessibilityLabel={t("weight")} maxLength={6} />
                <Text style={styles.kg}>{t("kg")}</Text>
              </View>
              <PressScale onPress={() => setWeightText(String((weightValid ? weightKg : 0) + 1))} style={styles.weightBtn} accessibilityLabel="+1 kg">
                <Ionicons name="add" size={24} color={colors.primary} />
              </PressScale>
            </View>
            <View style={[styles.chips, { marginTop: space.md, justifyContent: "center" }]}>
              {QUICK_WEIGHTS.map((w) => (
                <Chip key={w} label={`${w} ${t("kg")}`} active={weightKg === w} onPress={() => setWeightText(String(w))} />
              ))}
            </View>
            {!weightValid ? <Text style={styles.error}>{t("weightInvalid")}</Text> : null}

            <Text style={[styles.label, { marginTop: space.lg, marginBottom: space.sm }]}>{t("quality")}</Text>
            <View style={styles.chips}>
              {(["low", "medium", "high"] as const).map((q) => (
                <Chip key={q} label={t(q)} active={quality === q} onPress={() => setQuality(q)} />
              ))}
            </View>
          </Card>

          <Card tone={meta.hazard ? "danger" : "warn"} style={{ marginTop: space.md }}>
            <View style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
              <Ionicons name={meta.hazard ? "flame" : "shield-checkmark"} size={26} color={meta.hazard ? colors.danger : P("#E5B86A")} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.safetyTitle, meta.hazard && { color: colors.danger }]}>{meta.hazard ? t("hazardAlert") : t("safety")}</Text>
                <Text style={styles.safetyText}>{meta.safetyWarning ?? t("safetyText")}</Text>
              </View>
              <PressScale onPress={() => speak(meta.safetyWarning ?? t("safetyText"), language)} style={styles.listenBtn} accessibilityLabel={t("listen")}>
                <Ionicons name="volume-high" size={18} color={colors.ink} />
              </PressScale>
            </View>
          </Card>

          {weightValid ? <FairPriceCard material={material} quality={quality} weightKg={weightKg} /> : null}

          <Button label={t("checkBestPrice")} icon="storefront" onPress={goToMarket} disabled={!weightValid} style={{ marginTop: space.lg }} />
          {manual && !photos.length ? <Button label={t("takePhoto")} icon="camera" variant="ghost" onPress={() => setManual(false)} style={{ marginTop: space.sm }} /> : null}
        </Animated.View>
      ) : null}

      {/* Hazard acknowledgement */}
      <Sheet visible={hazardOpen} onClose={() => setHazardOpen(false)} title={t("hazardAlert")}>
        <View style={{ alignItems: "center", marginBottom: space.lg }}>
          <Animated.View entering={ZoomIn.springify()} style={styles.hazardIcon}>
            <Ionicons name="warning" size={40} color={colors.danger} />
          </Animated.View>
          <Text style={[styles.resultName, { marginTop: space.md, textAlign: "center" }]}>{materialName(material, language)}</Text>
          <Text style={[textStyles.body, { textAlign: "center", marginTop: 6 }]}>{meta.safetyWarning}</Text>
        </View>
        {(["hazardGloves", "hazardGoggles", "hazardNoBreak", "hazardStore"] as const).map((k, i) => (
          <Animated.View key={k} entering={FadeInDown.delay(100 + i * 80)} style={styles.checkRow}>
            <Ionicons name={(["hand-left", "glasses", "ban", "cube"] as const)[i]} size={20} color={colors.danger} />
            <Text style={styles.checkText}>{t(k)}</Text>
          </Animated.View>
        ))}
        <Button label={t("listen")} icon="volume-high" variant="ghost" onPress={() => speak(meta.safetyWarning ?? "", language)} style={{ marginTop: space.md }} />
        <Button
          label={t("hazardAck")}
          icon="checkmark-circle"
          variant="danger"
          onPress={() => { setHazardAcked(material); setHazardOpen(false); }}
          style={{ marginTop: space.sm, marginBottom: space.md }}
        />
      </Sheet>
    </Screen>
  );
}

/** Backend ML valuation, falling back to the on-device model when offline. */
function FairPriceCard({ material, quality, weightKg }: { material: Material; quality: Quality; weightKg: number }) {
  const { t } = useTranslation();
  const { data, isError } = useQuery({
    queryKey: ["valuation", material, quality, weightKg],
    queryFn: () => getValuation({ material, quality, weightKg }),
    staleTime: 60_000,
  });
  const local = valuateLot(material, quality, weightKg);
  const perKg = data && !isError && data.fair_price_per_kg > 0 ? data.fair_price_per_kg : local.fairPricePerKg;
  const payout = data && !isError && data.fair_payout > 0 ? data.fair_payout : local.fairPayout;

  return (
    <Animated.View entering={FadeInDown.springify()}>
      <Card tone="soft" style={{ marginTop: space.md }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <Text style={textStyles.kicker}>{t("fairPrice")}</Text>
            <AnimatedNumber value={perKg} format={(n) => `${currency(n)}${t("perKg")}`} style={styles.fairValue} />
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={textStyles.kicker}>{t("fairPayout")}</Text>
            <AnimatedNumber value={payout} format={currency} style={[styles.fairValue, { color: colors.primary }]} />
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  title: { ...type.h1, color: colors.ink, marginTop: 2 },
  stepper: { flexDirection: "row", gap: space.sm, marginVertical: space.lg },
  stepLabel: { fontSize: 11, fontWeight: "700", color: colors.faint },

  captureCard: { alignItems: "center", paddingVertical: space.xxl, paddingHorizontal: space.lg, borderRadius: radius.xl, backgroundColor: P("rgba(248,250,247,0.04)"), borderWidth: 2, borderStyle: "dashed", borderColor: P("rgba(168,232,201,0.3)"), overflow: "hidden" },
  captureIcon: { width: 88, height: 88, borderRadius: 30, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  captureHint: { marginTop: space.lg, fontSize: 14, color: colors.inkSoft, fontWeight: "600", textAlign: "center" },
  captureBtns: { flexDirection: "row", gap: space.sm, marginTop: space.xl, alignSelf: "stretch" },
  manualLink: { marginTop: space.lg, padding: 6 },
  manualText: { color: colors.primary, fontWeight: "700", textDecorationLine: "underline" },

  previewWrap: { borderRadius: radius.xl, overflow: "hidden", backgroundColor: P("#020705"), aspectRatio: 1, maxHeight: 380, alignSelf: "center", width: "100%" },
  preview: { width: "100%", height: "100%" },
  analysingPill: { position: "absolute", bottom: 16, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: P("rgba(10,74,55,0.9)") },
  analysingText: { color: colors.white, fontWeight: "700", fontSize: 13 },
  thumbRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.md },
  thumb: { width: 56, height: 56, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surfaceAlt, borderWidth: 2, borderColor: "transparent" },
  thumbOn: { borderColor: colors.primary },
  thumbAdd: { alignItems: "center", justifyContent: "center", borderStyle: "dashed", borderColor: P("rgba(168,232,201,0.3)") },
  thumbRemove: { position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: P("rgba(0,0,0,0.55)") },
  thumbCount: { marginLeft: "auto", fontSize: 12, fontWeight: "700", color: colors.muted },
  moreHint: { marginTop: space.sm, fontSize: 12, color: colors.inkSoft },
  retake: { position: "absolute", top: 12, right: 12, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: P("rgba(0,0,0,0.5)") },

  resultHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  resultRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.md },
  resultName: { ...type.h2, color: colors.ink },
  notSure: { marginTop: space.sm, fontSize: 14, fontWeight: "700", color: P("#E5B86A"), lineHeight: 20 },

  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.md },
  label: { fontSize: 14, fontWeight: "800", color: colors.ink },
  materialGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  matCell: { width: 98, alignItems: "center", gap: 6, paddingVertical: space.md, paddingHorizontal: 4, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 2, borderColor: "transparent", flexGrow: 1 },
  matCellOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  matCellHazard: { borderColor: P("rgba(231,137,143,0.35)") },
  matText: { fontSize: 11, fontWeight: "700", color: colors.inkSoft, textAlign: "center" },
  matWarn: { position: "absolute", top: 6, right: 6 },

  weightRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  weightBtn: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  weightBox: { flex: 1, flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: radius.md, borderWidth: 2, borderColor: colors.line },
  weightInput: { minWidth: 70, textAlign: "center", fontSize: 32, fontWeight: "800", color: colors.ink },
  kg: { fontSize: 16, fontWeight: "700", color: colors.muted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  error: { marginTop: space.sm, color: colors.danger, fontWeight: "700", textAlign: "center" },

  safetyTitle: { fontSize: 14, fontWeight: "800", color: P("#E5B86A") },
  safetyText: { marginTop: 2, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  listenBtn: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: P("#020705") },
  fairValue: { marginTop: 4, fontSize: 22, fontWeight: "800", color: colors.ink },

  hazardIcon: { width: 80, height: 80, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: colors.dangerSoft },
  checkRow: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, marginBottom: space.sm, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  checkText: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.ink },
});
