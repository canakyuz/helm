import type { TrendPoint } from "../components/trend-chart";
import type { Metric } from "../types";

// Metrik dönüşüm yardımcıları — Cockpit ve proje detayı ortak kullanır.

export const usd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

export const compact = (value: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact" }).format(value);

/** Bir metriğin gün gün (tarihe göre toplanmış) zaman serisi. */
export const series = (metrics: Metric[], metricName: string): TrendPoint[] => {
  const map = new Map<string, number>();
  for (const m of metrics) {
    if (m.metric !== metricName) continue;
    map.set(m.date, (map.get(m.date) ?? 0) + Number(m.value));
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, value]) => ({ date, value }));
};

/** Bir metriğin en güncel tarihteki (projeler-arası toplam) değeri. */
export const latest = (metrics: Metric[], metricName: string): number => {
  const s = series(metrics, metricName);
  return s.length ? s[s.length - 1].value : 0;
};

/** Serinin son değeri ile ~days gün öncesi arasındaki yüzde değişim. */
export const deltaPct = (s: TrendPoint[], days = 7): number | null => {
  if (s.length < 2) return null;
  const last = s[s.length - 1].value;
  const prev = s[Math.max(0, s.length - 1 - days)].value;
  if (prev === 0) return null;
  return ((last - prev) / prev) * 100;
};
