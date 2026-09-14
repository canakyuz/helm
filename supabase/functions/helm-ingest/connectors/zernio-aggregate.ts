// Zernio ham verisini metrics + social_* satirlarina ceviren SAF katman.
// Deno API'si yok: bun test ile kosar.
//
// GUNLUK SERI KURALI: Zernio post analitigi kumulatiftir (bugun 100
// impression, yarin 130). Gunluk farki tutmak icin snapshot gecmisi gerekir,
// v1'de yok. Bu yuzden bir postun tum metrigi YAYIN GUNUNE yazilir; her gece
// ayni gunler yeniden hesaplanip upsert edilir, deger buyudukce gun buyur.
// Takipci ise anlik sayi: yalnizca bugune yazilir.
//
// Time: O(P * A)  P post, A post basina platform girdisi
// Space: O(D * H) D gun, H hesap

import type { MetricPoint } from "./types.ts";
import type { ZernioAccount, ZernioAnalyticsPost, ZernioPostAnalytics } from "../../_shared/zernio.ts";

export interface SocialAccountRow {
  id: string;
  platform: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  profile_url: string | null;
  followers_count: number | null;
  is_active: boolean;
  needs_reconnection: boolean;
  synced_at: string;
}

export interface SocialAccountDailyRow {
  account_id: string;
  date: string;
  followers: number | null;
  impressions: number;
  reach: number;
  engagements: number;
}

interface DayTotals {
  impressions: number;
  reach: number;
  engagements: number;
  posts: number;
}

const PUBLISHED = new Set(["published", "partial"]);

const num = (v: number | undefined | null) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

const engagementsOf = (a: ZernioPostAnalytics) =>
  num(a.likes) + num(a.comments) + num(a.shares) + num(a.saves);

const dayOf = (iso: string) => iso.slice(0, 10);

export function toAccountRows(accounts: ZernioAccount[], syncedAt: string): SocialAccountRow[] {
  return accounts.map((a) => ({
    id: a._id,
    platform: a.platform,
    username: a.username ?? null,
    display_name: a.displayName ?? null,
    avatar_url: a.profilePicture ?? null,
    profile_url: a.profileUrl ?? null,
    followers_count: typeof a.followersCount === "number" ? a.followersCount : null,
    is_active: a.isActive !== false,
    needs_reconnection: a.needsReconnection === true,
    synced_at: syncedAt,
  }));
}

function addDay(map: Map<string, DayTotals>, date: string, a: ZernioPostAnalytics): void {
  const cur = map.get(date) ?? { impressions: 0, reach: 0, engagements: 0, posts: 0 };
  cur.impressions += num(a.impressions);
  cur.reach += num(a.reach);
  cur.engagements += engagementsOf(a);
  cur.posts += 1;
  map.set(date, cur);
}

function addAccountDay(
  map: Map<string, SocialAccountDailyRow>,
  accountId: string,
  date: string,
  a: ZernioPostAnalytics | null | undefined,
  followers: number | null,
): void {
  const key = `${accountId}|${date}`;
  const cur = map.get(key) ?? { account_id: accountId, date, followers: null, impressions: 0, reach: 0, engagements: 0 };
  if (a) {
    cur.impressions += num(a.impressions);
    cur.reach += num(a.reach);
    cur.engagements += engagementsOf(a);
  }
  if (followers !== null) cur.followers = followers;
  map.set(key, cur);
}

export function aggregateDaily(
  accounts: ZernioAccount[],
  posts: ZernioAnalyticsPost[],
  today: string,
): { points: MetricPoint[]; daily: SocialAccountDailyRow[] } {
  const byDay = new Map<string, DayTotals>();
  const byAccountDay = new Map<string, SocialAccountDailyRow>();
  // social_account_daily.account_id -> social_accounts FK'si var; listAccounts
  // sadece SU ANKI hesaplari dondurur. Kaldirilmis/baglantisi kesilmis bir
  // hesabin son 90 gunluk postu hala platformAnalytics'te gorunebilir - o
  // hesap icin gunluk satir acmak upsert'i FK ihlaliyle patlatir. O(1) set
  // lookup ile atla; post.analytics uzerinden gun toplami etkilenmez.
  const known = new Set(accounts.map((a) => a._id));

  for (const post of posts) {
    if (!post.publishedAt || !PUBLISHED.has(post.status)) continue;
    const date = dayOf(post.publishedAt);
    // Toplamlar post.analytics'ten (platformlar arasi zaten toplanmis) -
    // platformAnalytics'i de toplarsak cift sayariz.
    addDay(byDay, date, post.analytics ?? {});
    for (const pa of post.platformAnalytics ?? []) {
      if (!pa.accountId || !known.has(pa.accountId)) continue;
      addAccountDay(byAccountDay, pa.accountId, date, pa.analytics, null);
    }
  }

  const points: MetricPoint[] = [];
  for (const [date, t] of byDay) {
    points.push(
      { date, metric: "social_impressions", value: t.impressions },
      { date, metric: "social_reach", value: t.reach },
      { date, metric: "social_engagements", value: t.engagements },
      { date, metric: "social_posts_published", value: t.posts },
    );
  }

  // Takipci: aktif + sayisi olan hesaplar. Hicbiri yoksa metrik yazma -
  // sifir yazmak "takipci yok" derdi, dogrusu "olcum yok".
  let followersTotal = 0;
  let measured = false;
  for (const a of accounts) {
    if (a.isActive === false || typeof a.followersCount !== "number") continue;
    measured = true;
    followersTotal += a.followersCount;
    addAccountDay(byAccountDay, a._id, today, null, a.followersCount);
  }
  if (measured) points.push({ date: today, metric: "social_followers", value: followersTotal });

  return { points, daily: Array.from(byAccountDay.values()) };
}
