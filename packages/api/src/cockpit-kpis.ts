import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";
import { fetchFxRates, metricValueUsd, type FxRates } from "./fx-rates";

/**
 * Kokpitin ust satiri.
 *
 * OLCUM METRIKLERI NULLABLE: `null` = olcum yok (o kaynak bu projeye bagli
 * degil), `0` = olculdu ve sifir. Ikisini 0'a katlamak, kullanici olcumu
 * olmayan bir projede "DAU 0" yazdirir ve bu "kimse oynamiyor" diye okunur -
 * dogru cevap "bilmiyoruz". Sayaclar (openAlerts, syncIngested) nullable
 * DEGIL: onlar her zaman sayilabilir, yoklugu gercekten sifirdir.
 */
export type CockpitKpis = {
  mrr: number | null;
  mrrDelta: number | null;
  dau: number | null;
  dauDelta: number | null;
  totalUsers: number | null;
  adRevenue: number | null;
  activeSubs: number | null;
  newUsers: number | null;
  openAlerts: number;
  criticalAlerts: number;
  lastSyncAt: string | null;
  lastSyncStatus: "ok" | "error" | "running" | "unknown";
  syncRunning: boolean;
  syncIngested: number;
};

export type SparkPoint = { date: string; value: number };

type MetricRow = {
  date: string;
  metric: string;
  value: number;
  currency: string | null;
};
type SyncRow = {
  started_at: string;
  finished_at: string | null;
  ok_count: number;
  error_count: number;
  ingested: number;
};

// Para metrikleri kaynak currency'sinden USD'ye normalize edilerek toplanır
// (mrr USD → no-op; ad_revenue TRY → USD). Sayısal metrikler ham toplanır.
function sumByDate(
  rows: MetricRow[],
  metric: string,
  rates: FxRates,
): Map<string, number> {
  const acc = new Map<string, number>();
  for (const r of rows) {
    if (r.metric !== metric) continue;
    const v = metricValueUsd(metric, Number(r.value), r.currency, rates);
    acc.set(r.date, (acc.get(r.date) ?? 0) + v);
  }
  return acc;
}

/**
 * Serideki son iki olcum.
 *
 * `null` = OLCUM YOK, `0` = olculdu ve sifir. Onceki hal ikisini de 0'a
 * ceviriyordu: kullanici olcumu hic baglanmamis bir projede "DAU 0" yaziyordu
 * ve bu "kimse oynamiyor" diye okunuyordu - oysa dogru cevap "bilmiyoruz".
 * Ayni ayrimi gelir tarafinda da yaptik (bkz. revenue-history provisionalSources).
 */
function latestTwo(map: Map<string, number>): [number | null, number | null] {
  const sorted = [...map.entries()].sort(([a], [b]) => (a < b ? 1 : -1));
  return [sorted[0]?.[1] ?? null, sorted[1]?.[1] ?? null];
}

