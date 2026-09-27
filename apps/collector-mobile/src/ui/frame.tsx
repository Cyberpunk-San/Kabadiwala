// src/ui/frame.tsx — the app is laid out for a phone. On wider screens (web on a laptop, tablets)
// it sits in a centred phone-width column instead of stretching, so every screen keeps one fixed size.
import type { ReactNode } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { P } from "../constants/palette";
export const APP_MAX_WIDTH = 460;

/** Size of the app's column — use this instead of useWindowDimensions for layout. */
export function useAppSize() {
  const { width, height } = useWindowDimensions();
  return { width: Math.min(width, APP_MAX_WIDTH), height };
}

export function AppFrame({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  return (
    <View style={styles.outer}>
      <View style={[styles.column, width > APP_MAX_WIDTH && styles.framed]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, alignItems: "center", backgroundColor: P("#010403") },
  column: { flex: 1, width: "100%", maxWidth: APP_MAX_WIDTH, overflow: "hidden", backgroundColor: P("#030907") },
  framed: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: P("rgba(168,232,201,0.08)") },
});
