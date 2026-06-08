import type { SupabaseClient } from "@supabase/supabase-js";

export type PropertyType =
  | "website"
  | "web_app"
  | "mobile_app"
  | "desktop_app"
  | "game";

export type PropertyStatus = "healthy" | "stale" | "down" | "unknown";

export type Property = {
  id: string;
  name: string;
  slug: string;
  brandId: string;
  brandName: string | null;
  type: PropertyType;
  enabledModules: string[];
  status: PropertyStatus;
  lastPingAt: string | null;
  intervalMinutes: number | null;
  heartbeatName: string | null;
};

type PropertyRow = {
  id: string;
  name: string;
  slug: string;
  brand_id: string;
  type: PropertyType;
  enabled_modules: string[] | null;
  brands: { name: string } | null;
  heartbeats: Array<{
    name: string;
    interval_minutes: number;
    last_ping_at: string | null;
  }> | null;
};

// Heartbeat sağlık eşiği: diff<interval→healthy, <2×→stale, ≥2×→down, ping yok→unknown.
export function deriveStatus(
  lastPingAt: string | null,
  intervalMinutes: number | null,
): PropertyStatus {
  if (!lastPingAt || !intervalMinutes) return "unknown";
  const diffMin = (Date.now() - new Date(lastPingAt).getTime()) / 60_000;
  if (diffMin < intervalMinutes) return "healthy";
  if (diffMin < intervalMinutes * 2) return "stale";
  return "down";
}

// Heartbeat yoksa (çoğu indie projede yok) → metric aktivitesinden türet:
// son metric ≤2g → healthy (veri akıyor), ≤14g → stale, hiç yok → unknown.
// lastMetricDate: YYYY-MM-DD (metrics.date).
export function deriveActivityStatus(lastMetricDate: string | null): PropertyStatus {
  if (!lastMetricDate) return "unknown";
  const diffDays = (Date.now() - new Date(lastMetricDate).getTime()) / 86_400_000;
  if (diffDays <= 2) return "healthy";
  if (diffDays <= 14) return "stale";
  return "down";
}

export async function fetchProperties(client: SupabaseClient): Promise<Property[]> {
  const sinceIso = new Date(Date.now() - 14 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const [propsRes, activityRes] = await Promise.all([
    client
      .from("properties")
      .select(
        "id, name, slug, brand_id, type, enabled_modules, brands ( name ), heartbeats ( name, interval_minutes, last_ping_at )",
      )
      .order("name", { ascending: true }),
    // Heartbeat'siz projeler için aktivite fallback'i — son 14g metric tarihleri.
    client
      .from("metrics")
      .select("project_id, date")
      .gte("date", sinceIso)
      .order("date", { ascending: false }),
  ]);

  if (propsRes.error) throw propsRes.error;

  // project_id → en güncel metric tarihi (desc sıralı → ilk görülen latest).
  const lastActivity = new Map<string, string>();
  for (const r of (activityRes.data ?? []) as Array<{
    project_id: string;
    date: string;
  }>) {
    if (!lastActivity.has(r.project_id)) lastActivity.set(r.project_id, r.date);
  }

  return ((propsRes.data as unknown as PropertyRow[] | null) ?? []).map((row) => {
    // Bir property'nin birden çok heartbeat'i olabilir — en son ping'i seç.
    const beats = row.heartbeats ?? [];
    const latest = beats.reduce<(typeof beats)[number] | null>((acc, beat) => {
      if (!beat.last_ping_at) return acc;
      if (!acc || !acc.last_ping_at) return beat;
      return new Date(beat.last_ping_at) > new Date(acc.last_ping_at) ? beat : acc;
    }, null);

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      brandId: row.brand_id,
      brandName: row.brands?.name ?? null,
      type: row.type,
      enabledModules: row.enabled_modules ?? [],
      heartbeatName: latest?.name ?? null,
      lastPingAt: latest?.last_ping_at ?? null,
      intervalMinutes: latest?.interval_minutes ?? null,
      // Heartbeat varsa ondan; yoksa metric aktivitesinden türet (unknown kalmasın).
      status: (() => {
        const beat = deriveStatus(
          latest?.last_ping_at ?? null,
          latest?.interval_minutes ?? null,
        );
        return beat === "unknown"
          ? deriveActivityStatus(lastActivity.get(row.id) ?? null)
          : beat;
      })(),
    };
  });
}
