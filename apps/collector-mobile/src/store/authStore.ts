// src/store/authStore.ts — signed-in account for any role (kabadiwala / household / company).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import {
  ApiError,
  getCollector,
  getCompany,
  getHousehold,
  type CollectorProfile,
  type CompanyProfile,
  type HouseholdProfile,
  type LoginResult,
  type Role,
} from "../services/api/client";

const SESSION_KEY = "@mhk_session_v2"; // { role, id }
const CACHE_KEY = "@mhk_session_cache_v2"; // last known profile, for offline start
const LEGACY_COLLECTOR_KEY = "@mhk_collector_id";

type Session = { role: Role; id: string };

type AuthState = {
  role: Role | null;
  collector: CollectorProfile | null;
  household: HouseholdProfile | null;
  company: CompanyProfile | null;
  isHydrated: boolean;

  hydrate: () => Promise<void>;
  signIn: (result: LoginResult) => Promise<void>;
  /** Kept for KYC / profile updates of the kabadiwala. */
  setCollector: (c: CollectorProfile | null) => Promise<void>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const EMPTY = { role: null, collector: null, household: null, company: null } as const;

function sessionOf(result: LoginResult): Session | null {
  const id = result.collector?.id ?? result.household?.id ?? result.company?.id;
  return id ? { role: result.role, id } : null;
}

async function fetchProfile(s: Session): Promise<LoginResult> {
  if (s.role === "kabadiwala") return { role: s.role, collector: await getCollector(s.id) };
  if (s.role === "household") return { role: s.role, household: await getHousehold(s.id) };
  return { role: s.role, company: await getCompany(s.id) };
}

function toState(r: LoginResult) {
  return { role: r.role, collector: r.collector ?? null, household: r.household ?? null, company: r.company ?? null };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ...EMPTY,
  isHydrated: false,

  hydrate: async () => {
    try {
      let raw = await AsyncStorage.getItem(SESSION_KEY);
      // Migrate sessions saved by the previous app version.
      const legacyId = raw ? null : await AsyncStorage.getItem(LEGACY_COLLECTOR_KEY);
      if (legacyId) raw = JSON.stringify({ role: "kabadiwala", id: legacyId });
      if (!raw) return set({ isHydrated: true });

      const session = JSON.parse(raw) as Session;
      try {
        const fresh = await fetchProfile(session);
        await AsyncStorage.multiSet([[SESSION_KEY, JSON.stringify(session)], [CACHE_KEY, JSON.stringify(fresh)]]);
        set({ ...toState(fresh), isHydrated: true });
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          await AsyncStorage.multiRemove([SESSION_KEY, CACHE_KEY, LEGACY_COLLECTOR_KEY]);
          return set({ ...EMPTY, isHydrated: true });
        }
        // Offline start: stay signed in with the last known profile.
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        set({ ...(cached ? toState(JSON.parse(cached) as LoginResult) : EMPTY), isHydrated: true });
      }
    } catch (err) {
      console.warn("[auth] hydrate failed:", err);
      set({ ...EMPTY, isHydrated: true });
    }
  },

  signIn: async (result) => {
    const session = sessionOf(result);
    if (!session) return;
    await AsyncStorage.multiSet([[SESSION_KEY, JSON.stringify(session)], [CACHE_KEY, JSON.stringify(result)]]);
    set(toState(result));
  },

  setCollector: async (c) => {
    if (!c) return get().signOut();
    await get().signIn({ role: "kabadiwala", collector: c });
  },

  refresh: async () => {
    const { role, collector, household, company } = get();
    const id = collector?.id ?? household?.id ?? company?.id;
    if (!role || !id) return;
    try {
      const fresh = await fetchProfile({ role, id });
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
      set(toState(fresh));
    } catch {
      // Offline — keep showing cached data.
    }
  },

  signOut: async () => {
    await AsyncStorage.multiRemove([SESSION_KEY, CACHE_KEY, LEGACY_COLLECTOR_KEY]);
    set({ ...EMPTY });
  },
}));

/** Id + display name of whoever is signed in, whatever the role. */
export function useAccount() {
  const s = useAuthStore();
  const profile = s.collector ?? s.household ?? s.company;
  return { role: s.role, id: profile?.id, name: profile?.name ?? "", profile };
}
