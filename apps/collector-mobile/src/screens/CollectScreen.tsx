// apps/collector-mobile/src/screens/CollectScreen.tsx
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Controller, useForm } from "react-hook-form";

import { VoiceButton } from "../components/VoiceButton";
import { VoiceInputButton } from "../components/VoiceInputButton";
import { ValuationCard } from "../components/ValuationCard";
import { colors } from "../constants/theme";
import { useTranslation } from "../hooks/useTranslation";
import type { RootTabParamList } from "../navigation/types";
import { analyseMaterial } from "../services/api/client";
import { enqueue, makeIdempotencyKey } from "../services/sync/syncQueue";
import { matchMaterial, parseSpokenNumber } from "../services/voice/parser";
import { speak } from "../services/voice/speech";
import { useAuthStore } from "../store/authStore";
import { useAppStore } from "../store/appStore";
import {
  MATERIAL_METADATA,
  type Material,
  type MaterialPrediction,
} from "../types/domain";

type Props = BottomTabScreenProps<RootTabParamList, "Collect">;
type FormValues = { material: Material; weight: string };

const allMaterials: Material[] = [
  "Copper cable", "Server boards", "Aluminium", "Mixed e-waste",
  "Lithium-ion batteries", "Brass fittings", "Printed Circuit Boards (PCB)",
  "Electric motors", "Iron & steel scrap", "CRT & monitor glass",
  "Lead acid batteries", "Compressors & cooling units",
];

function asMaterial(value: unknown): Material | undefined {
  if (typeof value !== "string") return undefined;
  return (allMaterials as readonly string[]).includes(value)
    ? (value as Material)
    : undefined;
}

