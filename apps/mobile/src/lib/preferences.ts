import { useSyncExternalStore } from "react";

import { ACCENTS, DEFAULT_ACCENT, type AccentId } from "@helm/design";

import { storage, PREF_KEYS } from "~/lib/storage";

export type Currency = "USD" | "TRY" | "EUR" | "GBP";
export type SelectedPropertyId = string | "all";
/** "system" iOS gorunum ayarini takip eder; digerleri elle kilitler. */
export type ThemeMode = "system" | "dark" | "light";
/** Accent ailesi kimligi - packages/design/src/accents.ts ile ayni kume. */
export type Accent = AccentId;
/**
 * Arayuz dili. Kaynak dil TR; EN bir ceviri tablosu (bkz. src/lib/i18n.ts).
 *
 * CIHAZ DILI OKUNMUYOR: expo-localization native bir modul, eklemek yeni bir
 * build gerektirir. Tek kullanicili bir uygulamada varsayilani TR birakip
 * gecisi elle sunmak ayni sonucu bedava veriyor.
 */
export type Language = "tr" | "en";

const THEME_MODES: readonly ThemeMode[] = ["system", "dark", "light"];
const LANGUAGES: readonly Language[] = ["tr", "en"];

export type Preferences = {
  selectedPropertyId: SelectedPropertyId;
  currency: Currency;
  revenueMultiplier: number;
  prioritizeRevenueRequests: boolean;
  themeMode: ThemeMode;
  accent: Accent;
  language: Language;
};

const KEYS = PREF_KEYS;

const DEFAULTS: Preferences = {
  selectedPropertyId: "all",
  currency: "TRY",
  revenueMultiplier: 1,
  prioritizeRevenueRequests: true,
  themeMode: "system",
  accent: DEFAULT_ACCENT,
  language: "tr",
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

function readAccent(): Accent {
  const raw = storage.getString(KEYS.accent);
  // Bilinmeyen deger (eski surum / kaldirilmis aile) sessizce varsayilana duser.
  return ACCENTS.some((a) => a.id === raw) ? (raw as Accent) : DEFAULTS.accent;
}

function readLanguage(): Language {
  const raw = storage.getString(KEYS.language);
  return LANGUAGES.includes(raw as Language) ? (raw as Language) : DEFAULTS.language;
}

function readCurrent(): Preferences {
  const prioritizeRevenueRequests = storage.getString(KEYS.prioritizeRevenueRequests);

  return {
    themeMode: readThemeMode(),
    accent: readAccent(),
    language: readLanguage(),
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

// Module-level snapshot + subscribers - useSyncExternalStore için identity-stable snapshot.
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
  setAccent(accent: Accent) {
    storage.set(KEYS.accent, accent);
  },
  setLanguage(language: Language) {
    storage.set(KEYS.language, language);
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
