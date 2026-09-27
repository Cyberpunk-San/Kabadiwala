// src/screens/NotificationsScreen.tsx — operational feed: nearby pickups, buyer demands,
// payments and risk alerts, newest first, with unread state.
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { dark as D, hues, radius, space } from "../constants/theme";
import { type AppNotification, type NotificationKind, useNotifications } from "../features/notifications/useNotifications";
import { useTranslation } from "../hooks/useTranslation";
import type { TranslationKey } from "../i18n";
import { go, goBack } from "../navigation/ref";
import { EmptyState, ErrorState } from "../ui/feedback";
import { Skeleton } from "../ui/motion";
import { Chip, enter, PressScale, Screen, TopBar } from "../ui/primitives";
import { Text } from "../ui/Text";
import { relativeDate } from "../utils/format";

import { P } from "../constants/palette";
type Filter = "all" | NotificationKind;
const FILTERS: { value: Filter; label: TranslationKey }[] = [
  { value: "all", label: "all" },
  { value: "pickup", label: "nfPickups" },
  { value: "demand", label: "nfBuyers" },
  { value: "payment", label: "nfPayments" },
  { value: "alert", label: "nfAlerts" },
];

/** One hue per kind, so the feed scans at a glance. */
const TONE: Record<NotificationKind, { fg: string; bg: string }> = {
  pickup: { fg: hues.coral, bg: P("rgba(233,130,95,0.14)") },
  demand: { fg: hues.cyan, bg: P("rgba(47,168,184,0.16)") },
  payment: { fg: D.mint, bg: P("rgba(143,217,187,0.14)") },
  alert: { fg: hues.amber, bg: P("rgba(217,152,46,0.16)") },
};

export function NotificationsScreen() {
  const { t, language } = useTranslation();
  const feed = useNotifications();
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);

  const items = feed.items.filter((i) => filter === "all" || i.kind === filter);
  const fresh = items.filter((i) => feed.isUnread(i.id));
  const earlier = items.filter((i) => !feed.isUnread(i.id));

  const open = (n: AppNotification) => {
    feed.markRead(n.id);
    const tgt = n.target;
    if (tgt.screen === "PickupDetail") go("PickupDetail", { pickupId: tgt.pickupId });
    else if (tgt.screen === "Handover") go("Handover", { lotId: tgt.lotId });
    else if (tgt.screen === "Demands") go("Demands");
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await feed.refetch();
    setRefreshing(false);
  };

  return (
    <Screen dark refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={D.mint} />}>
      <TopBar
        title={t("notifications")}
        onBack={goBack}
        right={feed.unreadCount ? (
          <Pressable onPress={feed.markAllRead} hitSlop={8} accessibilityRole="button" style={styles.markAll}>
            <Text style={styles.markAllText}>{t("markAllRead")}</Text>
          </Pressable>
        ) : undefined}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} style={styles.filterScroll}>
        {FILTERS.map((f) => (
          <Chip key={f.value} label={t(f.label)} active={filter === f.value} onPress={() => setFilter(f.value)} />
        ))}
      </ScrollView>

      {feed.isLoading ? (
        <View style={{ gap: space.md }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.skelRow}>
              <Skeleton width={40} height={40} style={{ borderRadius: radius.md, backgroundColor: D.surfaceAlt }} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton height={12} width="45%" style={{ backgroundColor: D.surfaceAlt }} />
                <Skeleton height={12} width="85%" style={{ backgroundColor: D.surfaceAlt }} />
              </View>
            </View>
          ))}
        </View>
      ) : feed.isError ? (
        <ErrorState title={t("serverDown")} message={t("serverDownMsg")} onRetry={() => void feed.refetch()} retryLabel={t("retry")} />
      ) : !items.length ? (
        <EmptyState icon="notifications-outline" title={t("allCaughtUp")} message={t("allCaughtUpMsg")} />
      ) : (
        <>
          {fresh.length ? <Group title={t("new")} items={fresh} unread onOpen={open} language={language} /> : null}
          {earlier.length ? <Group title={t("earlier")} items={earlier} onOpen={open} language={language} /> : null}
        </>
      )}
    </Screen>
  );
}

function Group({ title, items, unread, onOpen, language }: { title: string; items: AppNotification[]; unread?: boolean; onOpen: (n: AppNotification) => void; language: "en" | "hi" | "mr" }) {
  return (
    <View style={{ marginBottom: space.lg }}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.group}>
        {items.map((n, i) => {
          const tone = TONE[n.kind];
          return (
            <Animated.View key={n.id} entering={enter(Math.min(i, 6))}>
              <PressScale onPress={() => onOpen(n)} scaleTo={0.99} style={[styles.row, i < items.length - 1 && styles.divider]} accessibilityRole="button">
                <View style={[styles.icon, { borderColor: `${tone.fg}44` }]}>
                  <Ionicons name={n.icon} size={20} color={tone.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.title} numberOfLines={1}>{n.title}</Text>
                    <Text style={styles.time}>{relativeDate(n.at, language)}</Text>
                  </View>
                  <Text style={styles.body} numberOfLines={2}>{n.body}</Text>
                </View>
                {unread ? <View style={styles.unread} /> : null}
              </PressScale>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  markAll: { minHeight: 40, justifyContent: "center" },
  markAllText: { fontSize: 14, fontWeight: "600", color: D.mint },
  filterScroll: { marginHorizontal: -space.lg, marginBottom: space.lg },
  filters: { gap: space.sm, paddingHorizontal: space.lg },
  groupTitle: { fontSize: 13, fontWeight: "500", color: D.inkSoft, marginBottom: space.sm },
  group: { borderRadius: radius.lg, backgroundColor: D.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: D.line, paddingHorizontal: space.md },
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.md, paddingVertical: space.md },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: D.line },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: P("#020705"), borderWidth: 1 },
  titleRow: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  title: { flex: 1, fontSize: 15, fontWeight: "600", color: D.ink },
  time: { fontSize: 12, color: D.faint },
  body: { marginTop: 2, fontSize: 14, lineHeight: 20, color: D.inkSoft },
  unread: { width: 8, height: 8, borderRadius: 4, backgroundColor: D.mint, marginTop: 6 },
  skelRow: { flexDirection: "row", gap: space.md, alignItems: "center" },
});
