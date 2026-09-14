import { istanbulEveningSlot } from "@helm/api";

/** Planlamaya izin verilen en erken an: simdiden bu kadar sonra. */
export const MIN_LEAD_MS = 5 * 60_000;

/**
 * `base` gununden `dayOffset` gun sonra, Istanbul saatiyle 20:00 (cihaz saat
 * dilimini yok sayar - bkz. `istanbulEveningSlot`). Saf; girdiyi degistirmez.
 */
export function eveningOf(base: Date, dayOffset: 0 | 1): Date {
  return istanbulEveningSlot(base, dayOffset);
}

export type QuickSlot = { key: "today" | "tomorrow"; label: string; at: Date };

/**
 * "Bugun 20:00" ve "Yarin 20:00" (Istanbul saati). Bugunku saat en erken
 * sinirin gerisindeyse gizlenir - basilamayan bir secenek gostermek hatayi
 * kullaniciya birakir.
 * Time: O(1).
 */
export function quickSlots(now: Date): QuickSlot[] {
  const earliest = now.getTime() + MIN_LEAD_MS;
  const today = eveningOf(now, 0);
  const tomorrow: QuickSlot = { key: "tomorrow", label: "Yarın 20:00", at: eveningOf(now, 1) };
  return today.getTime() >= earliest
    ? [{ key: "today", label: "Bugün 20:00", at: today }, tomorrow]
    : [tomorrow];
}
