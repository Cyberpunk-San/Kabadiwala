// src/store/appStore.ts — language, lots (offline-first + server merge), connectivity, sync.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import { config } from "../constants/config";
import {
  clearLots,
  createOfflineLot,
  initialiseDatabase,
  listLots,
  markLotSynced,
  updateLotStatus as updateSqliteLotStatus,
  upsertLots,
} from "../database/sqlite";
import { checkHealth, listMyLots, type RemoteLot } from "../services/api/client";
import { clearQueue, flush, queueSize } from "../services/sync/syncService";
import { isMaterial, type CreateLotInput, type Language, type Lot, type LotStatus } from "../types/domain";

const LANGUAGE_STORAGE_KEY = "@mhk_collector_language";

type AppState = {
  language: Language;
  lots: Lot[];
  isHydrated: boolean;
  /** Backend reachable (from /health), not just "phone has internet". */
  isOnline: boolean;
  /** Free cloud AI configured on the backend. */
  aiConnected: boolean;
  pendingSync: number;

  setLanguage: (language: Language) => void;
  hydrate: () => Promise<void>;
  addLot: (input: CreateLotInput) => Promise<Lot>;
  updateLotStatus: (lotId: string, status: LotStatus) => Promise<void>;
  refreshLots: (collectorId?: string) => Promise<void>;
  checkConnection: () => Promise<boolean>;
  syncNow: (collectorId?: string) => Promise<void>;
  resetForSignOut: () => Promise<void>;
};

function fromRemote(r: RemoteLot, existing?: Lot): Lot | null {
  if (!isMaterial(r.material)) return null;
  return {
    id: r.id,
    material: r.material,
    quality: r.quality,
    weightKg: r.weight_kg,
    status: r.status as LotStatus,
    createdAt: existing?.createdAt ?? (r.created_at.endsWith("Z") ? r.created_at : `${r.created_at}Z`),
    expectedNetEarnings: r.expected_net_earnings ?? existing?.expectedNetEarnings,
    syncState: "SYNCED",
    imageUri: existing?.imageUri,
    imageUris: existing?.imageUris,
    recyclerId: existing?.recyclerId,
    recyclerName: existing?.recyclerName,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  language: config.defaultLocale,
  lots: [],
  isHydrated: false,
  isOnline: true,
  aiConnected: false,
  pendingSync: 0,

  setLanguage: (language) => {
    set({ language });
    void AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language).catch(() => {});
  },

  hydrate: async () => {
    try {
      await initialiseDatabase();
      const [storedLang, lots, pending] = await Promise.all([
        AsyncStorage.getItem(LANGUAGE_STORAGE_KEY),
        listLots(),
        queueSize(),
      ]);
      const language: Language =
        storedLang === "en" || storedLang === "hi" || storedLang === "mr" ? storedLang : config.defaultLocale;
      set({ language, lots, pendingSync: pending, isHydrated: true });
    } catch (error) {
      console.warn("Hydration error:", error);
      set({ isHydrated: true });
    }
    void get().checkConnection();
  },

  addLot: async (input) => {
    const lot = await createOfflineLot(input);
    set((state) => ({ lots: [lot, ...state.lots.filter((l) => l.id !== lot.id)] }));
    return lot;
  },

  updateLotStatus: async (lotId, status) => {
    await updateSqliteLotStatus(lotId, status);
    set((state) => ({ lots: state.lots.map((l) => (l.id === lotId ? { ...l, status } : l)) }));
  },

  refreshLots: async (collectorId) => {
    const local = await listLots();
    if (collectorId) {
      try {
        const remote = await listMyLots(collectorId);
        const byId = new Map(local.map((l) => [l.id, l]));
        const merged = remote.map((r) => fromRemote(r, byId.get(r.id))).filter((l): l is Lot => !!l);
        await upsertLots(merged);
        set({ lots: await listLots(), isOnline: true });
        return;
      } catch {
        // Offline — keep showing what's on the phone.
      }
    }
    set({ lots: local });
  },

  checkConnection: async () => {
    try {
      const health = await checkHealth();
      const providers = health.components.ai_assistant?.providers;
      set({
        isOnline: true,
        aiConnected: !!(health.components.vision_ai?.local_clip || providers?.local),
      });
      return true;
    } catch {
      set({ isOnline: false });
      return false;
    }
  },

  syncNow: async (collectorId) => {
    const summary = await flush();
    for (const id of summary.syncedEntityIds) await markLotSynced(id);
    set({ pendingSync: summary.remaining, isOnline: !summary.hadError || get().isOnline });
    if (summary.syncedEntityIds.length || collectorId) await get().refreshLots(collectorId);
  },

  resetForSignOut: async () => {
    await Promise.all([clearLots(), clearQueue()]);
    set({ lots: [], pendingSync: 0 });
  },
}));

/** One loop for the whole app: health check + queue flush + server refresh. */
export function startSyncLoop(getCollectorId: () => string | undefined): () => void {
  const tick = async () => {
    const store = useAppStore.getState();
    const online = await store.checkConnection();
    if (online) await store.syncNow(getCollectorId());
  };
  void tick();
  const timer = setInterval(() => void tick(), Math.max(10_000, config.syncIntervalMs));
  return () => clearInterval(timer);
}
