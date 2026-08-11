import { useSyncExternalStore } from "react";

import { storage } from "~/lib/storage";

export type Currency = "USD" | "TRY" | "EUR" | "GBP";
export type SelectedPropertyId = string | "all";
/** "system" iOS gorunum ayarini takip eder; digerleri elle kilitler. */
export type ThemeMode = "system" | "dark" | "light";

const THEME_MODES: readonly ThemeMode[] = ["system", "dark", "light"];

export type Preferences = {
  selectedPropertyId: SelectedPropertyId;
  currency: Currency;
  revenueMultiplier: number;
  prioritizeRevenueRequests: boolean;
  themeMode: ThemeMode;
};

const KEYS = {
  selectedPropertyId: "pref.selectedPropertyId",
  currency: "pref.currency",
  revenueMultiplier: "pref.revenueMultiplier",
  prioritizeRevenueRequests: "pref.prioritizeRevenueRequests",
  themeMode: "pref.themeMode",
} as const;

const DEFAULTS: Preferences = {
  selectedPropertyId: "all",
  currency: "TRY",
  revenueMultiplier: 1,
  prioritizeRevenueRequests: true,
  themeMode: "system",
};

const MIN_REVENUE_MULTIPLIER = 1;
const MAX_REVENUE_MULTIPLIER = 100;

export function normalizeRevenueMultiplier(value: number): number {
  if (!Number.isFinite(value)) return DEFAULTS.revenueMultiplier;
  const clamped = Math.min(MAX_REVENUE_MULTIPLIER, Math.max(MIN_REVENUE_MULTIPLIER, value));
  return Math.round(clamped * 100) / 100;
}

function readThemeMode(): ThemeMode {
  const raw = storage.getString(KEYS.themeMode);
  // Bilinmeyen deger (eski surum / bozuk yazim) sessizce varsayilana duser.
  return THEME_MODES.includes(raw as ThemeMode) ? (raw as ThemeMode) : DEFAULTS.themeMode;
}

function readCurrent(): Preferences {
  const prioritizeRevenueRequests = storage.getString(KEYS.prioritizeRevenueRequests);

  return {
    themeMode: readThemeMode(),
    selectedPropertyId:
      storage.getString(KEYS.selectedPropertyId) ?? DEFAULTS.selectedPropertyId,
    currency:
      (storage.getString(KEYS.currency) as Currency | undefined) ??
      DEFAULTS.currency,
    revenueMultiplier: normalizeRevenueMultiplier(
      Number(storage.getString(KEYS.revenueMultiplier) ?? DEFAULTS.revenueMultiplier),
    ),
    prioritizeRevenueRequests:
      prioritizeRevenueRequests == null
        ? DEFAULTS.prioritizeRevenueRequests
        : prioritizeRevenueRequests === "true",
  };
}

// Module-level snapshot + subscribers — useSyncExternalStore için identity-stable snapshot.
let snapshot: Preferences = readCurrent();
const listeners = new Set<() => void>();

// Time:  O(n) listener count; Space: O(1) auxiliary.
// Note:  Synchronous fan-out keeps preference reads identity-stable for React.
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
  setThemeMode(mode: ThemeMode) {
    storage.set(KEYS.themeMode, mode);
  },
  setRevenueMultiplier(multiplier: number) {
    storage.set(
      KEYS.revenueMultiplier,
      String(normalizeRevenueMultiplier(multiplier)),
    );
  },
  setPrioritizeRevenueRequests(enabled: boolean) {
    storage.set(KEYS.prioritizeRevenueRequests, String(enabled));
  },
  reset() {
    storage.clearAll();
  },
};

export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
