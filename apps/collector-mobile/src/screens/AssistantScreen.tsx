// src/screens/AssistantScreen.tsx — "Kabadi Sahayak": chat with the backend agent.
// The agent calls tools on live data and returns actions, rendered here as buttons.
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Text } from "../ui/Text";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, space } from "../constants/theme";
import { useScreenNarration } from "../hooks/useScreenNarration";
import { useTranslation } from "../hooks/useTranslation";
import type { TranslationKey } from "../i18n";
import { go, goBack, goTab } from "../navigation/ref";
import type { RootStackParamList } from "../navigation/types";
import { askAssistant, isNetworkError, type AssistantAction, type AssistantReply } from "../services/api/client";
import { speak, stopSpeaking } from "../services/voice/speech";
import { startListening, type RecognitionHandle } from "../services/voice/speechRecognition";
import { useAuthStore } from "../store/authStore";
import { materialName } from "../types/domain";
import { BACKDROP_BG, CinematicBackdrop } from "../ui/backdrop";
import { toast } from "../ui/feedback";
import { TypingDots } from "../ui/motion";
import { Chip, PressScale, TopBar, type IconName } from "../ui/primitives";

import { P } from "../constants/palette";
type Props = NativeStackScreenProps<RootStackParamList, "Assistant">;

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  reply?: AssistantReply;
};

const ACTION_META: Record<AssistantAction["type"], { label: TranslationKey; icon: IconName }> = {
  open_market: { label: "actOpenMarket", icon: "storefront" },
  open_scan: { label: "actOpenScan", icon: "camera" },
  open_rates: { label: "actOpenRates", icon: "trending-up" },
  open_demands: { label: "actOpenDemands", icon: "megaphone" },
  open_earnings: { label: "actOpenEarnings", icon: "wallet" },
  open_opportunity: { label: "actOpenOpportunity", icon: "bulb" },
};

function runAction(action: AssistantAction) {
  const material = action.material ?? undefined;
  const weightKg = action.weight_kg ?? undefined;
  switch (action.type) {
    case "open_market":
      return goTab("Market", { material, weightKg });
    case "open_scan":
      return goTab("Collect", { prefillMaterial: material, prefillWeightKg: weightKg });
    case "open_rates":
      return go("BazarBhav");
    case "open_demands":
      return go("Demands");
    case "open_earnings":
      return goTab("Earnings");
    case "open_opportunity":
      return go("Opportunity");
  }
}

let nextId = 0;
const newId = () => `m${Date.now()}_${nextId++}`;

