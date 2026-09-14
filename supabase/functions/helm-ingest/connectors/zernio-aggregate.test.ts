import { describe, expect, it } from "bun:test";
import { aggregateDaily, toAccountRows } from "./zernio-aggregate";
import type { ZernioAccount, ZernioAnalyticsPost } from "../../_shared/zernio";

const accounts: ZernioAccount[] = [
  { _id: "acc1", platform: "instagram", username: "brand_main", followersCount: 120, isActive: true },
  { _id: "acc2", platform: "tiktok", username: "brand_studio", followersCount: null, isActive: true },
  { _id: "acc3", platform: "youtube", username: "old", followersCount: 9, isActive: false },
];

const posts: ZernioAnalyticsPost[] = [
  {
    _id: "p1",
    status: "published",
    publishedAt: "2026-09-10T22:06:41.000Z",
    analytics: { impressions: 100, reach: 80, likes: 5, comments: 1, shares: 2, saves: 2 },
    platformAnalytics: [
      { platform: "instagram", accountId: "acc1", analytics: { impressions: 60, reach: 50, likes: 3, comments: 1, shares: 1, saves: 1 } },
      { platform: "tiktok", accountId: "acc2", analytics: { impressions: 40, reach: 30, likes: 2, comments: 0, shares: 1, saves: 1 } },
    ],
  },
  {
    _id: "p2",
    status: "published",
    publishedAt: "2026-09-10T05:00:00.000Z",
    analytics: { impressions: 10, reach: 10, likes: 1, comments: 0, shares: 0, saves: 0 },
    platformAnalytics: [
      { platform: "instagram", accountId: "acc1", analytics: { impressions: 10, reach: 10, likes: 1, comments: 0, shares: 0, saves: 0 } },
    ],
  },
  { _id: "p3", status: "scheduled", publishedAt: null, analytics: { impressions: 999 } },
];

describe("aggregateDaily", () => {
  const { points, daily } = aggregateDaily(accounts, posts, "2026-09-14");
  const get = (date: string, metric: string) =>
    points.find((p) => p.date === date && p.metric === metric)?.value;

  it("post metriklerini yayin gunune toplar, yayinlanmamisi atlar", () => {
    expect(get("2026-09-10", "social_impressions")).toBe(110);
    expect(get("2026-09-10", "social_reach")).toBe(90);
    // (5+1+2+2) + (1+0+0+0)
    expect(get("2026-09-10", "social_engagements")).toBe(11);
    expect(get("2026-09-10", "social_posts_published")).toBe(2);
    expect(points.some((p) => p.value === 999)).toBe(false);
  });

  it("takipciyi bugune, yalnizca aktif ve sayisi olan hesaplardan yazar", () => {
    // acc2 null (eklenti yok), acc3 pasif -> sadece acc1
    expect(get("2026-09-14", "social_followers")).toBe(120);
  });

  it("hesap x gun kirilimini uretir ve bugunku takipciyi ekler", () => {
    const acc1Day = daily.find((d) => d.account_id === "acc1" && d.date === "2026-09-10");
    expect(acc1Day).toEqual({
      account_id: "acc1", date: "2026-09-10", followers: null,
      impressions: 70, reach: 60, engagements: 7,
    });
    const acc1Today = daily.find((d) => d.account_id === "acc1" && d.date === "2026-09-14");
    expect(acc1Today?.followers).toBe(120);
    expect(acc1Today?.impressions).toBe(0);
    // takipci sayisi olmayan hesap icin bugun satiri acilmaz
    expect(daily.some((d) => d.account_id === "acc2" && d.date === "2026-09-14")).toBe(false);
  });

  it("takipci sayisi hic yoksa social_followers yazilmaz", () => {
    const none = aggregateDaily([{ _id: "x", platform: "tiktok", followersCount: null, isActive: true }], [], "2026-09-14");
    expect(none.points.some((p) => p.metric === "social_followers")).toBe(false);
  });
});

describe("toAccountRows", () => {
  it("Zernio hesabini social_accounts satirina cevirir", () => {
    const rows = toAccountRows(accounts.slice(0, 1), "2026-09-14T00:00:00.000Z");
    expect(rows[0]).toEqual({
      id: "acc1", platform: "instagram", username: "brand_main", display_name: null,
      avatar_url: null, profile_url: null, followers_count: 120,
      is_active: true, needs_reconnection: false, synced_at: "2026-09-14T00:00:00.000Z",
    });
  });
});
