// src/ui/feedback.tsx — toasts, dialogs, bottom sheets, empty and error states.
//
// React Native's Alert.alert() ignores its buttons on web, which silently broke
// onboarding and the market flow in the browser. Everything here works the same
// on Android, iOS and web.
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Modal, PanResponder, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { APP_MAX_WIDTH } from "./frame";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  FadeOutUp,
  interpolate,
  ZoomIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { create } from "zustand";

import { colors, motion, radius, shadow, space, type } from "../constants/theme";
import { CinematicBackdrop } from "./backdrop";
import { Button, EdgeLight, type IconName, tap } from "./primitives";
import { Text } from "./Text";

import { P } from "../constants/palette";
// ─── Toasts ──────────────────────────────────────────────────────────────────
type ToastKind = "success" | "error" | "info" | "warn";
type Toast = { id: number; kind: ToastKind; title: string; message?: string };

const useToastStore = create<{ toasts: Toast[]; push: (t: Omit<Toast, "id">) => void; remove: (id: number) => void }>((set) => ({
  toasts: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.kind === "error" ? 5000 : 3200);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = {
  success: (title: string, message?: string) => { tap("success"); useToastStore.getState().push({ kind: "success", title, message }); },
  error: (title: string, message?: string) => { tap("warning"); useToastStore.getState().push({ kind: "error", title, message }); },
  info: (title: string, message?: string) => useToastStore.getState().push({ kind: "info", title, message }),
  warn: (title: string, message?: string) => { tap("warning"); useToastStore.getState().push({ kind: "warn", title, message }); },
};

const TOAST_STYLE: Record<ToastKind, { icon: IconName; color: string }> = {
  success: { icon: "checkmark-circle", color: colors.primary },
  error: { icon: "alert-circle", color: colors.danger },
  info: { icon: "information-circle", color: colors.inkSoft },
  warn: { icon: "warning", color: colors.accent },
};

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.toastWrap, { top: insets.top + space.sm }]}>
      {toasts.map((t) => {
        const st = TOAST_STYLE[t.kind];
        return (
          <Animated.View key={t.id} entering={FadeInUp.duration(220)} exiting={FadeOutUp.duration(180)} style={{ width: "100%", alignItems: "center" }}>
            <Pressable onPress={() => remove(t.id)} style={styles.toast} accessibilityRole="alert">
              <Ionicons name={st.icon} size={22} color={st.color} />
              <View style={{ flex: 1 }}>
                <Text style={styles.toastTitle}>{t.title}</Text>
                {t.message ? <Text style={styles.toastMsg}>{t.message}</Text> : null}
              </View>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

// ─── Dialog (web-safe replacement for Alert with buttons) ────────────────────
type DialogAction = { label: string; onPress?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger" };
type DialogState = { visible: boolean; icon?: IconName; tone?: "primary" | "danger" | "warn"; title: string; message?: string; actions: DialogAction[] };

const useDialogStore = create<DialogState & { open: (d: Omit<DialogState, "visible">) => void; close: () => void }>((set) => ({
  visible: false,
  title: "",
  actions: [],
  open: (d) => set({ ...d, visible: true }),
  close: () => set({ visible: false }),
}));

export const dialog = {
  show: (d: Omit<DialogState, "visible">) => useDialogStore.getState().open(d),
  close: () => useDialogStore.getState().close(),
};

export function DialogHost() {
  const { visible, icon, tone = "primary", title, message, actions, close } = useDialogStore();
  const toneColor = { primary: P("#A8E8C9"), danger: P("#E7898F"), warn: P("#E5B86A") }[tone];
  // A confirmation ("checkmark") gets the full-screen success treatment.
  const success = visible && tone === "primary" && (icon === "checkmark-circle" || icon === "checkmark-circle-outline");
  if (success) {
    return (
      <Modal visible transparent animationType="none" onRequestClose={close} statusBarTranslucent>
        <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut.duration(180)} style={styles.successRoot}>
          <CinematicBackdrop intensity={0.8} />
          <View style={styles.successBody}>
            <Animated.View entering={ZoomIn.duration(420)} style={styles.successMark}>
              <View pointerEvents="none" style={styles.successGlow}><Halo color={P("#19A982")} opacity={0.35} /></View>
              <View style={styles.successDisc}>
                <Ionicons name="checkmark" size={44} color={P("#04120F")} />
              </View>
            </Animated.View>
            <Animated.Text entering={FadeInDown.delay(180).duration(320)} style={styles.successTitle}>{title}</Animated.Text>
            {message ? <Animated.Text entering={FadeInDown.delay(260).duration(320)} style={styles.successMsg}>{message}</Animated.Text> : null}
          </View>
          <Animated.View entering={FadeInDown.delay(340).duration(320)} style={styles.successActions}>
            {actions.map((a, i) => (
              <Button
                key={a.label}
                label={a.label}
                variant={a.variant ?? (i === 0 ? "light" : "secondary")}
                onPress={() => {
                  close();
                  a.onPress?.();
                }}
              />
            ))}
          </Animated.View>
        </Animated.View>
      </Modal>
    );
  }
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      {visible ? (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
          <Animated.View entering={FadeInDown.duration(220)} style={styles.dialog} accessibilityViewIsModal>
            <EdgeLight strength={0.08} />
            {icon ? (
              <View style={[styles.dialogIcon, { borderColor: `${toneColor}55` }]}>
                <Ionicons name={icon} size={24} color={toneColor} />
              </View>
            ) : null}
            <Text style={styles.dialogTitle}>{title}</Text>
            {message ? <Text style={styles.dialogMsg}>{message}</Text> : null}
            <View style={{ gap: space.sm, marginTop: space.lg, alignSelf: "stretch" }}>
              {actions.map((a, i) => (
                <Button
                  key={a.label}
                  label={a.label}
                  variant={a.variant ?? (i === 0 ? "primary" : "secondary")}
                  onPress={() => {
                    close();
                    a.onPress?.();
                  }}
                />
              ))}
            </View>
          </Animated.View>
        </Animated.View>
      ) : null}
    </Modal>
  );
}

function Halo({ color, opacity }: { color: string; opacity: number }) {
  return (
    <Svg width="100%" height="100%">
      <Defs>
        <RadialGradient id="success-halo" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#success-halo)" />
    </Svg>
  );
}

// ─── Bottom sheet (drag to dismiss, spring physics) ──────────────────────────
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 1.1;

export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const y = useSharedValue(screenH);
  const sheetH = useRef(screenH);

  // Open: spring up from below. Close: glide down, then unmount.
  useEffect(() => {
    if (visible) {
      setMounted(true);
      tap();
      y.value = screenH;
      y.value = withSpring(0, motion.spring);
    } else if (mounted) {
      y.value = withTiming(sheetH.current, { duration: 200, easing: Easing.in(Easing.cubic) }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        // Downward follows the finger; upward resists (rubber band).
        y.value = g.dy > 0 ? g.dy : g.dy / 6;
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) {
          y.value = withSpring(sheetH.current, { ...motion.spring, velocity: g.vy * 1000 });
          onClose();
        } else {
          y.value = withSpring(0, { ...motion.spring, velocity: g.vy * 1000 });
        }
      },
    })
  ).current;

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, sheetH.current], [1, 0]) }));

  if (!mounted) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.sheetRoot}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          onLayout={(e) => { sheetH.current = e.nativeEvent.layout.height; }}
          style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }, sheetStyle]}
          accessibilityViewIsModal
        >
          <View {...pan.panHandlers} style={styles.dragZone}>
            <View style={styles.grabber} />
            {title ? (
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{title}</Text>
                <Pressable onPress={onClose} hitSlop={8} style={styles.sheetClose} accessibilityLabel="Close" accessibilityRole="button">
                  <Ionicons name="close" size={20} color={colors.inkSoft} />
                </Pressable>
              </View>
            ) : null}
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Empty & error states ────────────────────────────────────────────────────
export function EmptyState({ icon = "file-tray-outline", title, message, action, onAction }: { icon?: IconName; title: string; message?: string; action?: string; onAction?: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={24} color={colors.inkSoft} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMsg}>{message}</Text> : null}
      {action ? <Button label={action} onPress={onAction} variant="secondary" size="md" style={{ marginTop: space.md }} /> : null}
    </Animated.View>
  );
}

