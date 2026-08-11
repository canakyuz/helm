import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";

/**
 * Gercek zamanli gelir olaylari (RevenueCat webhook).
 *
 * NEDEN AYRI KAYNAK: subscription_revenue / iap_revenue metrikleri App Store
 * Connect'ten geliyor ve Apple gunluk raporlari T-1 + isleme gecikmesi tasiyor.
 * Bu tablo "az once ne oldu"yu gosterir; gunluk mutabakat metrics'te kalir.
 * Ikisini toplamak CIFT SAYIM olur — ayni para iki kez gorunur.
 */

export type RevenueEvent = {
  id: number;
  eventType: string;
  store: string | null;
  productId: string | null;
  /** Kirpilmis kullanici kimligi — tam kimlik ekranda gosterilmez. */
  userRef: string | null;
  countryCode: string | null;
  amount: number | null;
  currency: string | null;
  occurredAt: string;
};

type Row = {
  id: number;
  event_type: string;
  store: string | null;
  product_id: string | null;
  app_user_id: string | null;
  country_code: string | null;
  amount: string | number | null;
  currency: string | null;
  occurred_at: string;
};

/** "3947abcd5300" → "3947••5300". Tam kimlik ekranda tasinmaz. */
function maskUser(id: string | null): string | null {
  if (id == null || id.length <= 8) return id;
  return `${id.slice(0, 4)}••${id.slice(-4)}`;
}

export async function fetchRevenueEvents(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
  limit = 20,
): Promise<RevenueEvent[]> {
  let q = client
    .from("revenue_events")
    .select("id, event_type, store, product_id, app_user_id, country_code, amount, currency, occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (propertyId !== "all") q = q.eq("project_id", propertyId);

  const { data, error } = await q;
  if (error) throw error;

  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    eventType: r.event_type,
    store: r.store,
    productId: r.product_id,
    userRef: maskUser(r.app_user_id),
    countryCode: r.country_code,
    amount: r.amount == null ? null : Number(r.amount),
    currency: r.currency,
    occurredAt: r.occurred_at,
  }));
}

/** Ekranda gorunen olay adlari. */
export const RC_EVENT_LABEL: Record<string, string> = {
  INITIAL_PURCHASE: "Yeni abonelik",
  RENEWAL: "Yenileme",
  NON_RENEWING_PURCHASE: "Tek seferlik",
  UNCANCELLATION: "İptal geri alındı",
  PRODUCT_CHANGE: "Plan değişikliği",
  CANCELLATION: "İptal",
  EXPIRATION: "Süresi doldu",
  BILLING_ISSUE: "Ödeme sorunu",
};
