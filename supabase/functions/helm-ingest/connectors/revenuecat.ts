import { type Connector, type MetricPoint, today } from "./types.ts";

// RevenueCat v2 — Metrics Overview (anlık snapshot).
// config: { rc_project_id, api_key, sub_price? }  (api_key = v2 secret key)
//   sub_price: aylık abonelik fiyatı (kuruşlu, örn. "19.99"). RC overview MRR'ı
//   tam dolara YUVARLAR (19.99 → 19). Fiyatlar hep .99 olduğundan, sub_price
//   verildiyse MRR'ı tam kuruşla hesaplarız: fiyat × aktif abone sayısı.
//   (RC v2 ürün fiyatını API'den vermiyor; bu yüzden fiyat config'ten gelir.)
export const fetchRevenueCat: Connector = async (config) => {
  const res = await fetch(
    `https://api.revenuecat.com/v2/projects/${config.rc_project_id}/metrics/overview`,
    { headers: { Authorization: `Bearer ${config.api_key}` } },
  );
  if (!res.ok) {
    throw new Error(`RevenueCat ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  const metrics: Array<{ id: string; value: number }> = json.metrics ?? [];
  const get = (id: string) =>
    Number(metrics.find((m) => m.id === id)?.value ?? 0);

  const activeSubs = get("active_subscriptions");
  const subPrice = Number(config.sub_price) || 0;
  // sub_price varsa kuruşlu MRR = fiyat × aktif abone; yoksa RC'nin (yuvarlı) MRR'ı.
  const mrr = subPrice > 0 ? activeSubs * subPrice : get("mrr");

  const date = today();
  const points: MetricPoint[] = [
    { date, metric: "mrr", value: mrr },
    { date, metric: "active_subs", value: activeSubs },
    { date, metric: "subs_trial", value: get("active_trials") },
    { date, metric: "revenue_28d", value: get("revenue") },
  ];
  return points;
};
