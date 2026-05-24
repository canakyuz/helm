// helm — domain tipleri

export * from "./cms";

export type ProviderName =
  | "revenuecat"
  | "admob"
  | "posthog"
  | "supabase"
  | "stripe"
  | "plausible"
  | "rest"
  | "sentry"
  | "app_store_connect"
  | "resend";

export interface Project {
  id: string;
  name: string;
  slug: string;
  app_store_id?: string | null;
  app_store_country?: string | null;
  cms_publish_targets?: import("./cms").CmsPublishTarget[];
  created_at: string;
}

// Brand / Property / Module — modül mimarisi (0019). Detay: .docs/MODULES.md
export interface Brand {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Property {
  id: string;
  brand_id: string;
  name: string;
  slug: string;
  type: import("@/lib/modules").PropertyType;
  enabled_modules: import("@/lib/modules").ModuleKey[];
  app_store_id?: string | null;
  app_store_country?: string | null;
  cms_publish_targets?: import("./cms").CmsPublishTarget[];
  created_at: string;
}

export interface Review {
  id: number;
  project_id: string;
  source: string;
  external_id: string | null;
  author: string | null;
  rating: number | null;
  title: string | null;
  body: string | null;
  review_date: string | null;
  fetched_at: string;
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

/** metrics_country — günlük metrik ülke kırılımı (ISO 3166-1 alpha-2). */
export interface MetricCountry {
  project_id: string;
  date: string;
  source: ProviderName;
  metric: string;
  country_code: string;
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

export interface Heartbeat {
  id: string;
  name: string;
  project_id: string | null;
  interval_minutes: number;
  last_ping_at: string | null;
  created_at: string;
}

export interface UserSegment {
  id: string;
  name: string;
  project_id: string | null;
  rule_type: "new" | "active" | "inactive";
  rule_days: number;
  created_at: string;
}

export interface AppVersion {
  id: number;
  project_id: string;
  source: "ios" | "android";
  version: string;
  release_date: string | null;
  release_notes: string | null;
  fetched_at: string;
}

export interface AuditLog {
  id: number;
  project_id: string | null;
  target_user: string | null;
  action: string;
  detail: string | null;
  created_at: string;
}

export const PROVIDER_LABELS: Record<ProviderName, string> = {
  revenuecat: "RevenueCat",
  admob: "AdMob",
  posthog: "PostHog",
  supabase: "Supabase",
  stripe: "Stripe",
  plausible: "Plausible",
  rest: "REST API",
  sentry: "Sentry",
  app_store_connect: "App Store Connect",
  resend: "Resend (Mail)",
};
