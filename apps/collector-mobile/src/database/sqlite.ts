import { Platform } from "react-native";
import type { CreateLotInput, Lot, LotEvent } from "../types/domain";

// ─── Web-safe in-memory store (IndexedDB-like) ───────────────────────────────
// expo-sqlite is native-only. On web we use a plain in-memory Map seeded with
// demo data so every screen works during a browser/Expo-web demo.

const makeId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// ---------- WEB FALLBACK ----------
class WebMemoryDB {
  private lots: Map<string, Lot> = new Map();
  private events: LotEvent[] = [];

  constructor() {
    // Seed 3 realistic demo lots
    const seed: Lot[] = [
      {
        id: "lot_demo_copper_01",
        material: "Copper",
        quality: "medium",
        weightKg: 35,
        status: "AVAILABLE",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        expectedNetEarnings: 18450,
        syncState: "SYNCED"
      },
      {
        id: "lot_demo_server_02",
        material: "PCB / Circuit boards",
        quality: "high",
        weightKg: 22.5,
        status: "PICKUP_SCHEDULED",
        createdAt: new Date(Date.now() - 43200000).toISOString(),
        expectedNetEarnings: 11475,
        syncState: "SYNCED"
      },
      {
        id: "lot_demo_battery_03",
        material: "Lithium-ion Battery",
        quality: "high",
        weightKg: 18,
        status: "IDENTIFIED",
        createdAt: new Date().toISOString(),
        expectedNetEarnings: 5040,
        syncState: "PENDING"
      }
    ];
    seed.forEach((l) => this.lots.set(l.id, l));
  }

  async init() {
    // No-op for web
  }

  async create(input: CreateLotInput): Promise<Lot> {
    const lot: Lot = {
      id: makeId("lot"),
      material: input.material,
      quality: input.quality,
      weightKg: input.weightKg,
      status: input.status ?? "AVAILABLE",
      imageUri: input.imageUri,
      createdAt: new Date().toISOString(),
      expectedNetEarnings: input.expectedNetEarnings,
      syncState: "PENDING"
    };
    this.lots.set(lot.id, lot);
    return lot;
  }

  async list(): Promise<Lot[]> {
    return [...this.lots.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async listPending(): Promise<{ id: string }[]> {
    return [...this.lots.values()]
      .filter((l) => l.syncState === "PENDING")
      .map((l) => ({ id: l.id }));
  }

  async markSynced(lotId: string) {
    const lot = this.lots.get(lotId);
    if (lot) this.lots.set(lotId, { ...lot, syncState: "SYNCED" });
  }

  async updateStatus(lotId: string, status: Lot["status"]) {
    const lot = this.lots.get(lotId);
    if (lot) this.lots.set(lotId, { ...lot, status });
  }

  async getById(lotId: string): Promise<Lot | undefined> {
    return this.lots.get(lotId);
  }

  async appendEvent(lotId: string, type: string, payload: Record<string, unknown> = {}) {
    const event: LotEvent = {
      id: makeId("event"),
      lotId,
      type,
      createdAt: new Date().toISOString(),
      payload
    };
    this.events.push(event);
    return event;
  }
}

// ---------- NATIVE SQLITE (lazy-loaded only on native) ----------
let _nativeSQLite: typeof import("expo-sqlite") | null = null;
const getNativeSQLite = async () => {
  if (!_nativeSQLite) {
    _nativeSQLite = await import("expo-sqlite");
  }
  return _nativeSQLite;
};

let _db: import("expo-sqlite").SQLiteDatabase | null = null;
const nativeDB = async () => {
  if (!_db) {
    const SQLite = await getNativeSQLite();
    _db = await SQLite.openDatabaseAsync("mai-hu-kabadiwala.db");
  }
  return _db;
};

// ---------- SINGLETON ----------
const webDB = new WebMemoryDB();
const isWeb = Platform.OS === "web";

// ─── Public API ──────────────────────────────────────────────────────────────

export async function initialiseDatabase() {
  if (isWeb) {
    await webDB.init();
    return;
  }
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
}

export async function createOfflineLot(input: CreateLotInput): Promise<Lot> {
  if (isWeb) return webDB.create(input);

  const db = await nativeDB();
  const lot: Lot = {
    id: makeId("lot"),
    material: input.material,
    quality: input.quality,
    weightKg: input.weightKg,
    status: input.status ?? "AVAILABLE",
    imageUri: input.imageUri,
    createdAt: new Date().toISOString(),
    expectedNetEarnings: input.expectedNetEarnings,
    syncState: "PENDING"
  };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO lots (id, material, quality, weight_kg, status, image_uri, created_at, expected_net_earnings, sync_state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      lot.id, lot.material, lot.quality, lot.weightKg, lot.status,
      lot.imageUri ?? null, lot.createdAt, lot.expectedNetEarnings ?? null, lot.syncState
    );
    await appendLotEvent(lot.id, "LOT_CREATED", { material: lot.material, weightKg: lot.weightKg });
  });
  return lot;
}

