import { describe, expect, it } from "bun:test";

import { amountOn, currentMonthTotal, heroDays, isoDay } from "../revenue-hero";

/**
 * Fixture 2026-08-20'de canli veritabanindan olculdu:
 *   revenue_events (webhook)     : 96.91 USD / 9 olay - GERCEK para
 *   metrics.app_revenue (magaza) :  0.00 USD          - Apple raporu gecikmeli
 * Hero eskiden ikinciyi okudugu icin ayin tamamini sifir gosteriyordu.
 */
const AUGUST = {
  key: "2026-08",
  start: "2026-08-01",
  end: "2026-08-31",
  total: 96.91,
  bySource: {},
  days: [
    { date: "2026-08-11", value: 4.99 },
    { date: "2026-08-16", value: 19.99 },
    { date: "2026-08-17", value: 0.99 },
    { date: "2026-08-18", value: 9.99 },
    { date: "2026-08-19", value: 49.97 },
    { date: "2026-08-20", value: 9.99 },
  ],
  legs: [],
  mrr: 58.99,
  activeSubs: 6,
  payments: [],
  provisionalSources: ["subscription_revenue"],
} as any;

const JULY = {
  ...AUGUST,
  key: "2026-07",
  start: "2026-07-01",
  end: "2026-07-31",
  total: 12.5,
  days: [{ date: "2026-07-30", value: 12.5 }],
} as any;

describe("heroDays", () => {
  it("ay sinirini asarak birlesik gunluk seri uretir", () => {
    const days = heroDays([AUGUST, JULY], 10);
    expect(days[0]).toEqual({ date: "2026-07-30", value: 12.5 });
    expect(days.at(-1)).toEqual({ date: "2026-08-20", value: 9.99 });
  });

  it("tarihe gore artan siralar - bucket'lar yeniden eskiye gelse bile", () => {
    const dates = heroDays([AUGUST, JULY], 10).map((d) => d.date);
    expect(dates).toEqual([...dates].sort());
  });

  it("limit kadar EN YENI gunu tutar", () => {
    const days = heroDays([AUGUST, JULY], 2);
    expect(days.map((d) => d.date)).toEqual(["2026-08-19", "2026-08-20"]);
  });

  it("bos girdide patlamaz", () => {
    expect(heroDays([], 10)).toEqual([]);
  });
});

describe("amountOn", () => {
  const days = heroDays([AUGUST], 10);

  it("REGRESYON: magaza raporu gelmeden bugunun webhook parasini gosterir", () => {
    // Eski hal app_revenue okuyordu; 2026-08-20 icin satir YOKTU → 0.00 yazardi.
    expect(amountOn(days, "2026-08-20")).toBe(9.99);
  });

  it("dunku toplami dogru verir", () => {
    expect(amountOn(days, "2026-08-19")).toBeCloseTo(49.97, 2);
  });

  it("olaysiz gun sifirdir", () => {
    expect(amountOn(days, "2026-08-12")).toBe(0);
  });
});

describe("currentMonthTotal", () => {
  it("bu ay verisi yoksa gecen ayin toplamina DUSMEZ", () => {
    // buckets[0] korukorune alinsaydi hedef cubugu 12.50 ile dolardi.
    expect(currentMonthTotal([JULY])).toBe(0);
  });

  it("icinde bulunulan ayi anahtarla bulur", () => {
    const key = isoDay().slice(0, 7);
    expect(currentMonthTotal([{ ...JULY, key, total: 42 } as any])).toBe(42);
  });
});
