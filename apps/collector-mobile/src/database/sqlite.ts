// src/database/sqlite.ts — offline lot storage.
//
// Native: expo-sqlite. Web: AsyncStorage (localStorage), because expo-sqlite
// is native-only. Both expose the same async API.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import type { CreateLotInput, Lot, LotEvent } from "../types/domain";

export const makeId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function buildLot(input: CreateLotInput): Lot {
  return {
    id: input.id ?? makeId("lot_off"),
    material: input.material,
    quality: input.quality,
    weightKg: input.weightKg,
    status: input.status ?? "AVAILABLE",
    imageUri: input.imageUri ?? input.imageUris?.[0],
    imageUris: input.imageUris ?? (input.imageUri ? [input.imageUri] : undefined),
    createdAt: input.createdAt ?? new Date().toISOString(),
    expectedNetEarnings: input.expectedNetEarnings,
    syncState: input.syncState ?? "PENDING",
    recyclerId: input.recyclerId,
    recyclerName: input.recyclerName,
  };
}

const byNewest = (a: Lot, b: Lot) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

// ─── Web store (AsyncStorage-backed so data survives a page reload) ─────────
const WEB_KEY = "@mhk_lots_v2";

class WebStore {
  private lots = new Map<string, Lot>();
  private loaded = false;

  async init() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await AsyncStorage.getItem(WEB_KEY);
      const parsed: Lot[] = raw ? JSON.parse(raw) : [];
      parsed.forEach((l) => this.lots.set(l.id, l));
    } catch (err) {
      console.warn("[db] web load failed:", err);
    }
  }

  private async save() {
    try {
      await AsyncStorage.setItem(WEB_KEY, JSON.stringify([...this.lots.values()]));
    } catch (err) {
      console.warn("[db] web save failed:", err);
    }
  }

  async upsert(lots: Lot[]) {
    lots.forEach((l) => {
      const prev = this.lots.get(l.id);
      this.lots.set(l.id, { ...prev, ...l, imageUri: prev?.imageUri ?? l.imageUri, imageUris: prev?.imageUris ?? l.imageUris });
    });
    await this.save();
  }

  async list() {
    return [...this.lots.values()].sort(byNewest);
  }

  async patch(id: string, patch: Partial<Lot>) {
    const lot = this.lots.get(id);
    if (!lot) return;
    this.lots.set(id, { ...lot, ...patch });
    await this.save();
  }

  async get(id: string) {
    return this.lots.get(id);
  }

  async clear() {
    this.lots.clear();
    await this.save();
  }
}

// ─── Native SQLite ───────────────────────────────────────────────────────────
type SQLiteDB = import("expo-sqlite").SQLiteDatabase;
let _db: SQLiteDB | null = null;

async function nativeDB(): Promise<SQLiteDB> {
  if (!_db) {
    const SQLite = await import("expo-sqlite");
    _db = await SQLite.openDatabaseAsync("mai-hu-kabadiwala.db");
  }
  return _db;
}

type LotRowDb = {
  id: string; material: Lot["material"]; quality: Lot["quality"]; weight_kg: number;
  status: Lot["status"]; image_uri: string | null; image_uris: string | null; created_at: string;
  expected_net_earnings: number | null; sync_state: Lot["syncState"];
  recycler_id: string | null; recycler_name: string | null;
};

function parseUris(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined;
  } catch {
    return undefined;
  }
}

const fromRow = (row: LotRowDb): Lot => ({
  id: row.id,
  material: row.material,
  quality: row.quality,
  weightKg: row.weight_kg,
  status: row.status,
  imageUri: row.image_uri ?? undefined,
  imageUris: parseUris(row.image_uris) ?? (row.image_uri ? [row.image_uri] : undefined),
  createdAt: row.created_at,
  expectedNetEarnings: row.expected_net_earnings ?? undefined,
  syncState: row.sync_state,
  recyclerId: row.recycler_id ?? undefined,
  recyclerName: row.recycler_name ?? undefined,
});

const web = new WebStore();
const isWeb = Platform.OS === "web";

// ─── Public API ──────────────────────────────────────────────────────────────

