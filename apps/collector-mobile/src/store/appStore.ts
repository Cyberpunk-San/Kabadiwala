import { create } from "zustand";

import { createOfflineLot, initialiseDatabase, listLots } from "../database/sqlite";
import type { CreateLotInput, Language, Lot } from "../types/domain";

type AppState = {
  language: Language;
  lots: Lot[];
  isOnline: boolean;
  isHydrated: boolean;
  setLanguage: (language: Language) => void;
  setOnline: (isOnline: boolean) => void;
  hydrate: () => Promise<void>;
  addLot: (input: CreateLotInput) => Promise<Lot>;
};

export const useAppStore = create<AppState>((set) => ({
  language: "en",
  lots: [],
  isOnline: true,
  isHydrated: false,
  setLanguage: (language) => set({ language }),
  setOnline: (isOnline) => set({ isOnline }),
  hydrate: async () => {
    await initialiseDatabase();
    const lots = await listLots();
    set({ lots, isHydrated: true });
  },
  addLot: async (input) => {
    const lot = await createOfflineLot(input);
    set((state) => ({ lots: [lot, ...state.lots] }));
    return lot;
  }
}));
