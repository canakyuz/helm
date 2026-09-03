import { Text, View } from "react-native";
import type { PendingPayout, RecentPayout } from "@helm/api";

import { MONTHS_SHORT } from "~/lib/labels";
import { tr, useT } from "~/lib/i18n";
import { useTheme } from "~/theme/use-theme";
import { BentoTile } from "~/components/bento";

// Ham kaynak kodu → kisa etiket. Senkron satirlari zaten gosterim adiyla
// geliyor ("App Store", "Stripe"); elle girilenler ham kod tasir → fallback
// degeri oldugu gibi birakir.
const SOURCE_LABEL: Record<string, string> = {
  app_store_connect: "App Store",
  google_play: "Play",
  adsense: "AdSense",
  admob: "AdMob",
  stripe: "Stripe",
};

// Durum → ekran etiketi. 'carried_forward' ve 'pending_fiscal_close' ozellikle
// ayri tutuluyor: ikisi de "bekliyor" degil. Biri esik altinda kalip devreden
// bakiye, digeri mali donemi kapanmamis tutar. Hepsini "BEKLIYOR" diye
// gostermek kullaniciya parasinin NEDEN gelmedigini gizler.
const STATUS_LABEL: Record<string, string> = {
  carried_forward: "DEVREDİLDİ",
  pending_fiscal_close: "DÖNEM KAPANMADI",
  threshold_reached: "EŞİK AŞILDI",
  pending: "BEKLİYOR",
  in_transit: "YOLDA",
  paid: "ÖDENDİ",
  failed: "BAŞARISIZ",
  canceled: "İPTAL",
};

/** "2026-09-03" → "3 Eyl" */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${tr(MONTHS_SHORT[(m ?? 1) - 1] ?? "")}`;
}

/** "2026-06" → "Haz" */
function shortPeriod(ym: string): string {
  const m = Number(ym.split("-")[1]);
  return tr(MONTHS_SHORT[(m || 1) - 1] ?? "");
}

/**
 * Odeme penceresi. Tek tarih varsa tek gun yazilir; aralik varsa "3–7 Eyl".
 * Ayni ay icinde ay adi tekrarlanmaz.
 */
function windowLabel(start?: string | null, end?: string | null): string {
  if (!start) return "—";
  if (!end || end === start) return shortDate(start);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const from = sameMonth ? String(Number(start.split("-")[2])) : shortDate(start);
  return `${from}–${shortDate(end)}`;
}

type Row = PendingPayout | RecentPayout;

function PayoutRow({
  row,
  fmt,
  tone,
}: {
  row: Row;
  fmt: (n: number) => string;
  tone: string;
}) {
  const { theme } = useTheme();
  const status = row.status != null ? STATUS_LABEL[row.status] ?? row.status : null;

  return (
    <View className="flex-row items-center gap-rowY border-t border-line py-rowY">
      <Text className="w-[54px] font-mono-medium text-meta text-fg3">
        {windowLabel(row.arrival_date, row.arrival_end)}
      </Text>
      <View className="min-w-0 flex-1">
        <Text className="font-medium text-row tracking-tight text-fg" numberOfLines={1}>
          {SOURCE_LABEL[row.source] ?? row.source}
          {row.period != null ? ` · ${shortPeriod(row.period)}` : ""}
        </Text>
        <View className="mt-[1px] flex-row items-center">
          <Text className="text-meta text-fg3" numberOfLines={1}>
            {status}
          </Text>
          {/* Tahmin oldugu SAKLANMAZ ve gri metne gomulmez - gerceklesmis odeme
              gibi gostermek kokpitte en pahali yalandir. warn tonu, sistemde
              zaten "gercek olmayan veri" isareti (DEMO cipi, design.md §2). */}
          {row.estimated === true ? (
            <Text
              className="font-mono-medium text-eyebrow tracking-wide"
              style={{ color: theme.warn }}
            >
              {`  ·  ${"TAHMİN"}`}
            </Text>
          ) : null}
        </View>
      </View>
      <Text className="font-mono-semibold text-body" style={{ color: tone }}>
        {fmt(row.amount)}
      </Text>
    </View>
  );
}

/**
 * Banka odemeleri - PaymentsTile'dan AYRI bir kavram. PaymentsTile donem ici
 * satin almalari (islem geliri) listeler; burasi o gelirin ne zaman BANKAYA
 * gectigini/gececegini gosterir. Ikisi arasinda haftalar olabilir.
 *
 * Tutarlar USD canonical gelir (packages/api/src/payouts.ts), fmt secili para
 * birimine cevirir - canli kurla, her okumada yeniden.
 */
export function PayoutsTile({
  pending,
  recent,
  loading,
  fmt,
}: {
  pending: readonly PendingPayout[];
  recent: readonly RecentPayout[];
  loading: boolean;
  fmt: (n: number) => string;
}) {
  const t = useT();
  const { theme } = useTheme();
  const pendingTotal = pending.reduce((a, p) => a + p.amount, 0);
  const empty = pending.length === 0 && recent.length === 0;

  return (
    <BentoTile>
      <View className="flex-row items-center justify-between">
        <Text className="font-semibold text-emph tracking-tight text-fg">
          {t("Banka ödemeleri")}
        </Text>
        <Text className="font-mono-medium text-eyebrow tracking-wide text-fg3">
          {pending.length > 0 ? `${t("BEKLEYEN")} · ${fmt(pendingTotal)}` : ""}
        </Text>
      </View>

      {empty ? (
        <>
          <Text className="py-tilePad font-mono-medium text-eyebrow tracking-wide text-fg3">
            {loading ? t("YÜKLENİYOR…") : t("ÖDEME KAYDI YOK")}
          </Text>
          {!loading ? (
            <Text className="text-meta leading-[18px] text-fg3">
              {t(
                "Stripe veya App Store Connect bağlayın; eşik altında devreden bakiyeleri elle de girebilirsiniz.",
              )}
            </Text>
          ) : null}
        </>
      ) : (
        <>
          {pending.map((p, i) => (
            <PayoutRow
              key={`p-${p.source}-${p.period ?? p.arrival_date ?? i}`}
              row={p}
              fmt={fmt}
              tone={theme.fg2}
            />
          ))}
          {pending.length > 0 && recent.length > 0 ? (
            <Text className="pt-rowY font-mono-medium text-eyebrow tracking-wide text-fg3">
              {t("GEÇMİŞ")}
            </Text>
          ) : null}
          {recent.map((p, i) => (
            <PayoutRow
              key={`r-${p.source}-${p.period ?? p.arrival_date ?? i}`}
              row={p}
              fmt={fmt}
              tone={p.status === "paid" ? theme.pos : theme.fg2}
            />
          ))}
        </>
      )}
    </BentoTile>
  );
}
