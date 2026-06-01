import type { SupabaseClient } from "@supabase/supabase-js";

export type ProviderName =
  | "revenuecat"
  | "admob"
  | "posthog"
  | "supabase"
  | "rest"
  | "sentry"
  | "appstoreconnect"
  | "resend";

export type IntegrationStatus = "ok" | "error" | "pending";

export type IntegrationHealth = {
  id: string;
  propertyId: string;
  propertyName: string | null;
  provider: string;
  enabled: boolean;
  status: IntegrationStatus;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
};

export type SystemHealth = {
  integrations: IntegrationHealth[];
  totalIntegrations: number;
  okCount: number;
  errorCount: number;
  pendingCount: number;
  lastSyncRun: {
    startedAt: string;
    finishedAt: string | null;
    okCount: number;
    errorCount: number;
    ingested: number;
    trigger: string;
  } | null;
  syncRunsLast24h: number;
};

type IntegRow = {
  id: string;
  project_id: string;
  provider: string;
  enabled: boolean;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  properties: { name: string } | null;
};

type SyncRow = {
  started_at: string;
  finished_at: string | null;
  trigger: string;
  ingested: number;
  ok_count: number;
  error_count: number;
};

// local — properties.deriveStatus ile isim çakışmasın diye export edilmez.
function deriveStatus(
  enabled: boolean,
  lastSyncStatus: string | null,
): IntegrationStatus {
  if (!enabled) return "pending";
  if (lastSyncStatus === "error") return "error";
  if (lastSyncStatus === "ok") return "ok";
  return "pending";
}

export async function fetchSystemHealth(client: SupabaseClient): Promise<SystemHealth> {
  const since24h = new Date(Date.now() - 86_400_000).toISOString();

  const [integRes, lastSync, runsCount] = await Promise.all([
    client
      .from("project_integrations")
      .select(
        "id, project_id, provider, enabled, last_synced_at, last_sync_status, last_sync_error, properties ( name )",
      )
      .order("provider", { ascending: true }),
    client
      .from("sync_runs")
      .select("started_at, finished_at, trigger, ingested, ok_count, error_count")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("sync_runs")
      .select("id", { count: "exact", head: true })
      .gte("started_at", since24h),
  ]);

  if (integRes.error) throw integRes.error;
  if (lastSync.error) throw lastSync.error;
  if (runsCount.error) throw runsCount.error;

  const rows = (integRes.data as unknown as IntegRow[] | null) ?? [];
  const integrations: IntegrationHealth[] = rows.map((r) => ({
    id: r.id,
    propertyId: r.project_id,
    propertyName: r.properties?.name ?? null,
    provider: r.provider,
    enabled: r.enabled,
    status: deriveStatus(r.enabled, r.last_sync_status),
    lastSyncedAt: r.last_synced_at,
    lastSyncError: r.last_sync_error,
  }));

  const sync = lastSync.data as SyncRow | null;

  return {
    integrations,
    totalIntegrations: integrations.length,
    okCount: integrations.filter((i) => i.status === "ok").length,
    errorCount: integrations.filter((i) => i.status === "error").length,
    pendingCount: integrations.filter((i) => i.status === "pending").length,
    lastSyncRun: sync
      ? {
          startedAt: sync.started_at,
          finishedAt: sync.finished_at,
          okCount: sync.ok_count,
          errorCount: sync.error_count,
          ingested: sync.ingested,
          trigger: sync.trigger,
        }
      : null,
    syncRunsLast24h: runsCount.count ?? 0,
  };
}
