import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";

import { LotCard } from "../components/LotCard";
import { colors } from "../constants/theme";
import { useTranslation } from "../hooks/useTranslation";
import type { RootTabParamList } from "../navigation/types";
import { getCurrentCoordinates } from "../services/location/location";
import { useAppStore } from "../store/appStore";
import type { Language } from "../types/domain";

type Props = BottomTabScreenProps<RootTabParamList, "Profile">;
const languages: Array<{ id: Language; native: string; name: string }> = [{ id: "en", native: "English", name: "English" }, { id: "hi", native: "हिन्दी", name: "Hindi" }, { id: "mr", native: "मराठी", name: "Marathi" }];

export function ProfileScreen(_: Props) {
  const { language, t } = useTranslation();
  const setLanguage = useAppStore((state) => state.setLanguage);
  const isOnline = useAppStore((state) => state.isOnline);
  const setOnline = useAppStore((state) => state.setOnline);
  const lots = useAppStore((state) => state.lots);

  const enableLocation = async () => {
    const location = await getCurrentCoordinates();
    if (!location) { Alert.alert(t("location"), "Location permission was not granted. Your exact location is never shown to buyers."); return; }
    Alert.alert(t("location"), "Pickup matching will use your approximate area. Your exact coordinates are not shared publicly.");
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.identity}><View style={styles.avatar}><Text style={styles.avatarText}>RK</Text></View><View><Text style={styles.name}>Ramesh Kumar</Text><Text style={styles.id}>Collector ID · CLT-4218</Text><View style={styles.verified}><Text style={styles.verifiedText}>✓ Verified collector</Text></View></View></View>
    <View style={styles.card}><View style={styles.row}><View><Text style={styles.rowTitle}>{isOnline ? t("online") : t("offline")}</Text><Text style={styles.rowDescription}>{isOnline ? "New lots will sync when created." : t("offline")}</Text></View><Switch value={isOnline} onValueChange={setOnline} trackColor={{ false: "#C5D0C7", true: "#74AF8A" }} thumbColor={colors.white} /></View></View>
    <Text style={styles.kicker}>{t("chooseLanguage").toUpperCase()}</Text><View style={styles.languageList}>{languages.map((item) => <TouchableOpacity key={item.id} onPress={() => setLanguage(item.id)} style={[styles.language, language === item.id && styles.languageOn]}><Text style={[styles.languageNative, language === item.id && styles.languageTextOn]}>{item.native}</Text><Text style={[styles.languageName, language === item.id && styles.languageTextOn]}>{item.name} {language === item.id ? "✓" : ""}</Text></TouchableOpacity>)}</View>
    <Text style={styles.kicker}>{t("location").toUpperCase()}</Text><TouchableOpacity style={styles.card} onPress={enableLocation}><View style={styles.row}><View><Text style={styles.rowTitle}>{t("location")}</Text><Text style={styles.rowDescription}>Use approximate area for better pickup matching</Text></View><Text style={styles.chevron}>›</Text></View></TouchableOpacity>
    <Text style={styles.kicker}>{t("myLots").toUpperCase()}</Text>{lots.length ? lots.slice(0, 5).map((lot) => <LotCard key={lot.id} lot={lot} syncedLabel={t("synced")} pendingLabel={t("pendingSync")} />) : <View style={styles.card}><Text style={styles.rowDescription}>{t("noLots")}</Text></View>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream }, content: { padding: 19, paddingBottom: 31 }, identity: { flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 21 }, avatar: { width: 65, height: 65, alignItems: "center", justifyContent: "center", borderRadius: 33, backgroundColor: "#9C6A4B", borderWidth: 3, borderColor: colors.white }, avatarText: { color: colors.white, fontSize: 16, fontWeight: "800" }, name: { color: colors.ink, fontSize: 20, fontWeight: "800" }, id: { marginTop: 3, color: colors.muted, fontSize: 10 }, verified: { alignSelf: "flex-start", marginTop: 7, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.greenLight }, verifiedText: { color: colors.green, fontSize: 9, fontWeight: "800" },
  card: { marginBottom: 18, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.white }, row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, rowTitle: { color: colors.ink, fontSize: 12, fontWeight: "800" }, rowDescription: { marginTop: 3, color: colors.muted, fontSize: 10, lineHeight: 14 }, chevron: { color: colors.green, fontSize: 27, lineHeight: 28 },
  kicker: { marginTop: 5, marginBottom: 8, color: "#84948B", fontSize: 9, fontWeight: "800", letterSpacing: 1 }, languageList: { gap: 8, marginBottom: 20 }, language: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 13, backgroundColor: colors.white }, languageOn: { borderColor: "#74A98A", backgroundColor: "#E9F5EC" }, languageNative: { color: colors.ink, fontSize: 13, fontWeight: "800" }, languageName: { color: colors.muted, fontSize: 10 }, languageTextOn: { color: colors.green }
});