export async function appendLotEvent(
  lotId: string,
  type: string,
  payload: Record<string, unknown> = {}
) {
  if (isWeb) return webDB.appendEvent(lotId, type, payload);

  const db = await nativeDB();
  const event: LotEvent = {
    id: makeId("event"),
    lotId,
    type,
    createdAt: new Date().toISOString(),
    payload
  };
  await db.runAsync(
    "INSERT INTO lot_events (id, lot_id, type, created_at, payload_json) VALUES (?, ?, ?, ?, ?)",
    event.id, event.lotId, event.type, event.createdAt, JSON.stringify(event.payload)
  );
  return event;
}

export async function listLots(): Promise<Lot[]> {
  if (isWeb) return webDB.list();

  const db = await nativeDB();
  const rows = await db.getAllAsync<{
    id: string; material: Lot["material"]; quality: Lot["quality"];
    weight_kg: number; status: Lot["status"]; image_uri: string | null;
    created_at: string; expected_net_earnings: number | null; sync_state: Lot["syncState"];
  }>("SELECT * FROM lots ORDER BY created_at DESC");

  return rows.map((row) => ({
    id: row.id, material: row.material, quality: row.quality,
    weightKg: row.weight_kg, status: row.status,
    imageUri: row.image_uri ?? undefined, createdAt: row.created_at,
    expectedNetEarnings: row.expected_net_earnings ?? undefined,
    syncState: row.sync_state
  }));
}

export async function listPendingLots() {
  if (isWeb) return webDB.listPending();
  const db = await nativeDB();
  return db.getAllAsync<{ id: string }>("SELECT id FROM lots WHERE sync_state = 'PENDING'");
}

export async function markLotSynced(lotId: string) {
  if (isWeb) { await webDB.markSynced(lotId); return; }
  const db = await nativeDB();
  await db.runAsync("UPDATE lots SET sync_state = 'SYNCED' WHERE id = ?", lotId);
  await appendLotEvent(lotId, "SYNC_COMPLETED");
}

export async function updateLotStatus(lotId: string, status: Lot["status"]) {
  if (isWeb) { await webDB.updateStatus(lotId, status); return; }
  const db = await nativeDB();
  await db.runAsync("UPDATE lots SET status = ? WHERE id = ?", status, lotId);
  await appendLotEvent(lotId, "STATUS_UPDATED", { newStatus: status });
}

export async function getLotById(lotId: string): Promise<Lot | undefined> {
  if (isWeb) return webDB.getById(lotId);
  const db = await nativeDB();
  const row = await db.getFirstAsync<{
    id: string; material: Lot["material"]; quality: Lot["quality"];
    weight_kg: number; status: Lot["status"]; image_uri: string | null;
    created_at: string; expected_net_earnings: number | null; sync_state: Lot["syncState"];
  }>("SELECT * FROM lots WHERE id = ?", lotId);
  if (!row) return undefined;
  return {
    id: row.id, material: row.material, quality: row.quality,
    weightKg: row.weight_kg, status: row.status,
    imageUri: row.image_uri ?? undefined, createdAt: row.created_at,
    expectedNetEarnings: row.expected_net_earnings ?? undefined,
    syncState: row.sync_state
  };
}
