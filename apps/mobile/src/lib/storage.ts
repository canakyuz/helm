import * as SecureStore from "expo-secure-store";

// expo-secure-store async - sync API simülasyonu için in-memory cache + lazy hydration.
// Preferences (currency, selectedPropertyId) hassas değil ama bu paket zaten kurulu, ek pod yok.

const cache = new Map<string, string>();
const listeners = new Set<() => void>();
let hydrated = false;

/**
 * Acilista SecureStore'dan geri okunacak anahtarlar - TEK KAYNAK.
 *
 * NEDEN BURADA: bu liste eskiden yalnizca dort anahtar iceriyordu; sonradan
 * eklenen `pref.themeMode`, `pref.accent` ve `pref.language` buraya yazilmadi.
 * Sonuc: uc tercih de SecureStore'a DOGRU yaziliyor ama acilista cache'e hic
 * alinmiyor, `getString` undefined donuyor ve varsayilana dusuyor. Kullanici
 * dilini Ingilizce yapiyor, uygulamayi kapatip aciyor, Turkce geri geliyordu.
 *
 * SecureStore "tum anahtarlari listele" sunmadigi icin liste kacinilmaz; ama
 * `preferences.ts` KEYS haritasini buradan turetiyor, yani yeni bir tercih
 * eklendiginde liste kendiliginden buyur. Elle senkron tutulacak iki yer yok.
 */
export const PREF_KEYS = {
  selectedPropertyId: "pref.selectedPropertyId",
  currency: "pref.currency",
  revenueMultiplier: "pref.revenueMultiplier",
  prioritizeRevenueRequests: "pref.prioritizeRevenueRequests",
  themeMode: "pref.themeMode",
  accent: "pref.accent",
  language: "pref.language",
} as const;

// Time:  O(n) preference key count; Space: O(n) for cache entries.
// Note:  Hydrates only known preference keys to avoid broad SecureStore scans.
async function hydrate() {
  if (hydrated) return;
  await Promise.all(
    Object.values(PREF_KEYS).map(async (k) => {
      try {
        const v = await SecureStore.getItemAsync(k);
        if (v !== null) cache.set(k, v);
      } catch {
        // ignore - default values used
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
