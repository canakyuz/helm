import { describe, expect, it } from "bun:test";
import { summarizeSocialKpis, type SocialMetricRow } from "./social";

// 7 gunluk pencere: bugun 2026-09-14 -> cari 09-08..09-14, onceki 09-01..09-07.
const rows: SocialMetricRow[] = [
  { date: "2026-09-02", metric: "social_impressions", value: 50 },
  { date: "2026-09-09", metric: "social_impressions", value: 100 },
  { date: "2026-09-12", metric: "social_impressions", value: 20 },
  { date: "2026-09-09", metric: "social_engagements", value: 4 },
  { date: "2026-09-08", metric: "social_followers", value: 100 },
  { date: "2026-09-14", metric: "social_followers", value: 110 },
  { date: "2026-09-12", metric: "social_posts_published", value: 2 },
];

describe("summarizeSocialKpis", () => {
  const k = summarizeSocialKpis(rows, 7, "2026-09-14");

  it("sayaclari cari pencerede toplar ve onceki pencereye gore yuzde verir", () => {
    expect(k.impressions).toBe(120);
    expect(k.impressionsDelta).toBeCloseTo(140, 5); // (120-50)/50
    expect(k.engagements).toBe(4);
    expect(k.engagementsDelta).toBeNull(); // onceki 0 -> yuzde tanimsiz
    expect(k.postsPublished).toBe(2);
  });

  it("takipci son olcumdur, deltasi pencere basina gore", () => {
    expect(k.followers).toBe(110);
    expect(k.followersDelta).toBeCloseTo(10, 5); // (110-100)/100
  });

  it("veri yoksa null/0 doner", () => {
    const empty = summarizeSocialKpis([], 7, "2026-09-14");
    expect(empty.followers).toBeNull();
    expect(empty.impressions).toBe(0);
    expect(empty.impressionsDelta).toBeNull();
  });
});
