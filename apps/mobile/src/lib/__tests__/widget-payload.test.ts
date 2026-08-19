import { expect, test } from "bun:test";
import { monthFromBucket, buildWidgetPayload, normalizeBars } from "../widget-payload";

/**
 * Widget "Total Revenue" regresyonu.
 *
 * BUG: widget `adRevenue + mrr` topluyordu — BIR GUNUN reklam geliri artI
 * AYLIK tekrarli gelir ORANI. Farkli birimler. Widget £45.12 gosterirken
 * uygulama ayni an £95.57 diyordu ve uygulama-ici gelir bacagi hic yoktu.
 *
 * Asagidaki rakamlar o andaki gercek ekran goruntusunden.
 */
const bucket = {
  total: 95.57,
  bySource: { ad_revenue: 31.35, subscription_revenue: 33.22, iap_revenue: 31.00 },
  days: [
    { date: "2026-08-13", value: 2.1 },
    { date: "2026-08-14", value: 3.4 },
    { date: "2026-08-15", value: 1.2 },
    { date: "2026-08-16", value: 8.0 },
    { date: "2026-08-17", value: 9.5 },
    { date: "2026-08-18", value: 12.0 },
    { date: "2026-08-19", value: 45.1 },
  ],
};

test("ay kovasi dogru bacaklara ayrilir", () => {
  const m = monthFromBucket(bucket)!;
  expect(m.total).toBe(95.57);
  expect(m.adRevenue).toBe(31.35);
  expect(m.payments).toBeCloseTo(64.22, 2); // abonelik + uygulama ici
});

test("toplam = uc bacagin toplami (MRR YOK)", () => {
  const m = monthFromBucket(bucket)!;
  expect(m.adRevenue + m.payments).toBeCloseTo(m.total, 2);
});

test("widget metni uygulamayla ayni sayiyi gosterir", () => {
  const p = buildWidgetPayload(
    { dau: 385, mrrDelta: -14.5, openAlerts: 0 },
    monthFromBucket(bucket),
    "GBP",
    1,
  );
  expect(p.totalRevenueText).toBe("£95.57");
  expect(p.adRevenueText).toBe("£31.35");
  expect(p.incomingPaymentsText).toBe("£64.22");
});

test("ESKI mantik yanlisti: gunluk reklam + aylik MRR", () => {
  const gunlukReklam = 1.53, mrr = 43.58;
  expect(gunlukReklam + mrr).toBeCloseTo(45.11, 2); // widget'ta gorulen £45.12
  expect(gunlukReklam + mrr).not.toBeCloseTo(bucket.total, 1);
});

test("olcum yoksa '—', sifir degil", () => {
  const p = buildWidgetPayload({ dau: null, mrrDelta: null, openAlerts: 0 }, null, "GBP", 1);
  expect(p.totalRevenueText).toBe("—");
  expect(p.sparkline).toBeUndefined();
});

test("cubuklar 7'ye tamamlanir ve 0.08-1 arasinda kalir", () => {
  const bars = normalizeBars([0, 5, 10]);
  expect(bars.length).toBe(7);
  expect(Math.max(...bars)).toBe(1);
  expect(Math.min(...bars)).toBeGreaterThanOrEqual(0.08);
});