function deltaPercent(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export async function fetchCockpitKpis(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
): Promise<CockpitKpis> {
  const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  let metricsQuery = client
    .from("metrics")
    .select("date, metric, value, currency")
    .gte("date", sinceIso)
    .in("metric", ["mrr", "dau", "total_users", "ad_revenue", "active_subs", "new_users"])
    .order("date", { ascending: false });

  let alertsCountQuery = client
    .from("alert_events")
    .select("id, metric, alert_rules!inner(condition)", { count: "exact" })
    .eq("delivered", false)
    .limit(1000);

  const syncQuery = client
    .from("sync_runs")
    .select("started_at, finished_at, ok_count, error_count, ingested")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (propertyId !== "all") {
    metricsQuery = metricsQuery.eq("project_id", propertyId);
    alertsCountQuery = alertsCountQuery.eq("alert_rules.project_id", propertyId);
    // sync_runs property bazlı değil - global kalır.
  }

  const [metricsRes, alertsRes, syncRes, rates] = await Promise.all([
    metricsQuery,
    alertsCountQuery,
    syncQuery,
    fetchFxRates(),
  ]);

  if (metricsRes.error) throw metricsRes.error;
  if (alertsRes.error) throw alertsRes.error;
  if (syncRes.error) throw syncRes.error;

  const rows = (metricsRes.data ?? []) as MetricRow[];
  const [mrr, prevMrr] = latestTwo(sumByDate(rows, "mrr", rates));
  const [dau, prevDau] = latestTwo(sumByDate(rows, "dau", rates));
  const [totalUsers] = latestTwo(sumByDate(rows, "total_users", rates));
  const [adRevenue] = latestTwo(sumByDate(rows, "ad_revenue", rates));
  const [activeSubs] = latestTwo(sumByDate(rows, "active_subs", rates));
  const [newUsers] = latestTwo(sumByDate(rows, "new_users", rates));

  const alertsData =
    (alertsRes.data as unknown as Array<{
      metric: string;
      alert_rules: { condition: string } | null;
    }> | null) ?? [];
  const critical = alertsData.filter((a) => {
    const isRevenue = ["mrr", "ad_revenue", "active_subs"].includes(a.metric);
    return isRevenue && a.alert_rules?.condition === "drop_pct";
  }).length;

  const sync = syncRes.data as SyncRow | null;
  const syncRunning = sync !== null && sync.finished_at === null;
  let syncStatus: CockpitKpis["lastSyncStatus"] = "unknown";
  if (sync) {
    if (syncRunning) syncStatus = "running";
    else if (sync.error_count > 0) syncStatus = "error";
    else syncStatus = "ok";
  }

  return {
    mrr,
    mrrDelta: deltaPercent(mrr, prevMrr),
    dau,
    dauDelta: deltaPercent(dau, prevDau),
    totalUsers,
    adRevenue,
    activeSubs,
    newUsers,
    openAlerts: alertsRes.count ?? 0,
    criticalAlerts: critical,
    lastSyncAt: sync?.finished_at ?? sync?.started_at ?? null,
    lastSyncStatus: syncStatus,
    syncRunning,
    syncIngested: sync?.ingested ?? 0,
  };
}

export async function fetchMrrSpark(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
): Promise<SparkPoint[]> {
  const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  let q = client
    .from("metrics")
    .select("date, value, currency")
    .eq("metric", "mrr")
    .gte("date", sinceIso)
    .order("date", { ascending: true });
  if (propertyId !== "all") q = q.eq("project_id", propertyId);

  const [{ data, error }, rates] = await Promise.all([q, fetchFxRates()]);
  if (error) throw error;

  const acc = new Map<string, number>();
  for (const row of (data ?? []) as Array<{
    date: string;
    value: number;
    currency: string | null;
  }>) {
    const v = metricValueUsd("mrr", Number(row.value), row.currency, rates);
    acc.set(row.date, (acc.get(row.date) ?? 0) + v);
  }
  return [...acc.entries()].map(([date, value]) => ({ date, value }));
}

function normalizeSparkline(values: number[]): number[] {
  const max = Math.max(...values, 1);
  return values.map((v) => Math.max(0.08, v / max));
}

export async function fetchTotalRevenueSpark(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
): Promise<number[]> {
  const sinceIso = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  let q = client
    .from("metrics")
    .select("date, metric, value, currency")
    .in("metric", ["mrr", "ad_revenue"])
    .gte("date", sinceIso)
    .order("date", { ascending: true });
  if (propertyId !== "all") q = q.eq("project_id", propertyId);

  const [{ data, error }, rates] = await Promise.all([q, fetchFxRates()]);
  if (error) throw error;

  // mrr (USD) + ad_revenue (AdMob kaynak ccy) karışık → her satırı USD'ye
  // normalize edip öyle topla (yoksa TRY + USD anlamsız toplanır).
  const byDate = new Map<string, number>();
  for (const row of (data ?? []) as MetricRow[]) {
    if (row.metric !== "mrr" && row.metric !== "ad_revenue") continue;
    const v = metricValueUsd(row.metric, Number(row.value), row.currency, rates);
    byDate.set(row.date, (byDate.get(row.date) ?? 0) + v);
  }

  const sorted = [...byDate.entries()].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const last7 = sorted.slice(-7).map(([, v]) => v);
  while (last7.length < 7) last7.unshift(0);
  return normalizeSparkline(last7);
}
