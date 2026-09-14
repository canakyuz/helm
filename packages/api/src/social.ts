import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";

// Sosyal (Zernio) okuma katmani. Toplamlar metrics'ten (source=zernio),
// hesaplar social_accounts'tan, kirilim social_account_daily'den.
// Yazma islemleri helm-social edge function'ina gider (invokeSocial).

export interface SocialAccount {
  id: string;
  project_id: string;
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

export interface SocialAccountDaily {
  account_id: string;
  date: string;
  followers: number | null;
  impressions: number;
  reach: number;
  engagements: number;
}

export interface SocialMetricRow {
  date: string;
  metric: string;
  value: number;
}

export interface SocialKpis {
  followers: number | null;
  /** Pencere basindaki ilk olcume gore yuzde. */
  followersDelta: number | null;
  impressions: number;
  impressionsDelta: number | null;
  reach: number;
  reachDelta: number | null;
  engagements: number;
  engagementsDelta: number | null;
  postsPublished: number;
}

export const SOCIAL_METRICS = [
  "social_followers",
  "social_impressions",
  "social_reach",
  "social_engagements",
  "social_posts_published",
] as const;

const ACCOUNT_COLUMNS =
  "id, project_id, platform, username, display_name, avatar_url, profile_url, followers_count, is_active, needs_reconnection, synced_at";

export async function fetchSocialAccounts(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
): Promise<SocialAccount[]> {
  let q = client.from("social_accounts").select(ACCOUNT_COLUMNS).order("platform");
  if (propertyId !== "all") q = q.eq("project_id", propertyId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SocialAccount[];
}

const isoDaysAgo = (n: number, today: string) =>
  new Date(new Date(`${today}T00:00:00Z`).getTime() - n * 86_400_000).toISOString().slice(0, 10);

/** Iki pencere (cari + onceki) icin satirlari ceker: 2*days gun. */
export async function fetchSocialMetricRows(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
  days: number,
): Promise<SocialMetricRow[]> {
  const today = new Date().toISOString().slice(0, 10);
  let q = client
    .from("metrics")
    .select("date, metric, value")
    .eq("source", "zernio")
    .in("metric", [...SOCIAL_METRICS])
    .gte("date", isoDaysAgo(2 * days - 1, today))
    .order("date");
  if (propertyId !== "all") q = q.eq("project_id", propertyId);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as Array<{ date: string; metric: string; value: string | number }>).map(
    (r) => ({ date: r.date, metric: r.metric, value: Number(r.value) }),
  );
}

const pct = (cur: number, prev: number): number | null =>
  prev > 0 ? ((cur - prev) / prev) * 100 : null;

/**
 * Cari pencere: today-days+1..today. Onceki: bir oncekli ayni uzunluk.
 * Sayaclar toplanir; takipci penceredeki SON olcumdur, deltasi penceredeki
 * ILK olcume gore (anlik metrik toplanmaz).
 * Time: O(n), Space: O(1) sabit sayida toplam.
 */
export function summarizeSocialKpis(
  rows: SocialMetricRow[],
  days: number,
  today: string,
): SocialKpis {
  const curStart = isoDaysAgo(days - 1, today);
  const prevStart = isoDaysAgo(2 * days - 1, today);
  const sum = { cur: { impressions: 0, reach: 0, engagements: 0, posts: 0 }, prev: { impressions: 0, reach: 0, engagements: 0 } };
  let firstFollowers: { date: string; value: number } | null = null;
  let lastFollowers: { date: string; value: number } | null = null;

  for (const r of rows) {
    const inCur = r.date >= curStart && r.date <= today;
    const inPrev = r.date >= prevStart && r.date < curStart;
    if (r.metric === "social_followers") {
      if (!inCur) continue;
      if (!firstFollowers || r.date < firstFollowers.date) firstFollowers = r;
      if (!lastFollowers || r.date > lastFollowers.date) lastFollowers = r;
      continue;
    }
    const bucket = inCur ? sum.cur : inPrev ? sum.prev : null;
    if (!bucket) continue;
    if (r.metric === "social_impressions") bucket.impressions += r.value;
    else if (r.metric === "social_reach") bucket.reach += r.value;
    else if (r.metric === "social_engagements") bucket.engagements += r.value;
    else if (r.metric === "social_posts_published" && inCur) sum.cur.posts += r.value;
  }

  return {
    followers: lastFollowers?.value ?? null,
    followersDelta:
      lastFollowers && firstFollowers && firstFollowers.date !== lastFollowers.date
        ? pct(lastFollowers.value, firstFollowers.value)
        : null,
    impressions: sum.cur.impressions,
    impressionsDelta: pct(sum.cur.impressions, sum.prev.impressions),
    reach: sum.cur.reach,
    reachDelta: pct(sum.cur.reach, sum.prev.reach),
    engagements: sum.cur.engagements,
    engagementsDelta: pct(sum.cur.engagements, sum.prev.engagements),
    postsPublished: sum.cur.posts,
  };
}

export async function fetchSocialAccountDaily(
  client: SupabaseClient,
  accountIds: string[],
  days: number,
): Promise<SocialAccountDaily[]> {
  if (accountIds.length === 0) return [];
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await client
    .from("social_account_daily")
    .select("account_id, date, followers, impressions, reach, engagements")
    .in("account_id", accountIds)
    .gte("date", isoDaysAgo(days - 1, today))
    .order("date");
  if (error) throw error;
  return (data ?? []) as SocialAccountDaily[];
}

export type SocialAction = "accounts.sync" | "webhook.ensure";

export async function invokeSocial<T = { ok: boolean }>(
  client: SupabaseClient,
  body: { project_id: string; action: SocialAction; params?: Record<string, unknown> },
): Promise<T> {
  const { data, error } = await client.functions.invoke("helm-social", { body });
  if (error) throw error;
  const res = data as { ok?: boolean; error?: string };
  if (res?.ok !== true) throw new Error(res?.error ?? "helm-social basarisiz");
  return data as T;
}