export function ErrorState({ title, message, onRetry, retryLabel = "Try again" }: { title: string; message?: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.empty}>
      <View style={[styles.emptyIcon, { borderColor: P("rgba(231,137,143,0.35)") }]}>
        <Ionicons name="cloud-offline-outline" size={24} color={colors.danger} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMsg}>{message}</Text> : null}
      {onRetry ? <Button label={retryLabel} icon="refresh" onPress={onRetry} variant="secondary" size="md" style={{ marginTop: space.md }} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastWrap: { position: "absolute", left: space.lg, right: space.lg, zIndex: 9999, gap: space.sm, alignItems: "center" },
  toast: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.lg, backgroundColor: P("rgba(12,29,26,0.96)"), width: "100%", maxWidth: APP_MAX_WIDTH - 32, borderWidth: 1, borderColor: P("rgba(248,250,247,0.1)"), ...shadow.md },
  toastTitle: { fontSize: 15, fontWeight: "600", color: colors.ink },
  toastMsg: { marginTop: 2, fontSize: 13, color: colors.inkSoft, lineHeight: 18 },

  backdrop: { flex: 1, backgroundColor: colors.scrim, alignItems: "center", justifyContent: "center", padding: space.xl },
  dialog: { width: "100%", maxWidth: 400, backgroundColor: P("#0B1A17"), borderRadius: radius.xl, padding: space.xl, borderWidth: 1, borderColor: P("rgba(248,250,247,0.1)"), overflow: "hidden", ...shadow.md },
  dialogIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: space.md, backgroundColor: P("#020705"), borderWidth: 1 },
  dialogTitle: { ...type.h2, color: colors.ink },
  dialogMsg: { marginTop: space.sm, fontSize: 15, lineHeight: 22, color: colors.inkSoft },

  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  scrim: { backgroundColor: colors.scrim },
  sheet: { backgroundColor: P("#0B1A17"), borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: space.lg, maxHeight: "88%", width: "100%", maxWidth: APP_MAX_WIDTH, alignSelf: "center", borderWidth: 1, borderBottomWidth: 0, borderColor: P("rgba(248,250,247,0.1)"), ...shadow.md },
  dragZone: { paddingTop: space.sm },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: space.md },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.md },
  sheetTitle: { ...type.h2, color: colors.ink },
  sheetClose: { width: 36, height: 36, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceAlt },

  empty: { alignItems: "center", paddingVertical: space.xl, paddingHorizontal: space.lg },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: P("#020705"), borderWidth: 1, borderColor: P("rgba(168,232,201,0.16)"), marginBottom: space.md },
  successRoot: { flex: 1, backgroundColor: P("#030907"), paddingHorizontal: space.xl, justifyContent: "space-between" },
  successBody: { flex: 1, alignItems: "center", justifyContent: "center" },
  successMark: { width: 112, height: 112, alignItems: "center", justifyContent: "center" },
  successGlow: { position: "absolute", width: 240, height: 240 },
  successDisc: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", backgroundColor: P("#A8E8C9"), borderWidth: 1, borderColor: P("rgba(255,255,255,0.35)") },
  successTitle: { marginTop: space.xl, fontSize: 26, lineHeight: 32, fontWeight: "700", letterSpacing: -0.5, color: P("#F8FAF7"), textAlign: "center" },
  successMsg: { marginTop: space.sm, fontSize: 15, lineHeight: 22, color: P("rgba(248,250,247,0.62)"), textAlign: "center", maxWidth: 300 },
  successActions: { gap: space.sm, paddingBottom: space.xxxl },
  emptyTitle: { ...type.h3, color: colors.ink, textAlign: "center" },
  emptyMsg: { marginTop: space.xs, fontSize: 15, lineHeight: 22, color: colors.inkSoft, textAlign: "center", maxWidth: 320 },
});
