import * as SecureStore from "expo-secure-store";

// expo-secure-store async — sync API simülasyonu için in-memory cache + lazy hydration.
// Preferences (currency, selectedPropertyId) hassas değil ama bu paket zaten kurulu, ek pod yok.

const cache = new Map<string, string>();
const listeners = new Set<() => void>();
let hydrated = false;

const PREF_KEYS = ["pref.selectedPropertyId", "pref.currency"] as const;

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
  set(key: string, value: string): void {
    cache.set(key, value);
    SecureStore.setItemAsync(key, value).catch(() => {});
    for (const l of listeners) l();
  },
  delete(key: string): void {
    cache.delete(key);
    SecureStore.deleteItemAsync(key).catch(() => {});
    for (const l of listeners) l();
  },
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
