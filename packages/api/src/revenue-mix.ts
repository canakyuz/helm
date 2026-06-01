import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";

// Gelir mix'i — bu ay subscription_revenue + iap_revenue + ad_revenue toplamları.
// Renk UI concern → burada YOK; mobil/web hook'u metric'e göre renk ekler.
export type MixSegment = { metric: string; label: string; value: number; pct: number };
export type RevenueMix = { segments: MixSegment[]; total: number };

export const REVENUE_MIX_METRICS = [
  { metric: "subscription_revenue", label: "Subscriptions" },
  { metric: "iap_revenue", label: "In-app purchase" },
  { metric: "ad_revenue", label: "Ad revenue" },
] as const;

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function fetchRevenueMix(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
): Promise<RevenueMix> {
  const today = new Date().toISOString().slice(0, 10);
  let q = client
    .from("metrics")
    .select("metric, value")
    .in("metric", REVENUE_MIX_METRICS.map((m) => m.metric))
    .gte("date", monthStart())
    .lte("date", today);
  if (propertyId !== "all") q = q.eq("project_id", propertyId);

  const { data, error } = await q;
  if (error) throw error;

  const sums = new Map<string, number>();
  for (const r of (data ?? []) as Array<{ metric: string; value: number }>) {
    sums.set(r.metric, (sums.get(r.metric) ?? 0) + Number(r.value));
  }
  const raw = REVENUE_MIX_METRICS.map((m) => ({ ...m, value: sums.get(m.metric) ?? 0 }));
  const total = raw.reduce((a, b) => a + b.value, 0);
  const segments: MixSegment[] = raw.map((m) => ({
    metric: m.metric,
    label: m.label,
    value: m.value,
    pct: total > 0 ? Math.round((m.value / total) * 100) : 0,
  }));
  return { segments, total };
}
