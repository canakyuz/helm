// Webhook tetiklemesi icin debounce kurali: SAF fonksiyon, Deno.* yok, bun
// test ile kosar (bkz. I2). "analytics.synced" olayi Zernio tarafinda ne
// siklikta atesleniyor bilinmiyor - her olayda tam ingest + helm-alert
// zincirini yeniden calistirmak push kotasini ve alert_events'i gereksiz
// sisirir. Kural: en son senkron 30 dk'dan tazeyse yeni tetiklemeyi atla.
//
// Time: O(1), Space: O(1)

export function isRecentSync(
  lastSyncedAt: string | null | undefined,
  now: Date,
  windowMs: number,
): boolean {
  if (!lastSyncedAt) return false;
  const last = new Date(lastSyncedAt).getTime();
  if (Number.isNaN(last)) return false;
  return now.getTime() - last < windowMs;
}
