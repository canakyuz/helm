import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";
import { FX_FALLBACK, fetchFxRates, metricValueUsd } from "./fx-rates";

/**
 * Gelirin KANONIK tanimi.
 *
 * `app_revenue` BILEREK DISARIDA: olculdu, `subscription_revenue` ile birebir
 * ayni para (ayni toplam 92.49, ayni 8 sifir-disi gun). Iki isim altinda tek
 * kayit. Ikisini birden toplamak cift sayim olur; Overview `ad + app`, Kirilim
 * `ad + subs + iap` topluyordu — iki ekran iki farkli tanim. Tek tanim budur.
 */
export const REVENUE_SOURCES = [
  { metric: "ad_revenue", label: "Ad revenue" },
  { metric: "subscription_revenue", label: "Subscriptions" },
  { metric: "iap_revenue", label: "In-app purchase" },
] as const;

export type RevenueSource = (typeof REVENUE_SOURCES)[number]["metric"];

export type RevenueBucket = {
  /** "2026-08" (ay) veya "2026-W32" (hafta). */
  key: string;
  /** Kapsanan ilk ve son gun (ISO). */
  start: string;
  end: string;
  total: number;
  /** metric → tutar. Sifir olanlar da burada; gizleme karari UI'in. */
  bySource: Record<string, number>;
  /** Gunluk toplamlar — bar grafigi icin. */
  days: Array<{ date: string; value: number }>;
};

export type RevenueHistory = {
  /** Yeniden eskiye. Yalnizca VERISI OLAN donemler. */
  months: RevenueBucket[];
  weeks: RevenueBucket[];
  /** En az bir donemde sifirdan farkli olan kaynaklar. */
  activeSources: string[];
};

type Row = { date: string; metric: string; value: number; currency: string | null };

/** ISO haftasinin pazartesisi. Tarih string'i uzerinden, saat dilimi karismaz. */
function mondayOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  // getUTCDay: 0=pazar. Pazartesi bazli offset.
  const offset = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - offset);
  return dt.toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** "2026-08-11" → "2026-W32". Yil sinirinda pazartesi hangi yila dusuyorsa o. */
function weekKey(monday: string): string {
  const [y, m, d] = monday.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  const jan1 = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.floor((dt.getTime() - jan1.getTime()) / 604_800_000) + 1;
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * Gelir gecmisi — kaynak kirilimi ve gun/hafta/ay gruplari.
 *
 * TEK SORGU, bellekte gruplama. Gelir satirlari ~300 civari (olculdu); ay basina
 * ayri sorgu atmak N+1 olurdu ve donem gezinmesi her dokunusta ag turu isterdi.
 * Time: O(n log n) — n satir, siralama gruplama sonrasi anahtar sayisi kadar.
 * Space: O(n).
 *
 * `since` verilmezse son 12 ay. Veri Nisan 2026'da basliyor, bu tamamini kapsar.
 */
export async function fetchRevenueHistory(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
  since?: string,
): Promise<RevenueHistory> {
  const now = new Date();
  const from =
    since ??
    new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1))
      .toISOString()
      .slice(0, 10);

  let q = client
    .from("metrics")
    .select("date, metric, value, currency")
    .in("metric", REVENUE_SOURCES.map((s) => s.metric))
    .gte("date", from)
    .order("date", { ascending: true });

  if (propertyId !== "all") q = q.eq("project_id", propertyId);

  const [{ data, error }, rates] = await Promise.all([q, fetchFxRates()]);
  if (error) throw error;

  const rows = (data ?? []) as Row[];
  const fx = rates ?? FX_FALLBACK;

  // Gun + kaynak kirilimini tek gecliste kur.
  const byDay = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const usd = metricValueUsd(r.metric, Number(r.value), r.currency, fx);
    let day = byDay.get(r.date);
    if (day == null) {
      day = new Map();
      byDay.set(r.date, day);
    }
    day.set(r.metric, (day.get(r.metric) ?? 0) + usd);
  }

  const bucket = (keyOf: (iso: string) => string): RevenueBucket[] => {
    const acc = new Map<string, RevenueBucket>();
    for (const [date, sources] of byDay) {
      const key = keyOf(date);
      let b = acc.get(key);
      if (b == null) {
        b = { key, start: date, end: date, total: 0, bySource: {}, days: [] };
        acc.set(key, b);
      }
      let dayTotal = 0;
      for (const [metric, value] of sources) {
        b.bySource[metric] = (b.bySource[metric] ?? 0) + value;
        dayTotal += value;
      }
      b.total += dayTotal;
      b.days.push({ date, value: dayTotal });
      if (date < b.start) b.start = date;
      if (date > b.end) b.end = date;
    }
    for (const b of acc.values()) b.days.sort((x, y) => (x.date < y.date ? -1 : 1));
    // Yeniden eskiye — kullanici en cok guncel donemi acar.
    return [...acc.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
  };

  const months = bucket((iso) => iso.slice(0, 7));
  const weeks = bucket((iso) => weekKey(mondayOf(iso)));

  // Hicbir donemde sifirdan farkli olmayan kaynak "bagli ama uretmiyor"
  // demektir; UI onu gizler, ilk gercek degerde kendiliginden geri gelir.
  const active = new Set<string>();
  for (const day of byDay.values()) {
    for (const [metric, value] of day) if (value !== 0) active.add(metric);
  }

  return {
    months,
    weeks,
    activeSources: REVENUE_SOURCES.map((s) => s.metric).filter((m) => active.has(m)),
  };
}

/** Haftanin baslangic/bitis gunleri — UI etiketi icin. */
export function weekRange(bucket: RevenueBucket): { from: string; to: string } {
  const from = mondayOf(bucket.start);
  return { from, to: addDays(from, 6) };
}
