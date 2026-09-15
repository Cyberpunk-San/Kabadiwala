import * as SQLite from "expo-sqlite";

import type { CreateLotInput, Lot, LotEvent } from "../types/domain";

let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

const database = () => {
  databasePromise ??= SQLite.openDatabaseAsync("mai-hu-kabadiwala.db");
  return databasePromise;
};

const makeId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export async function initialiseDatabase() {
  const db = await database();
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
  const db = await database();
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
      lot.id,
      lot.material,
      lot.quality,
      lot.weightKg,
      lot.status,
      lot.imageUri ?? null,
      lot.createdAt,
      lot.expectedNetEarnings ?? null,
      lot.syncState
    );
    await appendLotEvent(lot.id, "LOT_CREATED", {
      material: lot.material,
      weightKg: lot.weightKg,
      source: "offline-first-mobile"
    });
  });

  return lot;
}

export async function appendLotEvent(lotId: string, type: string, payload: Record<string, unknown> = {}) {
  const db = await database();
  const event: LotEvent = {
    id: makeId("event"),
    lotId,
    type,
    createdAt: new Date().toISOString(),
    payload
  };
  await db.runAsync(
    "INSERT INTO lot_events (id, lot_id, type, created_at, payload_json) VALUES (?, ?, ?, ?, ?)",
    event.id,
    event.lotId,
    event.type,
    event.createdAt,
    JSON.stringify(event.payload)
  );
  return event;
}

export async function listLots(): Promise<Lot[]> {
  const db = await database();
  const rows = await db.getAllAsync<{
    id: string;
    material: Lot["material"];
    quality: Lot["quality"];
    weight_kg: number;
    status: Lot["status"];
    image_uri: string | null;
    created_at: string;
    expected_net_earnings: number | null;
    sync_state: Lot["syncState"];
  }>("SELECT * FROM lots ORDER BY created_at DESC");

  return rows.map((row) => ({
    id: row.id,
    material: row.material,
    quality: row.quality,
    weightKg: row.weight_kg,
    status: row.status,
    imageUri: row.image_uri ?? undefined,
    createdAt: row.created_at,
    expectedNetEarnings: row.expected_net_earnings ?? undefined,
    syncState: row.sync_state
  }));
}

export async function listPendingLots() {
  const db = await database();
  return db.getAllAsync<{ id: string }>("SELECT id FROM lots WHERE sync_state = 'PENDING'");
}

export async function markLotSynced(lotId: string) {
  const db = await database();
  await db.runAsync("UPDATE lots SET sync_state = 'SYNCED' WHERE id = ?", lotId);
  await appendLotEvent(lotId, "SYNC_COMPLETED");
}
