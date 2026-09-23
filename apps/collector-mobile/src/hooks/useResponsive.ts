// src/hooks/useResponsive.ts
import { Dimensions } from "react-native";

import { useAccessibilityStore } from "../store/accessibilityStore";

export type ResponsiveTokens = {
  scale: number;         // multiplier for sizes
  fontSm: number;
  fontMd: number;
  fontLg: number;
  fontXl: number;
  padding: number;
  radius: number;
  isSmallDevice: boolean;
  isSimpleMode: boolean;
};

/**
 * Returns size tokens adapted to:
 *   - Device width
 *   - Simple-mode toggle (larger text, more spacing)
 */
export function useResponsive(): ResponsiveTokens {
  const simpleMode = useAccessibilityStore((s) => s.simpleMode);
  const { width } = Dimensions.get("window");
  const isSmallDevice = width < 360;

  // Base scale — small devices get slightly smaller text, simple mode bumps up
  let scale = 1.0;
  if (isSmallDevice) scale -= 0.05;
  if (simpleMode) scale += 0.20;

  return {
    scale,
    fontSm: Math.round(11 * scale),
    fontMd: Math.round(13 * scale),
    fontLg: Math.round(20 * scale),
    fontXl: Math.round(28 * scale),
    padding: Math.round(19 * (simpleMode ? 1.15 : 1)),
    radius: 16,
    isSmallDevice,
    isSimpleMode: simpleMode,
  };
}