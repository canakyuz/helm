// helm-ingest — connector ortak tipleri

/** Bir connector'ın ürettiği tek metrik noktası. */
export interface MetricPoint {
  date: string; // YYYY-MM-DD
  metric: string;
  value: number;
}

export type ConnectorConfig = Record<string, string>;

/** Tüm connector'lar bu imzayı uygular. */
export type Connector = (config: ConnectorConfig) => Promise<MetricPoint[]>;

/** Bugünün UTC tarihi (YYYY-MM-DD). */
export const today = () => new Date().toISOString().slice(0, 10);
