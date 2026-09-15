import { listPendingLots, markLotSynced } from "../../database/sqlite";

/**
 * Financial state remains server-authoritative. This worker only sends local,
 * idempotent lot mutations once connectivity returns; it never invents a sale
 * or payment result on the device.
 */
export async function syncPendingLots(sendLot: (lotId: string) => Promise<void>) {
  const pendingLots = await listPendingLots();
  for (const lot of pendingLots) {
    await sendLot(lot.id);
    await markLotSynced(lot.id);
  }
  return pendingLots.length;
}
