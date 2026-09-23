// src/store/accessibilityStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const KEY = "@mhk_accessibility";

type AccessibilityState = {
  // Voice-guided navigation (narrate screens on mount)
  voiceNavigationEnabled: boolean;
  // Global voice command bar (accessible from a floating button)
  voiceCommandsEnabled: boolean;
  // Larger fonts, simpler layouts
  simpleMode: boolean;
  // Persisted flag
  isHydrated: boolean;

  hydrate: () => Promise<void>;
  toggleVoiceNavigation: () => Promise<void>;
  toggleVoiceCommands: () => Promise<void>;
  toggleSimpleMode: () => Promise<void>;
};

type Persisted = Pick<
  AccessibilityState,
  "voiceNavigationEnabled" | "voiceCommandsEnabled" | "simpleMode"
>;

async function persist(state: Persisted) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("[accessibility] persist failed:", err);
  }
}

export const useAccessibilityStore = create<AccessibilityState>((set, get) => ({
  voiceNavigationEnabled: false,
  voiceCommandsEnabled: true,
  simpleMode: false,
  isHydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({
          voiceNavigationEnabled: !!parsed.voiceNavigationEnabled,
          voiceCommandsEnabled: parsed.voiceCommandsEnabled !== false,
          simpleMode: !!parsed.simpleMode,
          isHydrated: true,
        });
        return;
      }
    } catch (err) {
      console.warn("[accessibility] hydrate failed:", err);
    }
    set({ isHydrated: true });
  },

  toggleVoiceNavigation: async () => {
    const next = !get().voiceNavigationEnabled;
    set({ voiceNavigationEnabled: next });
    await persist({
      voiceNavigationEnabled: next,
      voiceCommandsEnabled: get().voiceCommandsEnabled,
      simpleMode: get().simpleMode,
    });
  },

  toggleVoiceCommands: async () => {
    const next = !get().voiceCommandsEnabled;
    set({ voiceCommandsEnabled: next });
    await persist({
      voiceNavigationEnabled: get().voiceNavigationEnabled,
      voiceCommandsEnabled: next,
      simpleMode: get().simpleMode,
    });
  },

  toggleSimpleMode: async () => {
    const next = !get().simpleMode;
    set({ simpleMode: next });
    await persist({
      voiceNavigationEnabled: get().voiceNavigationEnabled,
      voiceCommandsEnabled: get().voiceCommandsEnabled,
      simpleMode: next,
    });
  },
}));