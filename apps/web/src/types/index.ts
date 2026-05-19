// helm — domain tipleri

export type ProviderName = "revenuecat" | "admob" | "posthog" | "supabase";

export interface Project {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

/** Sağlayıcıya özel bağlantı konfigürasyonu. v1'de jsonb içinde tutulur. */
export interface RevenueCatConfig {
  rc_project_id: string;
  api_key: string; // v2 secret key
}

export interface AdMobConfig {
  publisher_id: string; // pub-XXXXXXXXXXXXXXXX
  client_id: string;
  client_secret: string;
  refresh_token: string;
}

export interface PostHogConfig {
  project_id: string;
  api_key: string; // personal API key
  host: string; // ör. https://eu.posthog.com
}

export interface SupabaseUsersConfig {
  project_url: string;
  service_role_key: string;
}

export type IntegrationConfig =
  | RevenueCatConfig
  | AdMobConfig
  | PostHogConfig
  | SupabaseUsersConfig
  | Record<string, never>;

export interface ProjectIntegration {
  id: string;
  project_id: string;
  provider: ProviderName;
  config: IntegrationConfig;
  enabled: boolean;
  last_synced_at: string | null;
  last_sync_status: "ok" | "error" | null;
  last_sync_error: string | null;
  created_at: string;
}

export interface Metric {
  project_id: string;
  date: string;
  source: ProviderName;
  metric: string;
  value: number;
  ingested_at: string;
}

export interface SyncRun {
  id: number;
  started_at: string;
  finished_at: string | null;
  trigger: "manual" | "cron";
  ingested: number;
  ok_count: number;
  error_count: number;
  details: unknown;
}

export type AlertCondition = "drop_pct" | "rise_pct" | "below" | "above";

export interface AlertRule {
  id: string;
  name: string;
  project_id: string | null;
  metric: string;
  condition: AlertCondition;
  threshold: number;
  channel: "telegram" | "email";
  enabled: boolean;
  created_at: string;
}

export interface AlertEvent {
  id: number;
  rule_id: string;
  triggered_at: string;
  metric: string;
  current_value: number | null;
  reference_value: number | null;
  message: string;
  delivered: boolean;
}

export const PROVIDER_LABELS: Record<ProviderName, string> = {
  revenuecat: "RevenueCat",
  admob: "AdMob",
  posthog: "PostHog",
  supabase: "Supabase",
};
