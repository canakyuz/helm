import * as SecureStore from "expo-secure-store";

// expo-secure-store async — sync API simülasyonu için in-memory cache + lazy hydration.
// Preferences (currency, selectedPropertyId) hassas değil ama bu paket zaten kurulu, ek pod yok.

const cache = new Map<string, string>();
const listeners = new Set<() => void>();
let hydrated = false;

const PREF_KEYS = [
  "pref.selectedPropertyId",
  "pref.currency",
  "pref.revenueMultiplier",
  "pref.prioritizeRevenueRequests",
] as const;

// Time:  O(n) preference key count; Space: O(n) for cache entries.
// Note:  Hydrates only known preference keys to avoid broad SecureStore scans.
async function hydrate() {
  if (hydrated) return;
  await Promise.all(
    PREF_KEYS.map(async (k) => {
      try {
        const v = await SecureStore.getItemAsync(k);
        if (v !== null) cache.set(k, v);
      } catch {
        // ignore — default values used
      }
    }),
  );
  hydrated = true;
  for (const l of listeners) l();
}

void hydrate();

export const storage = {
  getString(key: string): string | undefined {
    return cache.get(key);
  },
  // Time:  O(n) listener count; Space: O(1) auxiliary.
  // Note:  Immediate fan-out keeps useSyncExternalStore snapshots fresh.
  set(key: string, value: string): void {
    cache.set(key, value);
    SecureStore.setItemAsync(key, value).catch(() => {});
    for (const l of listeners) l();
  },
  // Time:  O(n) listener count; Space: O(1) auxiliary.
  // Note:  Cache delete is O(1); subscribers are the only variable cost.
  delete(key: string): void {
    cache.delete(key);
    SecureStore.deleteItemAsync(key).catch(() => {});
    for (const l of listeners) l();
  },
  // Time:  O(k + n) cached keys plus listeners; Space: O(1) auxiliary.
  // Note:  Full reset intentionally clears only locally cached preference keys.
  clearAll(): void {
    for (const k of cache.keys()) {
      SecureStore.deleteItemAsync(k).catch(() => {});
    }
    cache.clear();
    for (const l of listeners) l();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