export function CollectScreen({ navigation, route }: Props) {
  const { language, t } = useTranslation();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [imageUri, setImageUri] = useState<string>();
  const [prediction, setPrediction] = useState<MaterialPrediction>();
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [hazardDismissed, setHazardDismissed] = useState(false);
  const [showHazardOverlay, setShowHazardOverlay] = useState(false);

  const collector = useAuthStore((s) => s.collector);
  const existingLots = useAppStore((s) => s.lots);

  const prefillMaterial = asMaterial((route.params as any)?.prefillMaterial);
  const prefillWeightKg = (route.params as any)?.prefillWeightKg as number | undefined;

  const { control, getValues, setValue, handleSubmit, watch } = useForm<FormValues>({
    defaultValues: {
      material: prefillMaterial ?? "Copper cable",
      weight: prefillWeightKg ? String(prefillWeightKg) : "35",
    },
  });

  const selectedMaterial = watch("material");
  const weightValue = watch("weight");

  useEffect(() => {
    if (prefillMaterial) setValue("material", prefillMaterial);
    if (prefillWeightKg) setValue("weight", String(prefillWeightKg));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Hazard warning ──────────────────────────────────────────────────────
  const triggerHazardWarning = (materialName: Material, customMsg?: string) => {
    const meta = MATERIAL_METADATA[materialName];
    if (meta?.hazard) {
      setShowHazardOverlay(true);
      setHazardDismissed(false);
      const msg = customMsg || meta.safetyWarning || t("hazardSafetyPrompt");
      speak(
        `Warning! ${meta[language === "mr" ? "marathi" : language === "hi" ? "hindi" : "material"]}. ${msg}`,
        language
      );
    } else {
      setShowHazardOverlay(false);
    }
  };

  const applyPrediction = (result: MaterialPrediction, uri?: string) => {
    setPrediction(result);
    setImageUri(uri);
    setValue("material", result.material);
    if (result.hazard) {
      triggerHazardWarning(result.material, result.safetyMessage);
    } else {
      setShowHazardOverlay(false);
    }
  };

  const onSelectMaterial = (mat: Material) => {
    setValue("material", mat);
    const meta = MATERIAL_METADATA[mat];
    if (meta.hazard) triggerHazardWarning(mat, meta.safetyWarning);
    else setShowHazardOverlay(false);
  };

  // ─── Voice ───────────────────────────────────────────────────────────────
  const handleVoiceMaterial = (transcript: string) => {
    const mat = matchMaterial(transcript);
    if (mat) {
      setValue("material", mat);
      const meta = MATERIAL_METADATA[mat];
      if (meta.hazard) triggerHazardWarning(mat, meta.safetyWarning);
      speak(`${mat} selected`, language);
    } else {
      speak("I didn't catch the material. Please try again.", language);
    }
  };

  const handleVoiceWeight = (transcript: string) => {
    const kg = parseSpokenNumber(transcript, language);
    if (!Number.isNaN(kg) && kg > 0 && kg < 10000) {
      setValue("weight", String(kg));
      speak(`${kg} kilograms`, language);
    } else {
      speak("I didn't catch the weight. Please try again.", language);
    }
  };

  // ─── Camera ──────────────────────────────────────────────────────────────
  const takePhoto = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) Alert.alert(t("safety"), t("cameraPermission"));
      return;
    }
    const photo = await cameraRef.current?.takePictureAsync({
      quality: 0.55, skipProcessing: true,
    });
    if (!photo?.uri) return;
    setIsAnalysing(true);
    try {
      applyPrediction(await analyseMaterial(photo.uri), photo.uri);
    } catch {
      Alert.alert(t("cameraUnavailable"), t("useDemo"));
    } finally {
      setIsAnalysing(false);
    }
  };

  const useDemo = () =>
    applyPrediction({
      material: "Copper cable", category: "Metals",
      quality: "medium", hazard: false, confidence: 0.94,
    });

  const useHazardDemo = () =>
    applyPrediction({
      material: "Lithium-ion batteries", category: "Batteries",
      quality: "high", hazard: true, confidence: 0.96,
      safetyMessage: "Severe chemical & thermal runaway hazard! Puncture risk detected. Keep isolated in dry sand/bucket.",
    });

  // ─── Continue → Market (with duplicate-lot check + sync enqueue) ─────────
  const continueToMarket = async ({ material, weight }: FormValues) => {
    const weightKg = Number(weight);
    if (!prediction || !Number.isFinite(weightKg) || weightKg <= 0) {
      Alert.alert(t("confirmResult"), t("captureHint"));
      return;
    }
    const meta = MATERIAL_METADATA[material];
    if (meta.hazard && !hazardDismissed) {
      triggerHazardWarning(material);
      return;
    }

    // Duplicate-lot check
    const dup = existingLots.find(
      (l) => l.material === material && Math.abs((l.weightKg ?? 0) - weightKg) < 0.5
    );
    if (dup) {
      Alert.alert(
        "Possible duplicate",
        `You already have a lot of ${material} at ~${weightKg}kg. Add anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Add anyway", style: "destructive", onPress: () => proceed(material, weightKg) },
        ]
      );
      return;
    }

    proceed(material, weightKg);
  };

  const proceed = (material: Material, weightKg: number) => {
    // Enqueue to offline sync queue
    if (collector) {
      const lotId = `lot_offline_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      void enqueue({
        entity: "lot",
        entity_id: lotId,
        idempotency_key: makeIdempotencyKey("lot"),
        payload: {
          material,
          quality: prediction?.quality ?? "medium",
          weight_kg: weightKg,
          collector_id: collector.id,
          collector_name: collector.name,
          latitude: collector.latitude,
          longitude: collector.longitude,
          image_uri: imageUri,
          pickup_pin: "0000",
        },
        client_created_at: new Date().toISOString(),
      });
    }

    navigation.navigate("Market", {
      material,
      quality: prediction?.quality ?? "medium",
      weightKg,
      imageUri,
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.kicker}>{t("newCollection").toUpperCase()}</Text>
      <Text style={styles.title}>{t("sellMaterial")}</Text>

      <View style={styles.stepper}>
        <View style={styles.stepOn} />
        <View style={prediction ? styles.stepOn : styles.stepOff} />
        <View style={styles.stepOff} />
      </View>

      {!imageUri && permission?.granted ? (
        <View style={styles.cameraWrap}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
          <View style={styles.cameraGuide}>
            <Text style={styles.guideText}>{t("captureHint")}</Text>
          </View>
        </View>
      ) : imageUri ? (
        <Image style={styles.preview} source={{ uri: imageUri }} />
      ) : (
        <TouchableOpacity style={styles.demoCamera} onPress={takePhoto}>
          <Text style={styles.cameraSymbol}>⌑</Text>
          <Text style={styles.demoText}>{t("takeMaterialPhoto")}</Text>
          <Text style={styles.demoHint}>{t("captureHint")}</Text>
        </TouchableOpacity>
      )}

      {!prediction ? (
        <View style={styles.captureActions}>
          <TouchableOpacity style={styles.captureButton} onPress={takePhoto}>
            <Text style={styles.captureButtonText}>
              {isAnalysing ? "AI is checking…" : t("capturePhoto")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.demoButton} onPress={useDemo}>
            <Text style={styles.demoButtonText}>{t("demoScan")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.demoButton, styles.hazardDemoBtn]} onPress={useHazardDemo}>
            <Text style={styles.hazardDemoBtnText}>⚠ Hazard Demo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultKicker}>{t("aiIdentification")}</Text>
            <Text style={styles.confidence}>
              {Math.round(prediction.confidence * 100)}% confident
            </Text>
          </View>
          <Text style={styles.resultMaterial}>{prediction.material}</Text>
          <Text style={styles.resultMeta}>
            {prediction.category} · {prediction.quality} quality ·{" "}
            {prediction.hazard ? "⚠️ HAZARD DETECTED" : "Safe to handle"}
          </Text>
        </View>
      )}

      <View style={[styles.safety, MATERIAL_METADATA[selectedMaterial]?.hazard && styles.safetyHazard]}>
        <Text style={styles.safetyIcon}>
          {MATERIAL_METADATA[selectedMaterial]?.hazard ? "🔥" : "⚠"}
        </Text>
        <View style={styles.safetyCopy}>
          <Text style={[styles.safetyTitle, MATERIAL_METADATA[selectedMaterial]?.hazard && styles.safetyTitleHazard]}>
            {MATERIAL_METADATA[selectedMaterial]?.hazard ? t("hazardAlert") : t("safety")}
          </Text>
          <Text style={[styles.safetyText, MATERIAL_METADATA[selectedMaterial]?.hazard && styles.safetyTextHazard]}>
            {MATERIAL_METADATA[selectedMaterial]?.safetyWarning || t("safetyText")}
          </Text>
        </View>
        {MATERIAL_METADATA[selectedMaterial]?.hazard && (
          <TouchableOpacity
            style={styles.replayAudioBtn}
            onPress={() =>
              speak(MATERIAL_METADATA[selectedMaterial]?.safetyWarning || t("hazardSafetyPrompt"), language)
            }
          >
            <Text style={styles.replayAudioText}>🔊</Text>
          </TouchableOpacity>
        )}
      </View>

      {prediction ? (
        <View style={styles.formCard}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{t("confirmResult")}</Text>
            <VoiceInputButton language={language} label="Speak material" onResult={handleVoiceMaterial} />
          </View>

          <Controller
            control={control}
            name="material"
            render={({ field: { value } }) => (
              <View style={styles.materials}>
                {allMaterials.map((material) => {
                  const meta = MATERIAL_METADATA[material];
                  const isSelected = value === material;
                  return (
                    <TouchableOpacity
                      key={material}
                      onPress={() => onSelectMaterial(material)}
                      style={[
                        styles.materialChoice,
                        isSelected && styles.materialChoiceOn,
                        meta.hazard && styles.materialChoiceHazard,
                      ]}
                    >
                      <Text style={styles.materialIcon}>{meta.icon}</Text>
                      <Text
                        style={[
                          styles.materialChoiceText,
                          isSelected && styles.materialChoiceTextOn,
                          meta.hazard && styles.materialTextHazard,
                        ]}
                      >
                        {language === "hi" ? meta.hindi : language === "mr" ? meta.marathi : material}
                      </Text>
                      {meta.hazard && <Text style={styles.hazardBadge}>⚠</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          />

          <View style={styles.labelRow}>
            <Text style={styles.label}>{t("weight")}</Text>
            <VoiceInputButton language={language} label="Speak weight" onResult={handleVoiceWeight} />
          </View>

          <Controller
            control={control}
            name="weight"
            rules={{ required: true }}
            render={({ field: { value, onChange } }) => (
              <View style={styles.weightRow}>
                <TouchableOpacity onPress={() => onChange(String(Math.max(1, Number(value) - 1)))}>
                  <Text style={styles.weightAdjust}>−</Text>
                </TouchableOpacity>
                <TextInput style={styles.weightInput} value={value} onChangeText={onChange} keyboardType="decimal-pad" />
                <Text style={styles.kg}>kg</Text>
                <TouchableOpacity onPress={() => onChange(String(Number(value || 0) + 1))}>
                  <Text style={styles.weightAdjust}>+</Text>
                </TouchableOpacity>
              </View>
            )}
          />

          <VoiceButton label={t("speakWeight")} onPress={() => speak(`${getValues("weight")} kilograms`, language)} />
        </View>
      ) : null}

      {/* ML Valuation card */}
      {prediction ? (
        <ValuationCard
          material={selectedMaterial}
          quality={prediction.quality}
          weightKg={Number(weightValue) || 0}
        />
      ) : null}

      {prediction ? (
        <TouchableOpacity style={styles.cta} onPress={handleSubmit(continueToMarket)}>
          <Text style={styles.ctaText}>{t("checkBestPrice")}</Text>
          <Text style={styles.ctaArrow}>→</Text>
        </TouchableOpacity>
      ) : null}

      <Modal visible={showHazardOverlay && !hazardDismissed} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.hazardModalCard}>
            <View style={styles.hazardModalHeader}>
              <View style={styles.hazardPulseCircle}>
                <Text style={styles.hazardModalIcon}>⚠</Text>
              </View>
              <Text style={styles.hazardModalTitle}>{t("hazardAlert")}</Text>
              <Text style={styles.hazardModalSubtitle}>{selectedMaterial}</Text>
            </View>

            <View style={styles.hazardPromptBox}>
              <Text style={styles.hazardPromptText}>
                {MATERIAL_METADATA[selectedMaterial]?.safetyWarning || t("hazardSafetyPrompt")}
              </Text>
            </View>

            <View style={styles.safetyChecklist}>
              <Text style={styles.checklistTitle}>Mandatory Safety Protocol:</Text>
              <Text style={styles.checkItem}>🧤 Use heavy insulated rubber/leather gloves</Text>
              <Text style={styles.checkItem}>🥽 Wear protective eye goggles</Text>
              <Text style={styles.checkItem}>🚫 Do not puncture, burn, or expose to water</Text>
              <Text style={styles.checkItem}>📦 Keep in non-metallic dry bin / sand container</Text>
            </View>

            <TouchableOpacity
              style={styles.hazardAudioBtn}
              onPress={() =>
                speak(MATERIAL_METADATA[selectedMaterial]?.safetyWarning || t("hazardSafetyPrompt"), language)
              }
            >
              <Text style={styles.hazardAudioBtnText}>🔊 {t("tapToHear")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.acknowledgeBtn}
              onPress={() => { setHazardDismissed(true); setShowHazardOverlay(false); }}
            >
              <Text style={styles.acknowledgeBtnText}>✓ {t("hazardAcknowledged")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 19, paddingBottom: 36 },
  kicker: { color: "#84948B", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  title: { marginTop: 4, color: colors.ink, fontSize: 25, fontWeight: "800", letterSpacing: -0.5 },
  stepper: { flexDirection: "row", gap: 5, marginVertical: 16 },
  stepOn: { flex: 1, height: 5, borderRadius: 4, backgroundColor: colors.orange },
  stepOff: { flex: 1, height: 5, borderRadius: 4, backgroundColor: "#DBE3DC" },
  cameraWrap: { overflow: "hidden", height: 260, borderRadius: 22, backgroundColor: colors.ink },
  camera: { flex: 1 },
  cameraGuide: { position: "absolute", right: 11, bottom: 11, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, backgroundColor: "rgba(18,74,59,.85)" },
  guideText: { color: colors.white, fontSize: 10, fontWeight: "700" },
  preview: { width: "100%", height: 260, borderRadius: 22, backgroundColor: "#D3DDD5" },
  demoCamera: { alignItems: "center", justifyContent: "center", height: 240, borderRadius: 22, borderWidth: 2, borderStyle: "dashed", borderColor: "#8BBBA3", backgroundColor: "#EAF5EF" },
  cameraSymbol: { color: colors.green, fontSize: 44 },
  demoText: { marginTop: 10, color: colors.green, fontSize: 15, fontWeight: "800" },
  demoHint: { marginTop: 4, color: colors.muted, fontSize: 11 },
  captureActions: { flexDirection: "row", gap: 6, marginTop: 11 },
  captureButton: { flex: 1.2, alignItems: "center", padding: 12, borderRadius: 12, backgroundColor: colors.green },
  captureButtonText: { color: colors.white, fontSize: 12, fontWeight: "800" },
  demoButton: { flex: 0.9, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, borderWidth: 1, borderColor: "#BFD7C7", borderRadius: 12 },
  demoButtonText: { color: colors.green, fontSize: 11, fontWeight: "800" },
  hazardDemoBtn: { borderColor: "#ECA257", backgroundColor: "#FFF4E8" },
  hazardDemoBtnText: { color: "#C05621", fontSize: 10, fontWeight: "800" },
  resultCard: { marginTop: 12, padding: 15, borderWidth: 1, borderColor: colors.line, borderRadius: 17, backgroundColor: colors.white },
  resultHeader: { flexDirection: "row", justifyContent: "space-between" },
  resultKicker: { color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  confidence: { color: "#348458", fontSize: 10, fontWeight: "800" },
  resultMaterial: { marginTop: 8, color: colors.ink, fontSize: 22, fontWeight: "800" },
  resultMeta: { marginTop: 5, color: colors.muted, fontSize: 11 },
  safety: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 12, padding: 12, borderRadius: 13, backgroundColor: "#FFF0D8" },
  safetyHazard: { backgroundColor: "#FFECEB", borderWidth: 1.5, borderColor: "#E53E3E" },
  safetyIcon: { fontSize: 18 },
  safetyCopy: { flex: 1 },
  safetyTitle: { color: "#825C19", fontSize: 11, fontWeight: "800" },
  safetyTitleHazard: { color: "#C53030", fontSize: 12, fontWeight: "900" },
  safetyText: { marginTop: 2, color: "#825C19", fontSize: 10, lineHeight: 14 },
  safetyTextHazard: { color: "#9B2C2C", fontWeight: "700" },
  replayAudioBtn: { padding: 6, backgroundColor: "rgba(255,255,255,0.7)", borderRadius: 8 },
  replayAudioText: { fontSize: 16 },
  formCard: { marginTop: 12, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 17, backgroundColor: colors.white },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  label: { color: "#53675E", fontSize: 11, fontWeight: "800" },
  materials: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  materialChoice: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9, backgroundColor: "#F0F3EF" },
  materialChoiceOn: { backgroundColor: colors.greenLight, borderWidth: 1, borderColor: colors.green },
  materialChoiceHazard: { borderColor: "#FEB2B2" },
  materialIcon: { fontSize: 11 },
  materialChoiceText: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  materialChoiceTextOn: { color: colors.green, fontWeight: "800" },
  materialTextHazard: { color: "#C53030" },
  hazardBadge: { color: "#E53E3E", fontSize: 9, fontWeight: "900" },
  weightRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 10, padding: 7, borderWidth: 1, borderColor: "#DCE4DD", borderRadius: 10 },
  weightAdjust: { width: 32, height: 32, borderRadius: 8, overflow: "hidden", textAlign: "center", paddingTop: 3, color: colors.green, backgroundColor: colors.greenLight, fontSize: 22, fontWeight: "700" },
  weightInput: { minWidth: 65, color: colors.green, textAlign: "right", fontSize: 22, fontWeight: "800" },
  kg: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  cta: { flexDirection: "row", justifyContent: "space-between", marginTop: 15, padding: 15, borderRadius: 14, backgroundColor: colors.green },
  ctaText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  ctaArrow: { color: colors.white, fontSize: 16, fontWeight: "800" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "center", alignItems: "center", padding: 20 },
  hazardModalCard: { width: "100%", backgroundColor: colors.white, borderRadius: 22, padding: 20, alignItems: "center", borderWidth: 2, borderColor: "#E53E3E" },
  hazardModalHeader: { alignItems: "center", marginBottom: 12 },
  hazardPulseCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#FED7D7", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  hazardModalIcon: { fontSize: 32, color: "#C53030" },
  hazardModalTitle: { fontSize: 18, fontWeight: "900", color: "#C53030", letterSpacing: 0.5 },
  hazardModalSubtitle: { fontSize: 13, color: colors.muted, fontWeight: "700", marginTop: 2 },
  hazardPromptBox: { backgroundColor: "#FFF5F5", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#FEB2B2", marginBottom: 14, width: "100%" },
  hazardPromptText: { color: "#9B2C2C", fontSize: 12, lineHeight: 17, fontWeight: "600", textAlign: "center" },
  safetyChecklist: { width: "100%", backgroundColor: "#F7FAFC", borderRadius: 12, padding: 12, marginBottom: 14 },
  checklistTitle: { fontSize: 11, fontWeight: "800", color: colors.ink, marginBottom: 6 },
  checkItem: { fontSize: 11, color: "#4A5568", lineHeight: 18, marginBottom: 3 },
  hazardAudioBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: "#EDF2F7", marginBottom: 12, width: "100%" },
  hazardAudioBtnText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  acknowledgeBtn: { backgroundColor: "#E53E3E", paddingVertical: 14, borderRadius: 12, alignItems: "center", width: "100%" },
  acknowledgeBtnText: { color: colors.white, fontSize: 13, fontWeight: "900", letterSpacing: 0.3 },
});