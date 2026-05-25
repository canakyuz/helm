import { useSyncExternalStore } from "react";

import { storage } from "~/lib/storage";

export type Currency = "USD" | "TRY" | "EUR" | "GBP";
export type SelectedPropertyId = string | "all";

export type Preferences = {
  selectedPropertyId: SelectedPropertyId;
  currency: Currency;
};

const KEYS = {
  selectedPropertyId: "pref.selectedPropertyId",
  currency: "pref.currency",
} as const;

const DEFAULTS: Preferences = {
  selectedPropertyId: "all",
  currency: "TRY",
};

function readCurrent(): Preferences {
  return {
    selectedPropertyId:
      storage.getString(KEYS.selectedPropertyId) ?? DEFAULTS.selectedPropertyId,
    currency:
      (storage.getString(KEYS.currency) as Currency | undefined) ??
      DEFAULTS.currency,
  };
}

// Module-level snapshot + subscribers — useSyncExternalStore için identity-stable snapshot.
let snapshot: Preferences = readCurrent();
const listeners = new Set<() => void>();

function refresh() {
  snapshot = readCurrent();
  for (const l of listeners) l();
}

// Storage hydrate olduğunda otomatik refresh.
storage.subscribe(refresh);

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Preferences {
  return snapshot;
}

export const preferences = {
  get: getSnapshot,
  setSelectedProperty(id: SelectedPropertyId) {
    storage.set(KEYS.selectedPropertyId, id);
  },
  setCurrency(currency: Currency) {
    storage.set(KEYS.currency, currency);
  },
  reset() {
    storage.clearAll();
  },
};

export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
