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

export async function fetchProperties(client: SupabaseClient): Promise<Property[]> {
  const { data, error } = await client
    .from("properties")
    .select(
      "id, name, slug, brand_id, type, enabled_modules, brands ( name ), heartbeats ( name, interval_minutes, last_ping_at )",
    )
    .order("name", { ascending: true });

  if (error) throw error;

  return ((data as unknown as PropertyRow[] | null) ?? []).map((row) => {
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
      status: deriveStatus(
        latest?.last_ping_at ?? null,
        latest?.interval_minutes ?? null,
      ),
    };
  });
}
