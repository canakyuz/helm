// helm-ingest — connector ortak tipleri

/** Bir connector'ın ürettiği tek metrik noktası. */
export interface MetricPoint {
  date: string; // YYYY-MM-DD
  metric: string;
  value: number;
}

/** Ülke kırılımlı metrik noktası — metrics_country tablosuna yazılır. */
export interface CountryMetricPoint extends MetricPoint {
  country_code: string; // ISO 3166-1 alpha-2 (US, TR, DE...)
}

/** Geriye uyumlu connector çıktısı: düz dizi veya {points, byCountry}. */
export type ConnectorResult =
  | MetricPoint[]
  | {
      points: MetricPoint[];
      byCountry?: CountryMetricPoint[];
    };

export type ConnectorConfig = Record<string, string>;

/** Tüm connector'lar bu imzayı uygular. */
export type Connector = (config: ConnectorConfig) => Promise<ConnectorResult>;

/** Bugünün UTC tarihi (YYYY-MM-DD). */
export const today = () => new Date().toISOString().slice(0, 10);
