// src/services/sync/syncService.ts
/**
 * Persistent offline sync queue.
 *
 * - Lots created without internet are queued here (survives app restarts).
 * - flush() POSTs the batch to /v1/sync/batch; idempotency keys make replays safe.
 * - Retries are driven by the app's single sync loop (see appStore.startSyncLoop),
 *   so failed flushes never stack up extra timers.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { syncBatch, type SyncItem } from "../api/client";

const QUEUE_KEY = "@mhk_sync_queue";
const DEVICE_KEY = "@mhk_sync_device_id";
export const MAX_RETRIES = 8;

export interface QueuedItem extends SyncItem {
  queued_at: string;
  attempts: number;
  last_error?: string;
}

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function makeIdempotencyKey(prefix = "idem"): string {
  return `${prefix}_${uid()}`;
}

export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `device_${uid()}`;
    await AsyncStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export async function loadQueue(): Promise<QueuedItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveQueue(items: QueuedItem[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items)).catch(() => {});
}

export async function enqueue(item: SyncItem): Promise<void> {
  const queue = await loadQueue();
  if (queue.some((q) => q.idempotency_key === item.idempotency_key)) return;
  queue.push({ ...item, queued_at: new Date().toISOString(), attempts: 0 });
  await saveQueue(queue);
}

export async function queueSize(): Promise<number> {
  return (await loadQueue()).filter((q) => q.attempts < MAX_RETRIES).length;
}

export interface FlushSummary {
  /** entity_ids the server now has (applied now or earlier). */
  syncedEntityIds: string[];
  remaining: number;
  hadError: boolean;
}

let flushing: Promise<FlushSummary> | null = null;

/** Send queued items. Concurrent calls share one in-flight request. */
export function flush(): Promise<FlushSummary> {
  if (!flushing) flushing = doFlush().finally(() => { flushing = null; });
  return flushing;
}

async function doFlush(): Promise<FlushSummary> {
  const queue = await loadQueue();
  const eligible = queue.filter((q) => q.attempts < MAX_RETRIES);
  if (!eligible.length) return { syncedEntityIds: [], remaining: 0, hadError: false };

  try {
    const res = await syncBatch(
      await getDeviceId(),
      eligible.map(({ entity, entity_id, idempotency_key, payload, client_created_at }) => ({
        entity, entity_id, idempotency_key, payload, client_created_at,
      }))
    );
    const done = new Map(
      res.results
        .filter((r) => r.status === "APPLIED" || r.status === "DUPLICATE")
        .map((r) => [r.idempotency_key, r.entity_id])
    );
    const errors = new Map(res.results.filter((r) => r.status === "REJECTED").map((r) => [r.idempotency_key, r.message]));
    const remaining = queue
      .filter((q) => !done.has(q.idempotency_key))
      .map((q) => (errors.has(q.idempotency_key) ? { ...q, attempts: q.attempts + 1, last_error: errors.get(q.idempotency_key) } : q));
    await saveQueue(remaining);
    return {
      syncedEntityIds: [...done.values()],
      remaining: remaining.filter((q) => q.attempts < MAX_RETRIES).length,
      hadError: false,
    };
  } catch (err) {
    // Network failure: nothing was applied; keep items as-is and try on the next loop tick.
    return { syncedEntityIds: [], remaining: eligible.length, hadError: true };
  }
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
