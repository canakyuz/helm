import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchFxRates, toUsd } from "./fx-rates";

export type PendingPayout = { source: string; amount: number; currency: string };
export type RecentPayout = {
  source: string;
  amount: number;
  currency: string;
  status: string;
  arrival_date: string;
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
