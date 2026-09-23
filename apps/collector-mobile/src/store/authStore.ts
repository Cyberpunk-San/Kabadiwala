// src/store/authStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import type { CollectorProfile } from "../services/api/client";
import { getCollector } from "../services/api/client";

const COLLECTOR_ID_KEY = "@mhk_collector_id";

type AuthState = {
  collector: CollectorProfile | null;
  isLoading: boolean;
  isHydrated: boolean;

  hydrate: () => Promise<void>;
  setCollector: (c: CollectorProfile | null) => Promise<void>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  collector: null,
  isLoading: false,
  isHydrated: false,

  hydrate: async () => {
    try {
      const storedId = await AsyncStorage.getItem(COLLECTOR_ID_KEY);
      if (!storedId) {
        set({ isHydrated: true });
        return;
      }
      set({ isLoading: true });
      const profile = await getCollector(storedId);
      set({ collector: profile, isLoading: false, isHydrated: true });
    } catch (err) {
      console.warn("[auth] hydrate failed:", err);
      set({ collector: null, isLoading: false, isHydrated: true });
    }
  },

  setCollector: async (c) => {
    set({ collector: c });
    if (c) {
      await AsyncStorage.setItem(COLLECTOR_ID_KEY, c.id);
    } else {
      await AsyncStorage.removeItem(COLLECTOR_ID_KEY);
    }
  },

  refresh: async () => {
    const current = get().collector;
    if (!current) return;
    try {
      const fresh = await getCollector(current.id);
      set({ collector: fresh });
    } catch (err) {
      console.warn("[auth] refresh failed:", err);
    }
  },

  signOut: async () => {
    await AsyncStorage.removeItem(COLLECTOR_ID_KEY);
    set({ collector: null });
  },
}));