import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";

export type MetricDetail = {
  today: number;
  yesterday: number;
  thisMonth: number;
  lastMonth: number;
  series: Array<{ date: string; value: number }>;
};

type Row = { date: string; value: number };

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function firstOfMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function fetchMetricDetail(
  client: SupabaseClient,
  metric: string,
  propertyId: SelectedPropertyId,
): Promise<MetricDetail> {
  const now = new Date();
  const today = ymd(now);
  const yesterday = ymd(new Date(now.getTime() - 86_400_000));
  const thisMonthStart = firstOfMonth(now);

  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStart = firstOfMonth(lastMonthDate);
  const lastMonthEnd = ymd(new Date(now.getFullYear(), now.getMonth(), 0));

  // Sparkline için son 30 gün, ayrıca geçen ay başlangıcına kadar uzat.
  const sinceIso =
    lastMonthStart < ymd(new Date(now.getTime() - 30 * 86_400_000))
      ? lastMonthStart
      : ymd(new Date(now.getTime() - 30 * 86_400_000));

  let q = client
    .from("metrics")
    .select("date, value")
    .eq("metric", metric)
    .gte("date", sinceIso)
    .lte("date", today)
    .order("date", { ascending: true });

  if (propertyId !== "all") q = q.eq("project_id", propertyId);

  const { data, error } = await q;
  if (error) throw error;

  // Date başına topla (multi-property aggregation için).
  const byDate = new Map<string, number>();
  for (const row of (data ?? []) as Row[]) {
    byDate.set(row.date, (byDate.get(row.date) ?? 0) + Number(row.value));
  }

  const todayVal = byDate.get(today) ?? 0;
  const yesterdayVal = byDate.get(yesterday) ?? 0;
  let thisMonthVal = 0;
  let lastMonthVal = 0;

  for (const [date, value] of byDate) {
    if (date >= thisMonthStart && date <= today) thisMonthVal += value;
    if (date >= lastMonthStart && date <= lastMonthEnd) lastMonthVal += value;
  }

  const sparkSince = ymd(new Date(now.getTime() - 30 * 86_400_000));
  const series = [...byDate.entries()]
    .filter(([d]) => d >= sparkSince)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, value]) => ({ date, value }));

  return {
    today: todayVal,
    yesterday: yesterdayVal,
    thisMonth: thisMonthVal,
    lastMonth: lastMonthVal,
    series,
  };
}
