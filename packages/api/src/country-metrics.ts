import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";

/**
 * Ulke kirilimi - metrics_country tablosundan.
 *
 * NEDEN POSTHOG DEGIL: PostHog geo ucu bu projede bos donuyor. metrics_country
 * ise dolu (app_downloads: 1.077 satir, 71 ulke). Ekran yanlis kaynaga bakiyordu.
 *
 * VARSAYILAN METRIK app_downloads - cunku dolu olan o. `dau` kirilimi 15 satir ve
 * Mayis'ta donmus; onu "kullanici" diye gostermek yaniltici olurdu. Metrik disari
 * acik ki ekran neyi gosterdigini DOGRU etiketleyebilsin.
 */

export type CountryRow = { code: string; value: number };

export type CountryMetrics = {
  metric: string;
  days: number;
  rows: CountryRow[];
  total: number;
};

type Row = { country_code: string; value: number | string };

export async function fetchCountryMetrics(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
  metric = "app_downloads",
  days = 30,
): Promise<CountryMetrics> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  let q = client
    .from("metrics_country")
    .select("country_code, value")
    .eq("metric", metric)
    .gte("date", since);

  if (propertyId !== "all") q = q.eq("project_id", propertyId);

  const { data, error } = await q;
  if (error) throw error;

  // Ulke basina topla. Time: O(n), Space: O(u) - u = benzersiz ulke.
  const byCode = new Map<string, number>();
  for (const r of (data ?? []) as Row[]) {
    const v = Number(r.value) || 0;
    byCode.set(r.country_code, (byCode.get(r.country_code) ?? 0) + v);
  }

  const rows = [...byCode.entries()]
    .map(([code, value]) => ({ code, value }))
    .sort((a, b) => b.value - a.value);

  return { metric, days, rows, total: rows.reduce((a, r) => a + r.value, 0) };
}

/** ISO ulke kodu → bayrak emojisi. "US" → 🇺🇸 */
export function flagOf(code: string): string {
  if (code.length !== 2) return "";
  const base = 0x1f1e6 - 65;
  return String.fromCodePoint(base + code.toUpperCase().charCodeAt(0)) +
    String.fromCodePoint(base + code.toUpperCase().charCodeAt(1));
}
