// NEDEN `~/lib/format` DEGIL: o dosya i18n → preferences → expo-secure-store
// zincirini cekiyor ve modulu React Native'e bagliyor. Bicimleyicilerin
// kendileri saf; dogrudan pakete baglanince bu modul RN'siz calisabiliyor.
import { formatCurrency, formatInteger, formatDelta } from "@helm/domain";

// `~/lib/preferences`'teki Currency ile ayni kume. Oradan import edilmiyor
// cunku o dosya expo-secure-store cekiyor ve bu modulu RN'e baglardi. Iki
// tanim ayrisirsa TS cagri yerinde hata verir — sessizce kaymaz.
type Currency = "USD" | "TRY" | "EUR" | "GBP";

/**
 * Widget yukunun SAF hesabi — React Native'e dokunmaz.
 *
 * NEDEN AYRI DOSYA: bu mantik `widget-sync.ts` icindeydi, o da `react-native`
 * import ediyor. Dolayisiyla RN disinda calistirilamiyor, yani test edilemiyordu
 * — ve tam da burada bir birim karisikligi bugi vardi (gunluk reklam geliri
 * aylik MRR oranina ekleniyordu). Saf kisim ayrilinca dogrulanabiliyor.
 */

export type HelmWidgetPayload = {
  liveUsers: number;
  liveUsersText: string;
  adRevenueText: string;
  incomingPaymentsText: string;
  totalRevenueText: string;
  mrrDelta: number | null;
  mrrDeltaText: string | null;
  /** @deprecated Legacy ring; widget prefers mrrDelta when present. */
  conversionRate?: number | null;
  conversionRateText?: string | null;
  openAlerts: number;
  /** Normalized 0–1 heights for Mon–Sun bars (7 values). */
  sparkline?: number[];
  currency: Currency;
  updatedAtIso: string;
};

/**
 * Widget'in gosterdigi AY verisi — ay basindan bugune.
 *
 * NEDEN AY: buyuk sayi eskiden `adRevenue + mrr` idi; bu BIR GUNUN reklam
 * gelirini AYLIK tekrarli gelir ORANINA ekliyordu. Iki farkli birim toplaninca
 * cikan sayi ne bir gunun ne bir ayin geliriydi (olculdu: widget £45.12 derken
 * uygulama £95.57 diyordu) ve uygulama-ici gelir bacagi hic girmiyordu. Artik
 * kaynak, Gelir ekraninin kullandigi ayni kova.
 */
export type WidgetMonthInput = {
  /** Ay basindan bugune toplam gelir (USD). */
  total: number;
  /** Ay basindan bugune reklam geliri (USD). */
  adRevenue: number;
  /** Ay basindan bugune kullanicilarin odedigi — abonelik + uygulama ici (USD). */
  payments: number;
  /** Son 7 gunun gunluk toplamlari, eskiden yeniye (USD). */
  last7: number[];
};

type RevenueBucketLike = {
  total: number;
  bySource: Record<string, number>;
  days: Array<{ date: string; value: number }>;
};

/** Gelir gecmisinin GUNCEL AY kovasini widget girdisine cevirir. */
export function monthFromBucket(
  bucket: RevenueBucketLike | null | undefined,
): WidgetMonthInput | null {
  if (bucket == null) return null;
  const src = bucket.bySource ?? {};
  return {
    total: bucket.total,
    adRevenue: src.ad_revenue ?? 0,
    // "pay" = kullanicinin cebinden cikan para. MRR burada YOK: o bir oran,
    // kazanilmis tutar degil.
    payments: (src.subscription_revenue ?? 0) + (src.iap_revenue ?? 0),
    last7: (bucket.days ?? []).slice(-7).map((d) => d.value),
  };
}

/** Cubuk yukseklikleri 0.08–1 arasina sikistirilir; sifir gun de gorunur kalsin. */
export function normalizeBars(values: number[]): number[] {
  const padded = [...values];
  while (padded.length < 7) padded.unshift(0);
  const last7 = padded.slice(-7);
  const max = Math.max(...last7, 1);
  return last7.map((v) => Math.max(0.08, v / max));
}

export function buildWidgetPayload(
  data: {
    // null = olcum yok. Metin alanlari "—" gosterir; SAYISAL alan (liveUsers)
    // widget'in duzeni icin 0'a duser — orada gosterilecek bir metin yok.
    dau: number | null;
    mrrDelta: number | null;
    openAlerts: number;
  },
  month: WidgetMonthInput | null,
  currency: Currency,
  fxRate: number,
  now: Date = new Date(),
): HelmWidgetPayload {
  // Tutarlar USD baz; fxRate = USD → secili currency.
  const money = (v: number | null) =>
    v != null ? formatCurrency(v * fxRate, currency) : "—";

  return {
    liveUsers: data.dau ?? 0,
    liveUsersText: data.dau != null ? formatInteger(data.dau) : "—",
    adRevenueText: money(month ? month.adRevenue : null),
    incomingPaymentsText: money(month ? month.payments : null),
    totalRevenueText: money(month ? month.total : null),
    mrrDelta: data.mrrDelta,
    mrrDeltaText: data.mrrDelta !== null ? formatDelta(data.mrrDelta) : null,
    openAlerts: data.openAlerts,
    ...(month ? { sparkline: normalizeBars(month.last7) } : {}),
    currency,
    updatedAtIso: now.toISOString(),
  };
}
