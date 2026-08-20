import type { RevenueBucket } from "@helm/api";

export type HeroPoint = { date: string; value: number };

/**
 * Overview hero'sunun gunluk gelir serisi.
 *
 * NEDEN BUCKET'TAN OKUNUYOR - onceki hal `ad_revenue` + `app_revenue`
 * METRIKLERINI topluyordu. app_revenue App Store Connect gunluk satis
 * raporundan gelir ve Apple bunu ~2 gun gecikmeli yayinlar. Olculen sonuc
 * (2026-08-20):
 *
 *   webhook odemeleri (revenue_events) : 96.91 USD / 9 olay   ← gercek para
 *   magaza raporu     (app_revenue)    :  0.00 USD            ← bu ay hic gelmedi
 *
 * Yani hero, magaza gelirini bu ay %100 eksik gosteriyordu; entegrasyon
 * saglikliydi (tum kaynaklar 12:00'de hatasiz senkron), sadece rapor gecikmesi
 * gorunmez bir eksige donusuyordu.
 *
 * revenue-history bucket'lari webhook'u (anlik) magaza raporuyla (kesin) zaten
 * mutabakatliyor - iOS widget'i bu yuzden dogru rakami gosteriyordu. Hero'yu
 * ayni kaynaga baglamak iki ekranin celismesini de bitiriyor.
 *
 * Ay bucket'lari ortusmez, bu yuzden duz Map yeterli.
 * Time: O(n log n) (siralama), Space: O(n).
 */
export function heroDays(
  buckets: readonly RevenueBucket[],
  limit: number,
): HeroPoint[] {
  const byDate = new Map<string, number>();
  for (const bucket of buckets) {
    for (const day of bucket.days ?? []) {
      byDate.set(day.date, (byDate.get(day.date) ?? 0) + day.value);
    }
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .slice(-limit)
    .map(([date, value]) => ({ date, value }));
}

/**
 * Takvimsel bir gunun tutari.
 *
 * Seride o gun yoksa 0 doner - "olcum yok" degil "henuz para girmedi" demek,
 * cunku seri gelir olaylarindan uretiliyor ve olaysiz gun gercekten sifirdir.
 */
export function amountOn(days: readonly HeroPoint[], date: string): number {
  return days.find((d) => d.date === date)?.value ?? 0;
}

/** YYYY-MM-DD, yerel gun. */
export function isoDay(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * Icinde bulundugumuz ayin toplam geliri.
 *
 * buckets[0]'i korukoru almak yanlis olurdu: bu ay hic veri yoksa liste bir
 * onceki ayla baslar ve hedef cubugu gecen ayin rakamiyla dolardi.
 */
export function currentMonthTotal(buckets: readonly RevenueBucket[]): number {
  const key = isoDay().slice(0, 7);
  return buckets.find((b) => b.key === key)?.total ?? 0;
}