export async function initialiseDatabase() {
  if (isWeb) return web.init();

  const db = await nativeDB();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS lots (
      id TEXT PRIMARY KEY NOT NULL,
      material TEXT NOT NULL,
      quality TEXT NOT NULL,
      weight_kg REAL NOT NULL,
      status TEXT NOT NULL,
      image_uri TEXT,
      created_at TEXT NOT NULL,
      expected_net_earnings REAL,
      sync_state TEXT NOT NULL DEFAULT 'PENDING'
    );
    CREATE TABLE IF NOT EXISTS lot_events (
      id TEXT PRIMARY KEY NOT NULL,
      lot_id TEXT NOT NULL,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_lot_events_lot_id ON lot_events(lot_id);
  `);

  // Migration for installs created before recycler columns existed.
  const cols = await db.getAllAsync<{ name: string }>("PRAGMA table_info(lots)");
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("recycler_id")) await db.execAsync("ALTER TABLE lots ADD COLUMN recycler_id TEXT");
  if (!names.has("recycler_name")) await db.execAsync("ALTER TABLE lots ADD COLUMN recycler_name TEXT");
  if (!names.has("image_uris")) await db.execAsync("ALTER TABLE lots ADD COLUMN image_uris TEXT");
}

export async function createOfflineLot(input: CreateLotInput): Promise<Lot> {
  const lot = buildLot(input);
  await upsertLots([lot]);
  await appendLotEvent(lot.id, "LOT_CREATED", { material: lot.material, weightKg: lot.weightKg });
  return lot;
}

/** Insert or update lots (used for new lots and for merging server lots). */
export async function upsertLots(lots: Lot[]) {
  if (!lots.length) return;
  if (isWeb) return web.upsert(lots);

  const db = await nativeDB();
  await db.withTransactionAsync(async () => {
    for (const l of lots) {
      await db.runAsync(
        `INSERT INTO lots (id, material, quality, weight_kg, status, image_uri, image_uris, created_at, expected_net_earnings, sync_state, recycler_id, recycler_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           weight_kg = excluded.weight_kg,
           expected_net_earnings = COALESCE(excluded.expected_net_earnings, lots.expected_net_earnings),
           sync_state = excluded.sync_state,
           image_uri = COALESCE(lots.image_uri, excluded.image_uri),
           image_uris = COALESCE(lots.image_uris, excluded.image_uris),
           recycler_id = COALESCE(excluded.recycler_id, lots.recycler_id),
           recycler_name = COALESCE(excluded.recycler_name, lots.recycler_name)`,
        l.id, l.material, l.quality, l.weightKg, l.status, l.imageUri ?? null,
        l.imageUris?.length ? JSON.stringify(l.imageUris) : null, l.createdAt,
        l.expectedNetEarnings ?? null, l.syncState, l.recyclerId ?? null, l.recyclerName ?? null
      );
    }
  });
}

export async function appendLotEvent(lotId: string, type: string, payload: Record<string, unknown> = {}) {
  const event: LotEvent = { id: makeId("event"), lotId, type, createdAt: new Date().toISOString(), payload };
  if (isWeb) return event; // event log is native-only (audit trail on device)
  const db = await nativeDB();
  await db.runAsync(
    "INSERT INTO lot_events (id, lot_id, type, created_at, payload_json) VALUES (?, ?, ?, ?, ?)",
    event.id, event.lotId, event.type, event.createdAt, JSON.stringify(event.payload)
  );
  return event;
}

export async function listLots(): Promise<Lot[]> {
  if (isWeb) return web.list();
  const db = await nativeDB();
  const rows = await db.getAllAsync<LotRowDb>("SELECT * FROM lots ORDER BY created_at DESC");
  return rows.map(fromRow);
}

export async function markLotSynced(lotId: string) {
  if (isWeb) return web.patch(lotId, { syncState: "SYNCED" });
  const db = await nativeDB();
  await db.runAsync("UPDATE lots SET sync_state = 'SYNCED' WHERE id = ?", lotId);
  await appendLotEvent(lotId, "SYNC_COMPLETED");
}

export async function updateLotStatus(lotId: string, status: Lot["status"]) {
  if (isWeb) return web.patch(lotId, { status });
  const db = await nativeDB();
  await db.runAsync("UPDATE lots SET status = ? WHERE id = ?", status, lotId);
  await appendLotEvent(lotId, "STATUS_UPDATED", { newStatus: status });
}

export async function getLotById(lotId: string): Promise<Lot | undefined> {
  if (isWeb) return web.get(lotId);
  const db = await nativeDB();
  const row = await db.getFirstAsync<LotRowDb>("SELECT * FROM lots WHERE id = ?", lotId);
  return row ? fromRow(row) : undefined;
}

/** Wipe local lots (on sign-out, so the next user doesn't see them). */
export async function clearLots() {
  if (isWeb) return web.clear();
  const db = await nativeDB();
  await db.execAsync("DELETE FROM lots; DELETE FROM lot_events;");
}
