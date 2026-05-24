import type { TrendPoint } from "../components/trend-chart";
import type { Metric } from "../types";

// Metrik dönüşüm yardımcıları — Cockpit ve proje detayı ortak kullanır.

export const usd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

/** İki ondalıklı dolar — eCPM gibi küçük tutarlar için. */
export const usd2 = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

/** Verilen ISO para birimi koduyla biçimlendirir (TRY/USD/EUR …).
 *  Her zaman 2 ondalık — kuruş bilgisi kaybolmasın diye. */
export const formatMoney = (value: number, currency = "USD") => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
};

/** Geriye uyumluluk — eski adıyla aynı format. */
export const formatMoney2 = formatMoney;

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

/** Belirli tarih aralığında bir metriğin toplamı (proje-bağımsız).
 *  start/end ISO YYYY-MM-DD (start dahil, end dahil). */
export const sumInRange = (
  metrics: Metric[],
  metricName: string,
  start: string,
  end: string,
): number => {
  let total = 0;
  for (const m of metrics) {
    if (m.metric !== metricName) continue;
    if (m.date < start || m.date > end) continue;
    total += Number(m.value);
  }
  return total;
};

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) =>
  `${y}-${pad(m)}-${pad(d)}`;

/** AdMob/Apple konsoluna paralel tarih aralıkları (UTC). */
export const moneyRanges = () => {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-indexed
  const d = now.getUTCDate();
  const today = iso(y, m + 1, d);
  const yesterday = ymdOffset(now, -1);
  const thisMonthStart = iso(y, m + 1, 1);
  // Geçen ay başı/sonu
  const prevMonthDate = new Date(Date.UTC(y, m - 1, 1));
  const prevY = prevMonthDate.getUTCFullYear();
  const prevM = prevMonthDate.getUTCMonth();
  const prevMonthStart = iso(prevY, prevM + 1, 1);
  // bu ay başı - 1 gün = geçen ay sonu
  const prevMonthEndDate = new Date(Date.UTC(y, m, 0));
  const prevMonthEnd = iso(
    prevMonthEndDate.getUTCFullYear(),
    prevMonthEndDate.getUTCMonth() + 1,
    prevMonthEndDate.getUTCDate(),
  );
  return {
    today,
    yesterday,
    thisMonthStart,
    thisMonthEnd: today,
    prevMonthStart,
    prevMonthEnd,
  };
};

const ymdOffset = (base: Date, days: number) => {
  const d = new Date(base.getTime() + days * 86_400_000);
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
};

/** Bir tarih için tek metric değeri (proje-bağımsız toplam). */
export const valueOnDate = (
  metrics: Metric[],
  metricName: string,
  date: string,
): number => {
  let total = 0;
  for (const m of metrics) {
    if (m.metric === metricName && m.date === date) total += Number(m.value);
  }
  return total;
};

/** Serinin son değeri ile ~days gün öncesi arasındaki yüzde değişim.
 *  Seride o yaşta sıfır-olmayan nokta yoksa, en eski sıfır-olmayan değerle
 *  kıyaslar — yeni başlayan projelerde delta yine de görünsün diye. */
export const deltaPct = (s: TrendPoint[], days = 7): number | null => {
  if (s.length < 2) return null;
  const last = s[s.length - 1].value;
  const targetIdx = Math.max(0, s.length - 1 - days);
  let prev = s[targetIdx].value;
  if (prev === 0) {
    const firstNonZero = s.slice(0, s.length - 1).find((p) => p.value > 0);
    if (!firstNonZero) return null;
    prev = firstNonZero.value;
  }
  return ((last - prev) / prev) * 100;
};
