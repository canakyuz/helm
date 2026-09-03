import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchFxRates, toUsd } from "./fx-rates";

// Odeme durumlari. Stripe'in bes durumu + magaza/reklam agi yasam dongusu:
// Apple ve AdSense esik altinda kalan bakiyeyi odemez, sonraki doneme devreder;
// Apple mali donem kapanmadan tutari kesinlestirmez. Bunlar "pending" degildir -
// para hak edilmis ama takvimde yoktur (bkz. migration 0050).
export type PayoutStatus =
  | "carried_forward"
  | "pending_fiscal_close"
  | "threshold_reached"
  | "pending"
  | "in_transit"
  | "paid"
  | "failed"
  | "canceled";

// Bir odemenin ortak alanlari. `estimated` = satir elle girilmis bir TAHMIN,
// gerceklesmis banka hareketi degil; UI bunu gizlememeli.
type PayoutBase = {
  source: string;
  amount: number;
  currency: string;
  /** Kazancin ait oldugu donem (YYYY-MM). Odeme tarihinden ayridir. */
  period?: string | null;
  /** Odeme penceresinin basi. */
  arrival_date?: string | null;
  /** Pencerenin bitisi; null ise tek gun. */
  arrival_end?: string | null;
  estimated?: boolean;
  note?: string | null;
};

export type PendingPayout = PayoutBase & { status?: string };
export type RecentPayout = PayoutBase & {
  status: string;
  arrival_date: string | null;
  net: number;
};
export type PayoutsData = { pending: PendingPayout[]; recent: RecentPayout[] };

export async function fetchPayouts(
  client: SupabaseClient,
  projectId: string,
): Promise<PayoutsData> {
  const [{ data, error }, rates] = await Promise.all([
    client.functions.invoke<PayoutsData>("helm-payouts", {
      body: { project_id: projectId },
    }),
    fetchFxRates(),
  ]);
  if (error) throw error;
  const raw = data ?? { pending: [], recent: [] };

  // Payout tutarları kaynak currency'sinde (AdMob TRY, App Store USD/EUR…) →
  // USD canonical'e çevir; gösterim katmanı USD → seçili currency yapar.
  // `currency` alanı referans olarak korunur (detayda "kaynak: EUR" gibi).
  //
  // Çevrilmiş tutar HİÇBİR ZAMAN saklanmaz, her okumada canlı kurla yeniden
  // hesaplanır. Kaydın içine sabit bir kur yazmak (ör. estimated_gbp) haftalar
  // içinde sessizce bayatlar - 2026-08-24'te yaşanan hatanın kaynağı buydu
  // (bkz. fx-rates.ts dosya başı notu).
  return {
    pending: raw.pending.map((p) => ({
      ...p,
      amount: toUsd(p.amount, p.currency, rates),
    })),
    recent: raw.recent.map((p) => ({
      ...p,
      amount: toUsd(p.amount, p.currency, rates),
      net: toUsd(p.net, p.currency, rates),
    })),
  };
}
