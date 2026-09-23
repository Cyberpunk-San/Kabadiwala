// src/hooks/useScreenNarration.ts
import { useEffect } from "react";

import { narrateScreen } from "../services/voice/narration";
import { useAccessibilityStore } from "../store/accessibilityStore";
import { useAppStore } from "../store/appStore";

/**
 * Narrates the current screen on mount when voice-guided navigation is on.
 * Also replays when language changes.
 */
export function useScreenNarration(screenName: string) {
  const enabled = useAccessibilityStore((s) => s.voiceNavigationEnabled);
  const language = useAppStore((s) => s.language);

  useEffect(() => {
    narrateScreen(screenName, language, enabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenName, language, enabled]);
}