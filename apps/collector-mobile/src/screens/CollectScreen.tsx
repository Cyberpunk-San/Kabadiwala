import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Controller, useForm } from "react-hook-form";

import { VoiceButton } from "../components/VoiceButton";
import { colors } from "../constants/theme";
import { useTranslation } from "../hooks/useTranslation";
import type { RootTabParamList } from "../navigation/types";
import { analyseMaterial } from "../services/api/client";
import { speak } from "../services/voice/speech";
import type { Material, MaterialPrediction } from "../types/domain";

type Props = BottomTabScreenProps<RootTabParamList, "Collect">;
type FormValues = { material: Material; weight: string };
const materials: Material[] = ["Copper cable", "Server boards", "Aluminium", "Mixed e-waste"];

export function CollectScreen({ navigation }: Props) {
  const { language, t } = useTranslation();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [imageUri, setImageUri] = useState<string>();
  const [prediction, setPrediction] = useState<MaterialPrediction>();
  const [isAnalysing, setIsAnalysing] = useState(false);
  const { control, getValues, setValue, handleSubmit } = useForm<FormValues>({ defaultValues: { material: "Copper cable", weight: "35" } });

  const applyPrediction = (result: MaterialPrediction, uri?: string) => {
    setPrediction(result);
    setImageUri(uri);
    setValue("material", result.material);
  };

  const takePhoto = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) Alert.alert(t("safety"), t("cameraPermission"));
      return;
    }
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.55, skipProcessing: true });
    if (!photo?.uri) return;
    setIsAnalysing(true);
    try { applyPrediction(await analyseMaterial(photo.uri), photo.uri); }
    catch { Alert.alert(t("cameraUnavailable"), t("useDemo")); }
    finally { setIsAnalysing(false); }
  };

  const useDemo = () => applyPrediction({ material: "Copper cable", category: "Cable", quality: "medium", hazard: false, confidence: .91 });
  const continueToMarket = ({ material, weight }: FormValues) => {
    const weightKg = Number(weight);
    if (!prediction || !Number.isFinite(weightKg) || weightKg <= 0) {
      Alert.alert(t("confirmResult"), t("captureHint"));
      return;
    }
    navigation.navigate("Market", { material, quality: prediction.quality, weightKg, imageUri });
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Text style={styles.kicker}>{t("newCollection").toUpperCase()}</Text><Text style={styles.title}>{t("sellMaterial")}</Text>
    <View style={styles.stepper}><View style={styles.stepOn} /><View style={prediction ? styles.stepOn : styles.stepOff} /><View style={styles.stepOff} /></View>
    {!imageUri && permission?.granted ? <View style={styles.cameraWrap}><CameraView ref={cameraRef} style={styles.camera} facing="back" /><View style={styles.cameraGuide}><Text style={styles.guideText}>{t("captureHint")}</Text></View></View> : imageUri ? <Image style={styles.preview} source={{ uri: imageUri }} /> : <TouchableOpacity style={styles.demoCamera} onPress={takePhoto}><Text style={styles.cameraSymbol}>⌑</Text><Text style={styles.demoText}>{t("takeMaterialPhoto")}</Text><Text style={styles.demoHint}>{t("captureHint")}</Text></TouchableOpacity>}
    {!prediction ? <View style={styles.captureActions}><TouchableOpacity style={styles.captureButton} onPress={takePhoto}><Text style={styles.captureButtonText}>{isAnalysing ? "AI is checking…" : t("capturePhoto")}</Text></TouchableOpacity><TouchableOpacity style={styles.demoButton} onPress={useDemo}><Text style={styles.demoButtonText}>{t("demoScan")}</Text></TouchableOpacity></View> : <View style={styles.resultCard}><View style={styles.resultHeader}><Text style={styles.resultKicker}>{t("aiIdentification")}</Text><Text style={styles.confidence}>{Math.round(prediction.confidence * 100)}% confident</Text></View><Text style={styles.resultMaterial}>{prediction.material}</Text><Text style={styles.resultMeta}>{prediction.category} · {prediction.quality} quality · {prediction.hazard ? "Safety warning" : "Safe to handle"}</Text></View>}
    <View style={styles.safety}><Text style={styles.safetyIcon}>⚠</Text><View style={styles.safetyCopy}><Text style={styles.safetyTitle}>{t("safety")}</Text><Text style={styles.safetyText}>{prediction?.hazard ? prediction.safetyMessage : t("safetyText")}</Text></View></View>
    {prediction ? <View style={styles.formCard}><Text style={styles.label}>{t("confirmResult")}</Text><Controller control={control} name="material" render={({ field: { value } }) => <View style={styles.materials}>{materials.map((material) => <TouchableOpacity key={material} onPress={() => setValue("material", material)} style={[styles.materialChoice, value === material && styles.materialChoiceOn]}><Text style={[styles.materialChoiceText, value === material && styles.materialChoiceTextOn]}>{material}</Text></TouchableOpacity>)}</View>} />
      <Text style={styles.label}>{t("weight")}</Text><Controller control={control} name="weight" rules={{ required: true }} render={({ field: { value, onChange } }) => <View style={styles.weightRow}><TouchableOpacity onPress={() => onChange(String(Math.max(0, Number(value) - 1)))}><Text style={styles.weightAdjust}>−</Text></TouchableOpacity><TextInput style={styles.weightInput} value={value} onChangeText={onChange} keyboardType="decimal-pad" /><Text style={styles.kg}>kg</Text><TouchableOpacity onPress={() => onChange(String(Number(value || 0) + 1))}><Text style={styles.weightAdjust}>+</Text></TouchableOpacity></View>} />
      <VoiceButton label={t("speakWeight")} onPress={() => speak(`${getValues("weight")} kilograms`, language)} />
    </View> : null}
    {prediction ? <TouchableOpacity style={styles.cta} onPress={handleSubmit(continueToMarket)}><Text style={styles.ctaText}>{t("checkBestPrice")}</Text><Text style={styles.ctaArrow}>→</Text></TouchableOpacity> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream }, content: { padding: 19, paddingBottom: 30 }, kicker: { color: "#84948B", fontSize: 9, fontWeight: "800", letterSpacing: 1 }, title: { marginTop: 4, color: colors.ink, fontSize: 25, fontWeight: "800", letterSpacing: -.5 }, stepper: { flexDirection: "row", gap: 5, marginVertical: 16 }, stepOn: { flex: 1, height: 5, borderRadius: 4, backgroundColor: colors.orange }, stepOff: { flex: 1, height: 5, borderRadius: 4, backgroundColor: "#DBE3DC" },
  cameraWrap: { overflow: "hidden", height: 280, borderRadius: 22, backgroundColor: colors.ink }, camera: { flex: 1 }, cameraGuide: { position: "absolute", right: 11, bottom: 11, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, backgroundColor: "rgba(18,74,59,.85)" }, guideText: { color: colors.white, fontSize: 10, fontWeight: "700" }, preview: { width: "100%", height: 280, borderRadius: 22, backgroundColor: "#D3DDD5" }, demoCamera: { alignItems: "center", justifyContent: "center", height: 280, borderRadius: 22, borderWidth: 2, borderStyle: "dashed", borderColor: "#8BBBA3", backgroundColor: "#EAF5EF" }, cameraSymbol: { color: colors.green, fontSize: 48 }, demoText: { marginTop: 12, color: colors.green, fontSize: 16, fontWeight: "800" }, demoHint: { marginTop: 5, color: colors.muted, fontSize: 11 }, captureActions: { flexDirection: "row", gap: 8, marginTop: 11 }, captureButton: { flex: 1, alignItems: "center", padding: 13, borderRadius: 12, backgroundColor: colors.green }, captureButtonText: { color: colors.white, fontSize: 12, fontWeight: "800" }, demoButton: { alignItems: "center", justifyContent: "center", paddingHorizontal: 12, borderWidth: 1, borderColor: "#BFD7C7", borderRadius: 12 }, demoButtonText: { color: colors.green, fontSize: 11, fontWeight: "800" },
  resultCard: { marginTop: 12, padding: 15, borderWidth: 1, borderColor: colors.line, borderRadius: 17, backgroundColor: colors.white }, resultHeader: { flexDirection: "row", justifyContent: "space-between" }, resultKicker: { color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: .8 }, confidence: { color: "#348458", fontSize: 10, fontWeight: "800" }, resultMaterial: { marginTop: 9, color: colors.ink, fontSize: 22, fontWeight: "800" }, resultMeta: { marginTop: 6, color: colors.muted, fontSize: 10 },
  safety: { flexDirection: "row", gap: 8, marginTop: 12, padding: 12, borderRadius: 13, backgroundColor: "#FFF0D8" }, safetyIcon: { fontSize: 15 }, safetyCopy: { flex: 1 }, safetyTitle: { color: "#825C19", fontSize: 11, fontWeight: "800" }, safetyText: { marginTop: 3, color: "#825C19", fontSize: 10, lineHeight: 14 },
  formCard: { marginTop: 12, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 17, backgroundColor: colors.white }, label: { marginBottom: 8, color: "#53675E", fontSize: 11, fontWeight: "800" }, materials: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 17 }, materialChoice: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 9, backgroundColor: "#F0F3EF" }, materialChoiceOn: { backgroundColor: colors.greenLight }, materialChoiceText: { color: colors.muted, fontSize: 10, fontWeight: "700" }, materialChoiceTextOn: { color: colors.green }, weightRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 10, padding: 7, borderWidth: 1, borderColor: "#DCE4DD", borderRadius: 10 }, weightAdjust: { width: 30, height: 30, borderRadius: 8, overflow: "hidden", textAlign: "center", paddingTop: 3, color: colors.green, backgroundColor: colors.greenLight, fontSize: 20 }, weightInput: { minWidth: 62, color: colors.green, textAlign: "right", fontSize: 20, fontWeight: "800" }, kg: { color: colors.muted, fontSize: 12 }, cta: { flexDirection: "row", justifyContent: "space-between", marginTop: 15, padding: 15, borderRadius: 14, backgroundColor: colors.green }, ctaText: { color: colors.white, fontSize: 13, fontWeight: "800" }, ctaArrow: { color: colors.white, fontSize: 16, fontWeight: "800" }
});
