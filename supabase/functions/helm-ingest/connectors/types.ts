// helm-ingest - connector ortak tipleri

/** Bir connector'ın ürettiği tek metrik noktası. */
export interface MetricPoint {
  date: string; // YYYY-MM-DD
  metric: string;
  value: number;
}

/** Ülke kırılımlı metrik noktası - metrics_country tablosuna yazılır. */
export interface CountryMetricPoint extends MetricPoint {
  country_code: string; // ISO 3166-1 alpha-2 (US, TR, DE...)
}

/** Reklam formatı kırılımlı metrik noktası - metrics_format tablosuna yazılır. */
export interface FormatMetricPoint extends MetricPoint {
  format: string; // app_open, banner, interstitial, rewarded
}

/**
 * Connector'in metrics dısında yazmak istedigi satirlar. helm-ingest sirayla
 * upsert eder; `withProjectId` true ise her satira `project_id` enjekte edilir
 * (connector projeyi bilmez, yalnizca config alir).
 */
export interface ExtraUpsert {
  table: string;
  rows: Record<string, unknown>[];
  onConflict: string;
  withProjectId: boolean;
}

/** Geriye uyumlu connector çıktısı: düz dizi veya {points, byCountry, byFormat, extra}. */
export type ConnectorResult =
  | MetricPoint[]
  | {
      points: MetricPoint[];
      byCountry?: CountryMetricPoint[];
      byFormat?: FormatMetricPoint[];
      extra?: ExtraUpsert[];
    };

export type ConnectorConfig = Record<string, string>;

/** Tüm connector'lar bu imzayı uygular. */
export type Connector = (config: ConnectorConfig) => Promise<ConnectorResult>;

/** Bugünün UTC tarihi (YYYY-MM-DD). */
export const today = () => new Date().toISOString().slice(0, 10);

/** n gün önceki UTC tarihi (YYYY-MM-DD). */
export const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
