/** Planlamaya izin verilen en erken an: simdiden bu kadar sonra. */
export const MIN_LEAD_MS = 5 * 60_000;

/** Yayin saati. Sunucunun toplu planlama saatiyle ayni (her gun 20:00). */
const EVENING_HOUR = 20;

/** `base` gununden `dayOffset` gun sonra, yerel 20:00. Saf; girdiyi degistirmez. */
export function eveningOf(base: Date, dayOffset: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, EVENING_HOUR, 0, 0, 0);
  return d;
}

export type QuickSlot = { key: "today" | "tomorrow"; label: string; at: Date };

/**
 * "Bugun 20:00" ve "Yarin 20:00". Bugunku saat en erken sinirin gerisindeyse
 * gizlenir - basilamayan bir secenek gostermek hatayi kullaniciya birakir.
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
