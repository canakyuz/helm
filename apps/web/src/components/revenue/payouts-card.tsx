import { useMemo } from "react";
import { type CrudFilter, useList } from "@refinedev/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useScope } from "@/context/scope";
import { useDisplayCurrency } from "@/context/currency";
import { useFxRates } from "@/lib/fx";
import { formatMoney } from "@/lib/metrics";
import type { Payout } from "@/types";
import { cn } from "@/lib/utils";

const SOURCE_LABEL: Record<string, string> = {
  app_store_connect: "App Store",
  google_play: "Play",
  adsense: "AdSense",
  admob: "AdMob",
  stripe: "Stripe",
};

// 'carried_forward' ve 'pending_fiscal_close' bilerek ayri tutuluyor: ikisi de
// "bekliyor" degil. Biri esik altinda kalip devreden bakiye, digeri mali donemi
// kapanmamis tutar. Hepsini "Bekliyor" diye gostermek kullaniciya parasinin
// NEDEN gelmedigini gizler.
const STATUS_LABEL: Record<string, string> = {
  carried_forward: "Devredildi",
  pending_fiscal_close: "Dönem kapanmadı",
  threshold_reached: "Eşik aşıldı",
  pending: "Bekliyor",
  in_transit: "Yolda",
  paid: "Ödendi",
  failed: "Başarısız",
  canceled: "İptal",
};

// Para henuz bankada degil. 'carried_forward' dahil: hak edilmis ama takvimde
// olmayan para da bekleyen paradir.
const NOT_YET_PAID = new Set([
  "carried_forward",
  "pending_fiscal_close",
  "threshold_reached",
  "pending",
  "in_transit",
]);

const MONTHS_SHORT = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz",
  "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
];

/** "2026-09-03" → "3 Eyl" */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_SHORT[(m || 1) - 1] ?? ""}`;
}

/** "2026-06" → "Haz 2026" */
function periodLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS_SHORT[(m || 1) - 1] ?? ""} ${y}`;
}

/** Odeme penceresi. Ayni ay icinde ay adi tekrarlanmaz: "3–7 Eyl". */
function windowLabel(start: string | null, end: string | null): string {
  if (!start) return "—";
  if (!end || end === start) return shortDate(start);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const from = sameMonth ? String(Number(start.split("-")[2])) : shortDate(start);
  return `${from}–${shortDate(end)}`;
}

function PayoutRow({
  row,
  display,
  rate,
}: {
  row: Payout;
  display: string;
  rate: number;
}) {
  const paid = row.status === "paid";
  return (
    <div className="flex items-center gap-4 py-2.5">
      <span className="w-20 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
        {windowLabel(row.arrival_date, row.arrival_end)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">
          {SOURCE_LABEL[row.source] ?? row.source}
          {row.period != null ? (
            <span className="text-muted-foreground"> · {periodLabel(row.period)}</span>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{STATUS_LABEL[row.status] ?? row.status}</span>
          {/* Tahmin oldugu SAKLANMAZ - gerceklesmis odeme gibi gostermek
              kokpitte en pahali yalandir. */}
          {row.entry_source === "manual" ? (
            <span className="font-medium text-amber-600 dark:text-amber-400">
              TAHMİN
            </span>
          ) : null}
          {/* Kaynak para birimi gosterim biriminden farkliysa ham tutar da
              yazilir - kullanici hangi kurun uygulandigini gorebilsin. */}
          {row.currency !== display ? (
            <span className="font-mono tabular-nums">
              {formatMoney(row.amount, row.currency)}
            </span>
          ) : null}
        </div>
      </div>
      <span
        className={cn(
          "font-mono text-sm tabular-nums",
          paid ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
        )}
      >
        {formatMoney(row.amount * rate, display)}
      </span>
    </div>
  );
}

/**
 * Banka odemeleri - "ne zaman para yatacak" karti.
 *
 * Gelir kartlarindan AYRI bir kavram: gelir kazanildigi gun sayilir, para
 * haftalar sonra yatar. Apple ve AdSense esik altinda kalan bakiyeyi odemez,
 * sonraki doneme devreder - o yuzden "bekleyen" toplam, kazanilan gelirden
 * bagimsiz izlenir.
 *
 * project_id NULL olan satirlar HESAP duzeyi odemedir (Apple uygulama basina
 * degil, hesap basina oder) ve her scope'ta gorunur.
 */
export function PayoutsCard() {
  const { scope, isAll } = useScope();
  const { currency: displayCcy } = useDisplayCurrency();

  const filters: CrudFilter[] = [];
  if (!isAll) {
    filters.push({
      operator: "or",
      value: [
        { field: "project_id", operator: "eq", value: scope },
        { field: "project_id", operator: "null", value: true },
      ],
    });
  }

  const { result, query } = useList<Payout>({
    resource: "payouts",
    filters,
    sorters: [{ field: "arrival_date", order: "desc" }],
    pagination: { mode: "off" },
  });
  const rows = result.data;

  const currencies = useMemo(
    () => Array.from(new Set(rows.map((r) => r.currency).filter(Boolean))),
    [rows],
  );
  const fxRates = useFxRates(currencies, displayCcy);
  const rateOf = (ccy: string) => fxRates[ccy] ?? 1;

  // Bekleyen: en yakin odeme once. Gecmis: en yeni once.
  const { pending, past, pendingTotal } = useMemo(() => {
    const p = rows.filter((r) => NOT_YET_PAID.has(r.status));
    const q = rows.filter((r) => !NOT_YET_PAID.has(r.status));
    p.sort((a, b) =>
      (a.arrival_date ?? "9999").localeCompare(b.arrival_date ?? "9999"),
    );
    return {
      pending: p,
      past: q,
      pendingTotal: p.reduce((s, r) => s + r.amount * rateOf(r.currency), 0),
    };
  }, [rows, fxRates, displayCcy]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Banka ödemeleri</CardTitle>
        {pending.length > 0 ? (
          <span className="font-mono text-sm tabular-nums text-muted-foreground">
            Bekleyen · {formatMoney(pendingTotal, displayCcy)}
          </span>
        ) : null}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            {query.isLoading
              ? "Yükleniyor…"
              : "Ödeme kaydı yok. Stripe veya App Store Connect bağlayın; eşik altında devreden bakiyeleri elle de girebilirsiniz."}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {pending.map((r) => (
              <PayoutRow
                key={r.id}
                row={r}
                display={displayCcy}
                rate={rateOf(r.currency)}
              />
            ))}
            {pending.length > 0 && past.length > 0 ? (
              <div className="pt-3 pb-1 text-xs font-medium text-muted-foreground">
                Geçmiş
              </div>
            ) : null}
            {past.map((r) => (
              <PayoutRow
                key={r.id}
                row={r}
                display={displayCcy}
                rate={rateOf(r.currency)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
