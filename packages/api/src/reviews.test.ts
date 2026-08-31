import { describe, expect, it } from "bun:test";
import { aggregateReviewStats, type ReviewStatsRow } from "./reviews";

// Bu ozet, PostgREST'in 1000 satir tavani yuzunden listeden hesaplanamiyor
// (bkz. migration 0047). Yanlis toplama sessizce yanlis ortalama uretir -
// bos ekran gibi fark edilmez. Regresyon korumasi burada.
describe("aggregateReviewStats", () => {
  it("uretim verisiyle ayni ortalamayi verir (3x1 + 1x2 + 1x3 + 10x5 = 3.8667)", () => {
    const rows: ReviewStatsRow[] = [
      { source: "appstore", rating: 1, cnt: 3 },
      { source: "appstore", rating: 2, cnt: 1 },
      { source: "appstore", rating: 3, cnt: 1 },
      { source: "appstore", rating: 5, cnt: 10 },
    ];
    const stats = aggregateReviewStats(rows);

    expect(stats.all.total).toBe(15);
    expect(stats.all.rated).toBe(15);
    expect(stats.all.average).toBeCloseTo(3.8667, 3);
    expect(stats.appstore.average).toBeCloseTo(3.8667, 3);
    expect(stats.playstore.total).toBe(0);
    expect(stats.playstore.average).toBe(0);
  });

  it("kaynaklari ayirir, 'all' ikisini toplar", () => {
    const stats = aggregateReviewStats([
      { source: "appstore", rating: 5, cnt: 2 },
      { source: "playstore", rating: 1, cnt: 2 },
    ]);

    expect(stats.appstore.average).toBe(5);
    expect(stats.playstore.average).toBe(1);
    expect(stats.all.average).toBe(3);
    expect(stats.all.total).toBe(4);
  });

  it("puansiz yorum toplama girer ama ortalamayi bozmaz", () => {
    const stats = aggregateReviewStats([
      { source: "appstore", rating: 4, cnt: 1 },
      { source: "appstore", rating: null, cnt: 9 },
    ]);

    expect(stats.all.total).toBe(10);
    expect(stats.all.rated).toBe(1);
    expect(stats.all.average).toBe(4);
    expect(stats.all.distribution[4]).toBe(1);
  });

  it("bos girdide sifir doner, NaN degil", () => {
    const stats = aggregateReviewStats([]);
    expect(stats.all.average).toBe(0);
    expect(stats.all.total).toBe(0);
    expect(Number.isNaN(stats.all.average)).toBe(false);
  });

  it("bilinmeyen kaynak appstore kovasina duser (RPC sozlesmesi disi satir)", () => {
    const stats = aggregateReviewStats([{ source: "web", rating: 5, cnt: 1 }]);
    expect(stats.appstore.total).toBe(1);
    expect(stats.all.total).toBe(1);
  });
});
