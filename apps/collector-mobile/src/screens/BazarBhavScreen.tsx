import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { colors } from "../constants/theme";
import { getAllBazarPrices } from "../data/prices";
import { useTranslation } from "../hooks/useTranslation";
import { speak } from "../services/voice/speech";
import { MATERIAL_METADATA, type BazarPriceItem, type Material } from "../types/domain";
import { currency } from "../utils/format";

interface BazarBhavProps {
  navigation: {
    navigate: (screen: string, params?: any) => void;
    goBack: () => void;
  };
}

const CATEGORIES = ["All", "Metals", "Electronics", "Batteries", "Heavy Scrap"] as const;

export function BazarBhavScreen({ navigation }: BazarBhavProps) {
  const { language, t } = useTranslation();
  const prices = getAllBazarPrices();
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMaterial, setActiveMaterial] = useState<Material | null>(null);

  const filteredPrices = prices.filter((item) => {
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    const meta = MATERIAL_METADATA[item.material];
    const nameMatch =
      item.material.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meta?.hindi.includes(searchQuery) ||
      meta?.marathi.includes(searchQuery);
    return matchesCategory && (searchQuery ? nameMatch : true);
  });

  const announcePrice = (item: BazarPriceItem) => {
    setActiveMaterial(item.material);
    const meta = MATERIAL_METADATA[item.material];
    const name = language === "hi" ? meta.hindi : language === "mr" ? meta.marathi : item.material;
    const trendWord =
      item.trend === "up"
        ? language === "hi" ? "बढ़ा है" : language === "mr" ? "वाढला आहे" : "increased"
        : item.trend === "down"
        ? language === "hi" ? "गिरा है" : language === "mr" ? "कमी झाला आहे" : "decreased"
        : language === "hi" ? "स्थिर है" : language === "mr" ? "स्थिर आहे" : "stable";

    const advice = language === "hi" ? item.adviceHi : language === "mr" ? item.adviceMr : item.advice;

    const speechText =
      language === "hi"
        ? `${name} का आज का भाव ${item.currentPrice} रुपये प्रति किलो है। आज भाव ${item.changePercent} प्रतिशत ${trendWord}। ${advice}`
        : language === "mr"
        ? `${name} चा आजचा दर ${item.currentPrice} रुपये प्रति किलो आहे. आज दर ${item.changePercent} टक्के ${trendWord}। ${advice}`
        : `${name}: Current rate is ${item.currentPrice} rupees per kilogram. Rate ${trendWord} by ${item.changePercent} percent today. ${advice}`;

    speak(speechText, language);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE MANDI RATES</Text>
        </View>
      </View>

      <Text style={styles.kicker}>DAILY SCRAP INTELLIGENCE</Text>
      <Text style={styles.title}>{t("bazarBhav")}</Text>
      <Text style={styles.subtitle}>{t("dailyRates")}</Text>

      {/* Voice Instruction Banner */}
      <View style={styles.audioHintCard}>
        <Text style={styles.audioHintIcon}>🔊</Text>
        <Text style={styles.audioHintText}>{t("tapToHear")}</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search materials (e.g. Copper, तांबा, बॅटरी)..."
          placeholderTextColor={colors.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
        <View style={styles.categoryRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
            >
              <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Price Cards List */}
      <View style={styles.cardList}>
        {filteredPrices.map((item) => {
          const meta = MATERIAL_METADATA[item.material];
          const isSelected = activeMaterial === item.material;
          const maxPrice = Math.max(...item.history7Days.map((d) => d.price));
          const minPrice = Math.min(...item.history7Days.map((d) => d.price));
          const range = maxPrice - minPrice || 1;

          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.88}
              style={[styles.priceCard, isSelected && styles.priceCardSelected]}
              onPress={() => announcePrice(item)}
            >
              <View style={styles.cardTop}>
                <View style={styles.materialTitleGroup}>
                  <Text style={styles.materialIcon}>{meta.icon}</Text>
                  <View>
                    <Text style={styles.materialName}>
                      {language === "hi" ? meta.hindi : language === "mr" ? meta.marathi : item.material}
                    </Text>
                    <Text style={styles.materialSubname}>{item.material}</Text>
                  </View>
                </View>

                <View style={styles.priceGroup}>
                  <Text style={styles.currentPriceText}>{currency(item.currentPrice)}</Text>
                  <Text style={styles.perKg}>/ kg</Text>
                </View>
              </View>

              {/* Trend & Change Row */}
              <View style={styles.trendRow}>
                <View
                  style={[
                    styles.trendBadge,
                    item.trend === "up" ? styles.trendBadgeUp : item.trend === "down" ? styles.trendBadgeDown : styles.trendBadgeStable
                  ]}
                >
                  <Text
                    style={[
                      styles.trendText,
                      item.trend === "up" ? styles.trendTextUp : item.trend === "down" ? styles.trendTextDown : styles.trendTextStable
                    ]}
                  >
                    {item.trend === "up" ? "▲ +" : item.trend === "down" ? "▼ -" : "● "}
                    {item.changePercent}%
                  </Text>
                </View>

                <View style={styles.demandPill}>
                  <Text style={styles.demandText}>{item.demand} DEMAND</Text>
                </View>

                <TouchableOpacity style={styles.speakIconBtn} onPress={() => announcePrice(item)}>
                  <Text style={styles.speakerEmoji}>🔊 Speak</Text>
                </TouchableOpacity>
              </View>

              {/* 7-Day Sparkline Chart */}
              <View style={styles.sparklineContainer}>
                <Text style={styles.sparklineLabel}>{t("priceTrend")}:</Text>
                <View style={styles.sparklineBars}>
                  {item.history7Days.map((day, idx) => {
                    const heightPercent = 20 + ((day.price - minPrice) / range) * 80;
                    const isLatest = idx === item.history7Days.length - 1;
                    return (
                      <View key={day.day} style={styles.sparkBarWrapper}>
                        <View
                          style={[
                            styles.sparkBar,
                            { height: `${heightPercent}%` },
                            isLatest ? styles.sparkBarLatest : null
                          ]}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Advice Box */}
              <View style={styles.adviceBox}>
                <Text style={styles.adviceKicker}>{t("sellingAdvice")}:</Text>
                <Text style={styles.adviceText}>
                  {language === "hi" ? item.adviceHi : language === "mr" ? item.adviceMr : item.advice}
                </Text>
              </View>

              {/* Sell Now Action Shortcut */}
              <TouchableOpacity
                style={styles.sellShortcut}
                onPress={() => navigation.navigate("Collect")}
              >
                <Text style={styles.sellShortcutText}>+ {t("sellThisNow")}</Text>
                <Text style={styles.sellShortcutArrow}>→</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 18, paddingBottom: 40 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  backBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#E2EBE4" },
  backBtnText: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#FDF2E9"
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#EA580C" },
  liveText: { color: "#EA580C", fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  kicker: { color: "#84948B", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  title: { marginTop: 4, color: colors.ink, fontSize: 25, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { marginTop: 2, marginBottom: 14, color: colors.muted, fontSize: 12 },

  audioHintCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.greenLight,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#BDE3CA"
  },
  audioHintIcon: { fontSize: 18 },
  audioHintText: { flex: 1, color: colors.green, fontSize: 11, fontWeight: "800" },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 12
  },
  searchIcon: { fontSize: 14, marginRight: 6 },
  searchInput: { flex: 1, height: 42, fontSize: 12, color: colors.ink },
  clearText: { color: colors.muted, fontSize: 14, padding: 4 },

  categoriesScroll: { marginBottom: 14 },
  categoryRow: { flexDirection: "row", gap: 8 },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line
  },
  categoryChipActive: { backgroundColor: colors.green, borderColor: colors.green },
  categoryText: { fontSize: 11, color: colors.muted, fontWeight: "700" },
  categoryTextActive: { color: colors.white, fontWeight: "800" },

  cardList: { gap: 12 },
  priceCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.line
  },
  priceCardSelected: { borderColor: colors.green, borderWidth: 1.5, backgroundColor: "#FBFCFB" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  materialTitleGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
  materialIcon: { fontSize: 24 },
  materialName: { fontSize: 16, fontWeight: "800", color: colors.ink },
  materialSubname: { fontSize: 10, color: colors.muted },
  priceGroup: { flexDirection: "row", alignItems: "baseline" },
  currentPriceText: { fontSize: 20, fontWeight: "900", color: colors.green },
  perKg: { fontSize: 10, color: colors.muted, marginLeft: 2 },

  trendRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  trendBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  trendBadgeUp: { backgroundColor: "#DCFCE7" },
  trendBadgeDown: { backgroundColor: "#FEE2E2" },
  trendBadgeStable: { backgroundColor: "#F3F4F6" },
  trendText: { fontSize: 10, fontWeight: "900" },
  trendTextUp: { color: "#166534" },
  trendTextDown: { color: "#991B1B" },
  trendTextStable: { color: "#4B5563" },
  demandPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: "#EFF6FF" },
  demandText: { fontSize: 9, fontWeight: "800", color: "#1D4ED8" },
  speakIconBtn: { marginLeft: "auto", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: "#F3F4F6" },
  speakerEmoji: { fontSize: 10, fontWeight: "700", color: colors.ink },

  sparklineContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F0F3F0"
  },
  sparklineLabel: { fontSize: 9, color: colors.muted, fontWeight: "700" },
  sparklineBars: { flexDirection: "row", alignItems: "flex-end", height: 28, gap: 4 },
  sparkBarWrapper: { width: 14, height: "100%", justifyContent: "flex-end" },
  sparkBar: { width: 14, borderRadius: 3, backgroundColor: "#A3D4B3" },
  sparkBarLatest: { backgroundColor: colors.green },

  adviceBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#F7FAF8",
    borderWidth: 1,
    borderColor: "#E5ECE6"
  },
  adviceKicker: { fontSize: 9, fontWeight: "800", color: "#3C6349", marginBottom: 2 },
  adviceText: { fontSize: 10, color: "#4A5568", lineHeight: 14 },

  sellShortcut: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.greenLight
  },
  sellShortcutText: { fontSize: 11, fontWeight: "800", color: colors.green },
  sellShortcutArrow: { fontSize: 14, fontWeight: "900", color: colors.green }
});
