import { type Connector, type MetricPoint, today } from "./types.ts";

// RevenueCat v2 — Metrics Overview (anlık snapshot).
// config: { rc_project_id, api_key, mrr_cents? }  (api_key = v2 secret key)
//   mrr_cents: abonelik fiyatlarının ONDALIK kısmı (örn. "0.99" veya "99").
//   RC overview MRR'ı kuruşu YUVARLAR (19.99→19, 9.99→9). Fiyat tier'ı değişir
//   (9.99/14.99/19.99) ama hep .99 biter; RC tam kısmı doğru toplar, biz sadece
//   kuruşu geri ekleriz → tier'dan bağımsız, tam değer. (RC v2 ürün fiyatını
//   API'den vermiyor; bu yüzden ondalık config'ten gelir.)
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
  const rcMrr = get("mrr");
  // mrr_cents: "0.99" da "99" da kabul; [0, 0.99]'a kıstır.
  let cents = Number(config.mrr_cents) || 0;
  if (cents >= 1) cents = cents / 100;
  cents = Math.min(0.99, Math.max(0, cents));
  // Tam kısım RC'den (tüm tier'ları doğru toplar), kuruşu geri ekle.
  // Aktif abone yoksa kuruş ekleme (0 → 0, 0.99 değil).
  const mrr = activeSubs > 0 && cents > 0 ? Math.floor(rcMrr) + cents : rcMrr;

  const date = today();
  const points: MetricPoint[] = [
    { date, metric: "mrr", value: mrr },
    { date, metric: "active_subs", value: activeSubs },
    { date, metric: "subs_trial", value: get("active_trials") },
    { date, metric: "revenue_28d", value: get("revenue") },
  ];
  return points;
};
