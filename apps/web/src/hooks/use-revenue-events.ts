import { useEffect, useState } from "react";
import { fetchRevenueEvents, type RevenueEvent } from "@helm/api";

import { supabaseClient } from "@/providers/supabase-client";
import { useScope } from "@/context/scope";

/**
 * Canli satin alma akisi - RevenueCat webhook'u `revenue_events`'e yazar.
 *
 * NEDEN AYRI KAYNAK: metrics tablosu App Store Connect'ten geliyor ve T-1
 * gecikmeli. Bu tablo "az once ne oldu"yu tasir. Ikisi TOPLANMAZ (cift sayim).
 *
 * Ilk sayfa REST ile cekilir, sonrasi postgres_changes INSERT aboneligiyle
 * gelir. Realtime'in calismasi icin tablonun `supabase_realtime` yayininda
 * olmasi gerekir - bkz. 0046_revenue_events_realtime.sql.
 */

/** Bellekte tutulan azami olay sayisi. Yogun gun listeyi sisiremesin. */
const DEFAULT_LIMIT = 30;

/** postgres_changes payload'i ham kolonlari tasir, camelCase'i degil. */
type RevenueEventRow = {
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

/**
 * "3947abcd5300" -> "3947••5300".
 *
 * packages/api icindeki maskeleme ile ayni kural; orası disariya export
 * etmiyor ve o paket bu gorevin kapsaminda degil. Tam kimlik ekrana tasinmaz.
 */
function maskUser(id: string | null): string | null {
  if (id == null || id.length <= 8) return id;
  return `${id.slice(0, 4)}••${id.slice(-4)}`;
}

function toEvent(row: RevenueEventRow): RevenueEvent {
  return {
    id: row.id,
    eventType: row.event_type,
    store: row.store,
    productId: row.product_id,
    userRef: maskUser(row.app_user_id),
    countryCode: row.country_code,
    amount: row.amount == null ? null : Number(row.amount),
    currency: row.currency,
    occurredAt: row.occurred_at,
  };
}

/**
 * Mevcut listeyle gelenleri birlestirir: id'ye gore tekillestirir, zamana gore
 * azalan siralar, `limit`'e kirpar.
 *
 * NEDEN TEKILLESTIRME: ilk REST cevabi ile canli INSERT yarisabilir - webhook
 * satiri yazdiktan sonra fetch onu da dondururse ayni satin alma iki kez
 * gorunurdu.
 *
 * Karmasiklik: n = prev (<= limit), m = gelen. Time O((n+m) log(n+m)),
 * space O(n+m). limit sabit (30) oldugundan pratikte O(1) - liste sinirsiz
 * buyuyemez, her guncelleme sabit isten ibarettir.
 */
function mergeEvents(
  prev: RevenueEvent[],
  incoming: RevenueEvent[],
  limit: number,
): RevenueEvent[] {
  const byId = new Map<number, RevenueEvent>();
  for (const e of prev) byId.set(e.id, e);
  for (const e of incoming) byId.set(e.id, e);

  return Array.from(byId.values())
    .sort((a, b) => {
      const diff = Date.parse(b.occurredAt) - Date.parse(a.occurredAt);
      return diff !== 0 ? diff : b.id - a.id;
    })
    .slice(0, limit);
}

export type RevenueEventsFeed = {
  events: RevenueEvent[];
  isLoading: boolean;
  /** Kanal gercekten SUBSCRIBED ise true - "canli" rozeti buna bakar. */
  isLive: boolean;
  error: string | null;
};

export function useRevenueEvents(limit = DEFAULT_LIMIT): RevenueEventsFeed {
  const { scope } = useScope();
  const [events, setEvents] = useState<RevenueEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Kapsam degisti: eski projenin satirlari ekranda kalmasin.
    setEvents([]);
    setIsLoading(true);
    setIsLive(false);
    setError(null);

    fetchRevenueEvents(supabaseClient, scope, limit)
      .then((rows) => {
        if (cancelled) return;
        // Abonelik zaten acik olabilir; prepend degil merge - cift satir olmaz.
        setEvents((prev) => mergeEvents(prev, rows, limit));
      })
      .catch(() => {
        if (!cancelled) setError("Satın alma akışı yüklenemedi");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    // Kanal adi kapsama bagli; kapsam degisince yeni kanal acilir, eskisi
    // asagidaki cleanup'ta kapatilir. Ayni ada iki kanal birikmez.
    const channel = supabaseClient
      .channel(`revenue-events:${scope}`)
      .on<RevenueEventRow>(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "revenue_events",
          // Tek proje secildiyse filtreyi sunucuya birak - istemciye baska
          // projelerin satirlari hic inmez.
          ...(scope === "all" ? {} : { filter: `project_id=eq.${scope}` }),
        },
        (payload) => {
          if (cancelled) return;
          setEvents((prev) => mergeEvents(prev, [toEvent(payload.new)], limit));
        },
      )
      .subscribe((status) => {
        if (cancelled) return;
        setIsLive(status === "SUBSCRIBED");
      });

    return () => {
      cancelled = true;
      // removeChannel hem unsubscribe eder hem socket kaydini siler; sadece
      // unsubscribe cagirmak kanali client'in listesinde birakirdi.
      void supabaseClient.removeChannel(channel);
    };
  }, [scope, limit]);

  return { events, isLoading, isLive, error };
}
