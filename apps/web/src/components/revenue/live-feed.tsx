import { useEffect, useMemo, useState } from "react";
import { RC_EVENT_LABEL, type RevenueEvent } from "@helm/api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDisplayCurrency } from "@/context/currency";
import { useRevenueEvents } from "@/hooks/use-revenue-events";
import { useFxRates } from "@/lib/fx";
import { formatMoney } from "@/lib/metrics";
import { cn } from "@/lib/utils";

/**
 * Canli satin alma akisi.
 *
 * Yesil nokta YALNIZCA kanal SUBSCRIBED iken yanip soner; baglanti yoksa gri
 * ve sabit kalir - "canli" yazip olu akis gostermek en kotu yalandir.
 */

/** Goreli zaman metni kac ms'de bir tazelensin. */
const TICK_MS = 30_000;

/** "az önce" / "3dk önce" - Intl.RelativeTimeFormat kisa Turkce vermiyor. */
function relativeTime(iso: string, now: number): string {
  const diffMs = now - Date.parse(iso);
  if (!Number.isFinite(diffMs) || diffMs < 60_000) return "az önce";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}dk önce`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}sa önce`;

  return `${Math.floor(hours / 24)}g önce`;
}

/** Saniye saniye degil, dakikada iki kere yeniden cizmek yeterli. */
function useNow(intervalMs = TICK_MS): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** "com.wesan.friday.pro" -> "pro". Ekranda tam paket adi tasinmaz. */
function shortProduct(productId: string | null): string {
  if (!productId) return "Ürün bilinmiyor";
  const tail = productId.split(".").pop();
  return tail && tail.length > 0 ? tail : productId;
}

export const LiveFeed = () => {
  const { events, isLoading, isLive, error } = useRevenueEvents();
  const { currency: displayCcy } = useDisplayCurrency();
  const now = useNow();

  // Olaylar kendi para biriminde geliyor (RC raporlama birimi). Kart sayfanin
  // geri kalaniyla ayni birimde konusmali, yoksa toplamlar kiyaslanamaz.
  const sourceCurrencies = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) set.add(e.currency || "USD");
    return Array.from(set);
  }, [events]);
  const fxRates = useFxRates(sourceCurrencies, displayCcy);

  return (
    <Card>
      <CardHeader>
        {/* CardHeader bir grid; tek satir icin flex'i baslikta kuruyoruz. */}
        <CardTitle className="flex items-center gap-2">
          <LiveDot isLive={isLive} />
          Canlı Satın Alma
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {isLive ? "bağlı" : "bağlantı yok"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {error}
          </p>
        ) : isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Yükleniyor...
          </p>
        ) : events.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Henüz satın alma yok
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {events.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                now={now}
                displayCcy={displayCcy}
                rate={fxRates[event.currency || "USD"] ?? 1}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

const LiveDot = ({ isLive }: { isLive: boolean }) => (
  <span
    aria-hidden
    title={isLive ? "Canlı bağlantı açık" : "Canlı bağlantı yok"}
    className={cn(
      "size-2 shrink-0 rounded-full",
      isLive
        ? // motion-safe: prefers-reduced-motion aciksa nabiz durur, renk kalir.
          "bg-emerald-500 motion-safe:animate-pulse dark:bg-emerald-400"
        : "bg-muted-foreground/40",
    )}
  />
);

const EventRow = ({
  event,
  now,
  displayCcy,
  rate,
}: {
  event: RevenueEvent;
  now: number;
  displayCcy: string;
  rate: number;
}) => {
  const label = RC_EVENT_LABEL[event.eventType] ?? event.eventType;

  return (
    <li className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="truncate text-sm">
          {shortProduct(event.productId)}
          <span className="text-muted-foreground"> · {label}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {relativeTime(event.occurredAt, now)}
          {event.store ? ` · ${event.store}` : ""}
          {event.countryCode ? ` · ${event.countryCode}` : ""}
        </div>
      </div>
      <div className="shrink-0 text-sm tabular-nums">
        {event.amount == null
          ? "-"
          : formatMoney(event.amount * rate, displayCcy)}
      </div>
    </li>
  );
};