export function AssistantScreen({ route }: Props) {
  const { language, t } = useTranslation();
  const collector = useAuthStore((s) => s.collector);
  const insets = useSafeAreaInsets();
  useScreenNarration("Assistant");

  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const listenRef = useRef<RecognitionHandle | null>(null);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || thinking) return;
    setInput("");
    const userMsg: Message = { id: newId(), role: "user", content };
    const history = [...messages, userMsg];
    setMessages(history);
    setThinking(true);
    try {
      const reply = await askAssistant({
        // Backend accepts at most 20 messages.
        messages: history.slice(-20).map((m) => ({ role: m.role, content: m.content })),
        language,
        collectorId: collector?.id,
        location:
          collector?.latitude != null && collector?.longitude != null
            ? { latitude: collector.latitude, longitude: collector.longitude }
            : undefined,
      });
      setMessages((prev) => [...prev, { id: newId(), role: "assistant", content: reply.reply, reply }]);
      if (reply.suggestions.length) setSuggestions(reply.suggestions);
    } catch (err) {
      toast.error(t("assistantError"), isNetworkError(err) ? t("serverDownMsg") : (err as Error).message);
      // Put the question back so the user can retry.
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      setInput(content);
    } finally {
      setThinking(false);
    }
  };

  // Opened with a question (e.g. from the voice button) — ask it straight away.
  const initialPrompt = route.params?.prompt;
  useEffect(() => {
    // Sending the question is a side effect (network request) triggered by navigation — an effect is right here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialPrompt) void send(initialPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  useEffect(() => {
    return () => {
      listenRef.current?.stop();
      stopSpeaking();
    };
  }, []);

  const toggleMic = async () => {
    if (listening) {
      listenRef.current?.stop();
      listenRef.current = null;
      setListening(false);
      return;
    }
    setListening(true);
    listenRef.current = await startListening(
      language,
      // Fires once with the final transcript — ask it right away.
      (result) => void send(result.transcript),
      () => {
        setListening(false);
        listenRef.current = null;
      },
      (msg) => toast.warn(t("notUnderstood"), msg)
    );
  };

  const resetChat = () => {
    stopSpeaking();
    setMessages([]);
    setSuggestions([]);
  };

  const providerLabel = (p: AssistantReply["provider"]) =>
    p === "offline" ? t("offlineAnswer") : t("sourceLocal");

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <CinematicBackdrop intensity={0.5} />
      <View style={{ paddingTop: insets.top + space.md, paddingHorizontal: space.lg }}>
        <TopBar
          kicker={t("assistantSubtitle")}
          title={t("assistantTitle")}
          onBack={goBack}
          right={
            messages.length ? (
              <PressScale onPress={resetChat} style={styles.iconBtn} accessibilityLabel={t("newChat")} accessibilityRole="button">
                <Ionicons name="refresh" size={20} color={colors.ink} />
              </PressScale>
            ) : null
          }
        />
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.thread}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        <View style={[styles.bubble, styles.botBubble]}>
          <Text style={styles.botText}>{t("assistantHello")}</Text>
        </View>

        {messages.map((m) => (
          <Animated.View key={m.id} entering={FadeInUp.springify().damping(18)}>
            {m.role === "user" ? (
              <View style={[styles.bubble, styles.userBubble]}>
                <Text style={styles.userText}>{m.content}</Text>
              </View>
            ) : (
              <View style={[styles.bubble, styles.botBubble]}>
                {m.reply?.steps.length ? (
                  <View style={styles.steps}>
                    {m.reply.steps.map((s, i) => (
                      <View key={i} style={styles.stepRow}>
                        <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
                        <Text style={styles.stepText} numberOfLines={2}>{t("checked")}: {s.summary}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                <Text style={styles.botText}>{m.content}</Text>
                {m.reply?.actions.length ? (
                  <View style={styles.actions}>
                    {m.reply.actions.map((a, i) => {
                      const meta = ACTION_META[a.type];
                      const detail = [a.material ? materialName(a.material, language) : null, a.weight_kg ? `${a.weight_kg} ${t("kg")}` : null]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <PressScale key={i} onPress={() => runAction(a)} style={styles.actionBtn} accessibilityRole="button">
                          <Ionicons name={meta.icon} size={16} color={colors.onPrimary} />
                          <Text style={styles.actionText} numberOfLines={1}>
                            {t(meta.label)}{detail ? ` · ${detail}` : ""}
                          </Text>
                        </PressScale>
                      );
                    })}
                  </View>
                ) : null}
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>{m.reply ? t("poweredBy", { provider: providerLabel(m.reply.provider) }) : ""}</Text>
                  <PressScale onPress={() => speak(m.content, language)} style={styles.speakBtn} accessibilityLabel={t("listen")} accessibilityRole="button">
                    <Ionicons name="volume-high" size={16} color={colors.primaryDark} />
                  </PressScale>
                </View>
              </View>
            )}
          </Animated.View>
        ))}

        {thinking ? (
          <View style={[styles.bubble, styles.botBubble, { alignSelf: "flex-start" }]}>
            <TypingDots />
          </View>
        ) : null}
      </ScrollView>

      {suggestions.length && !thinking ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestBar} contentContainerStyle={styles.suggestRow} keyboardShouldPersistTaps="handled">
          {suggestions.map((s) => (
            <Chip key={s} label={s} icon="sparkles" onPress={() => void send(s)} />
          ))}
        </ScrollView>
      ) : null}

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + space.sm }]}>
        <PressScale
          onPress={() => void toggleMic()}
          style={[styles.micBtn, listening && { backgroundColor: colors.danger }]}
          accessibilityLabel={listening ? t("listening") : t("tapToSpeak")}
          accessibilityRole="button"
        >
          <Ionicons name={listening ? "stop" : "mic"} size={20} color={listening ? colors.onPrimary : colors.purple} />
        </PressScale>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={listening ? t("listening") : t("askPlaceholder")}
          placeholderTextColor={colors.faint}
          style={styles.input}
          multiline
          maxLength={500}
          onSubmitEditing={() => void send(input)}
          blurOnSubmit
          returnKeyType="send"
        />
        <PressScale
          onPress={() => void send(input)}
          disabled={!input.trim() || thinking}
          style={[styles.sendBtn, (!input.trim() || thinking) && { opacity: 0.4 }]}
          accessibilityLabel={t("send")}
          accessibilityRole="button"
        >
          <Ionicons name="send" size={18} color={colors.onPrimary} />
        </PressScale>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BACKDROP_BG },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: P("#020705"), borderWidth: 1, borderColor: P("rgba(248,250,247,0.08)") },
  thread: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm },
  bubble: { maxWidth: "88%", borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: space.md },
  botBubble: { alignSelf: "flex-start", backgroundColor: P("rgba(248,250,247,0.055)"), borderWidth: 1, borderColor: P("rgba(248,250,247,0.09)"), borderTopLeftRadius: 6 },
  userBubble: { alignSelf: "flex-end", backgroundColor: colors.primary, borderTopRightRadius: 6 },
  botText: { fontSize: 15, lineHeight: 22, color: colors.ink },
  userText: { fontSize: 15, lineHeight: 22, color: colors.onPrimary },
  steps: { gap: 4, marginBottom: space.sm, paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepText: { flex: 1, fontSize: 12, color: colors.muted },
  actions: { gap: space.xs, marginTop: space.md },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 10 },
  actionText: { flex: 1, color: colors.onPrimary, fontWeight: "700", fontSize: 14 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.sm },
  metaText: { fontSize: 11, color: colors.faint },
  speakBtn: { width: 30, height: 30, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: P("#020705"), borderWidth: 1, borderColor: P("rgba(168,232,201,0.18)") },
  suggestBar: { flexGrow: 0 },
  suggestRow: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm, backgroundColor: P("rgba(9,22,19,0.82)"), borderTopWidth: 1, borderTopColor: P("rgba(168,232,201,0.10)") },
  micBtn: { width: 44, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: P("#020705"), borderWidth: 1, borderColor: P("rgba(167,165,232,0.3)") },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: radius.md, paddingHorizontal: space.md, paddingTop: 12, paddingBottom: 12, fontSize: 15, color: colors.ink, backgroundColor: P("rgba(248,250,247,0.06)"), borderWidth: 1, borderColor: P("rgba(248,250,247,0.08)") },
  sendBtn: { width: 44, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
});
