// src/services/sync/syncQueue.ts
/**
 * Persistent offline sync queue.
 *
 * - Writes go here first (survives app restart via AsyncStorage)
 * - Flush attempts to POST the batch to /v1/sync/batch
 * - Retries with exponential backoff on failure
 * - Idempotency keys make replays safe
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { syncBatch, type SyncItem } from "../api/client";

const QUEUE_KEY = "@mhk_sync_queue";
const DEVICE_KEY = "@mhk_sync_device_id";
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 2000;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QueuedItem extends SyncItem {
  queued_at: string;
  attempts: number;
  last_error?: string;
}

// ─── Device ID ───────────────────────────────────────────────────────────────

function _uuid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `device_${_uuid()}`;
    await AsyncStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

// ─── Queue read/write ────────────────────────────────────────────────────────

export async function loadQueue(): Promise<QueuedItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("[syncQueue] load failed:", err);
    return [];
  }
}

async function saveQueue(items: QueuedItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn("[syncQueue] save failed:", err);
  }
}

// ─── Enqueue ─────────────────────────────────────────────────────────────────

export async function enqueue(item: SyncItem): Promise<void> {
  const queue = await loadQueue();
  // Dedupe by idempotency key
  if (queue.some((q) => q.idempotency_key === item.idempotency_key)) {
    return;
  }
  queue.push({
    ...item,
    queued_at: new Date().toISOString(),
    attempts: 0,
  });
  await saveQueue(queue);
}

export async function queueSize(): Promise<number> {
  return (await loadQueue()).length;
}

// ─── Flush ───────────────────────────────────────────────────────────────────

export interface FlushSummary {
  attempted: number;
  accepted: number;
  duplicates: number;
  rejected: number;
  remaining: number;
  hadError: boolean;
}

export async function flush(): Promise<FlushSummary> {
  const summary: FlushSummary = {
    attempted: 0,
    accepted: 0,
    duplicates: 0,
    rejected: 0,
    remaining: 0,
    hadError: false,
  };

  const queue = await loadQueue();
  if (queue.length === 0) {
    summary.remaining = 0;
    return summary;
  }

  const deviceId = await getDeviceId();

  // Only send items that haven't exceeded retries
  const eligible = queue.filter((q) => q.attempts < MAX_RETRIES);
  const skipped = queue.filter((q) => q.attempts >= MAX_RETRIES);

  if (eligible.length === 0) {
    summary.remaining = skipped.length;
    return summary;
  }

  summary.attempted = eligible.length;

  try {
    const payload: SyncItem[] = eligible.map((q) => ({
      entity: q.entity,
      entity_id: q.entity_id,
      idempotency_key: q.idempotency_key,
      payload: q.payload,
      client_created_at: q.client_created_at,
    }));

    const res = await syncBatch(deviceId, payload);

    // Remove the items that were successfully applied or flagged duplicate
    const resolvedKeys = new Set(
      res.results
        .filter((r) => r.status === "APPLIED" || r.status === "DUPLICATE")
        .map((r) => r.idempotency_key)
    );

    summary.accepted = res.accepted;
    summary.duplicates = res.duplicates;
    summary.rejected = res.rejected;

    // Update queue: drop resolved; bump attempts on remaining
    const remaining: QueuedItem[] = [];
    for (const q of queue) {
      if (resolvedKeys.has(q.idempotency_key)) continue;
      if (q.attempts >= MAX_RETRIES) {
        remaining.push(q); // keep but marked
        continue;
      }
      remaining.push({ ...q, attempts: q.attempts + 1 });
    }

    await saveQueue(remaining);
    summary.remaining = remaining.filter((q) => q.attempts < MAX_RETRIES).length;

    // Backoff: if anything left, delay next flush via a scheduled retry
    if (summary.remaining > 0) {
      const maxAttempts = Math.max(...remaining.map((q) => q.attempts));
      const delay = Math.min(BASE_BACKOFF_MS * 2 ** maxAttempts, 60_000);
      setTimeout(() => { void flush(); }, delay);
    }
  } catch (err: any) {
    summary.hadError = true;
    summary.remaining = eligible.length;

    // Bump attempts on all eligible
    const updated: QueuedItem[] = queue.map((q) =>
      q.attempts < MAX_RETRIES
        ? { ...q, attempts: q.attempts + 1, last_error: String(err?.message ?? err) }
        : q
    );
    await saveQueue(updated);

    // Retry with backoff
    const maxAttempts = Math.max(...updated.map((q) => q.attempts));
    const delay = Math.min(BASE_BACKOFF_MS * 2 ** maxAttempts, 60_000);
    setTimeout(() => { void flush(); }, delay);
  }

  return summary;
}

// ─── Clear ───────────────────────────────────────────────────────────────────

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

// ─── Helper: make an idempotency key ─────────────────────────────────────────

export function makeIdempotencyKey(prefix = "idem"): string {
  return `${prefix}_${_uuid()}`;
}