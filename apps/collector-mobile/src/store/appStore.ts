import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import { createOfflineLot, initialiseDatabase, listLots, updateLotStatus as updateSqliteLotStatus } from "../database/sqlite";
import type { AdminStats, CreateLotInput, Language, Lot, LotStatus, UserProfile, UserRole } from "../types/domain";

const LANGUAGE_STORAGE_KEY = "@mhk_collector_language";
const ROLE_STORAGE_KEY = "@mhk_role";

// ─── Demo Profiles (one per role) ─────────────────────────────────────────────
export const DEMO_PROFILES: Record<UserRole, UserProfile> = {
  kabadiwala: {
    id: "CLT-4218",
    name: "Ramesh Kumar",
    initials: "RK",
    role: "kabadiwala",
    cluster: "Bhosari MIDC, Pune",
    collectorId: "CLT-4218",
    monthlyAamdani: 34800,
    greenKgSaved: 480,
    co2OffsetKg: 340,
    tier: "gold",
    weeklyGoal: 12000
  },
  user: {
    id: "USR-7731",
    name: "Priya Sharma",
    initials: "PS",
    role: "user",
    cluster: "Kothrud, Pune",
    address: "Flat 4B, Sai Residency, Kothrud, Pune 411038",
    lastPickupDate: "2026-09-15"
  },
  admin: {
    id: "ADM-001",
    name: "Siddharth Rao",
    initials: "SR",
    role: "admin",
    cluster: "Maharashtra Region",
    jurisdiction: "Maharashtra — CPCB Zone 3"
  }
};

// ─── Demo Admin Stats (computed from in-memory store on web, real on native) ──
export const DEMO_ADMIN_STATS: AdminStats = {
  totalCollectors: 1284,
  totalLotsToday: 347,
  totalKgToday: 8920,
  totalEarningsToday: 2340800,
  hazardLotsOpen: 12,
  pendingSyncLots: 28,
  eprTonnageMonth: 145.6,
  topCluster: "Dharavi Recycling Hub, Mumbai"
};

// ─── State ────────────────────────────────────────────────────────────────────
type AppState = {
  language: Language;
  lots: Lot[];
  isOnline: boolean;
  isHydrated: boolean;
  role: UserRole;
  profile: UserProfile;
  adminStats: AdminStats;

  setLanguage: (language: Language) => void;
  setOnline: (isOnline: boolean) => void;
  setRole: (role: UserRole) => void;
  hydrate: () => Promise<void>;
  addLot: (input: CreateLotInput) => Promise<Lot>;
  updateLotStatus: (lotId: string, status: LotStatus) => Promise<void>;
  refreshLots: () => Promise<void>;

  // Derived getters (computed from live lots)
  weeklyEarnings: () => number;
  weeklyWeight: () => number;
  weeklyGoalProgress: () => number; // 0-100
};

export const useAppStore = create<AppState>((set, get) => ({
  language: "hi",
  lots: [],
  isOnline: true,
  isHydrated: false,
  role: "kabadiwala",
  profile: DEMO_PROFILES.kabadiwala,
  adminStats: DEMO_ADMIN_STATS,

  // ── Setters ──────────────────────────────────────────────────────────────

  setLanguage: (language) => {
    set({ language });
    void AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language).catch((err) => {
      console.warn("Failed to persist language preference:", err);
    });
  },

  setOnline: (isOnline) => set({ isOnline }),

  setRole: (role) => {
    set({ role, profile: DEMO_PROFILES[role] });
    void AsyncStorage.setItem(ROLE_STORAGE_KEY, role).catch(() => {});
  },

  // ── Hydration ─────────────────────────────────────────────────────────────

  hydrate: async () => {
    try {
      await initialiseDatabase();
      const [storedLang, storedRole, lots] = await Promise.all([
        AsyncStorage.getItem(LANGUAGE_STORAGE_KEY),
        AsyncStorage.getItem(ROLE_STORAGE_KEY),
        listLots()
      ]);
      const language: Language =
        storedLang === "en" || storedLang === "hi" || storedLang === "mr"
          ? storedLang
          : "hi";
      const role: UserRole =
        storedRole === "kabadiwala" || storedRole === "user" || storedRole === "admin"
          ? storedRole
          : "kabadiwala";
      set({ language, lots, isHydrated: true, role, profile: DEMO_PROFILES[role] });
    } catch (error) {
      console.warn("Hydration error:", error);
      const lots = await listLots().catch(() => []);
      set({ lots, isHydrated: true });
    }
  },

  // ── Lot actions ──────────────────────────────────────────────────────────

  refreshLots: async () => {
    const lots = await listLots();
    set({ lots });
  },

  addLot: async (input) => {
    const lot = await createOfflineLot(input);
    set((state) => ({ lots: [lot, ...state.lots] }));
    return lot;
  },

  updateLotStatus: async (lotId, status) => {
    await updateSqliteLotStatus(lotId, status);
    set((state) => ({
      lots: state.lots.map((l) => (l.id === lotId ? { ...l, status } : l))
    }));
  },

  // ── Derived computations (live from lots) ────────────────────────────────

  weeklyEarnings: () => {
    const { lots, profile } = get();
    const fromLots = lots.reduce((acc, l) => acc + (l.expectedNetEarnings || 0), 0);
    // Fallback to a plausible default when no lots added yet
    return fromLots > 0 ? fromLots : 8460;
  },

  weeklyWeight: () => {
    const { lots } = get();
    const fromLots = lots.reduce((acc, l) => acc + (l.weightKg || 0), 0);
    return fromLots > 0 ? fromLots : 142;
  },

  weeklyGoalProgress: () => {
    const { weeklyEarnings, profile } = get();
    const goal = profile.weeklyGoal || 12000;
    return Math.min(100, Math.round((weeklyEarnings() / goal) * 100));
  }
}));
