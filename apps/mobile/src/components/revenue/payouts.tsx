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
// Cumle duzeni: satirin ikinci satirinda govde metni gibi okunur; buyuk harf
// orada hem yer yiyor hem de TAHMIN isaretiyle ayni sesi cikariyordu.
const STATUS_LABEL: Record<string, string> = {
  carried_forward: "Devredildi",
  pending_fiscal_close: "Dönem kapanmadı",
  threshold_reached: "Eşik aşıldı",
  pending: "Bekliyor",
  in_transit: "Yolda",
  paid: "Ödendi",
  failed: "Başarısız",
  canceled: "İptal edildi",
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

/**
 * Iki satir: ust satir "ne + ne kadar", alt satir "ne zaman + neden".
 * Eskiden tarih 54px'lik sabit bir sutundaydi; "21–26 Eyl" iki satira kiriliyor,
 * TAHMIN isareti de tutarin ustune tasiyordu. Tarih alt satira inince kaynak
 * adi tum genisligi aliyor ve tutar sutunu hep ayni hizada kaliyor.
 */
function PayoutRow({
  row,
  fmt,
  tone,
  showEstimate,
}: {
  row: Row;
  fmt: (n: number) => string;
  tone: string;
  /** Baslik zaten "hepsi tahmin" diyorsa satirda tekrarlanmaz. */
  showEstimate: boolean;
}) {
  const t = useT();
  const { theme } = useTheme();
  const status = row.status != null ? t(STATUS_LABEL[row.status] ?? row.status) : null;

  return (
    <View className="border-t border-line py-rowY">
      <View className="flex-row items-baseline">
        <Text
          className="mr-rowY min-w-0 flex-1 font-medium text-row tracking-tight text-fg"
          numberOfLines={1}
        >
          {SOURCE_LABEL[row.source] ?? row.source}
          {row.period != null ? ` · ${shortPeriod(row.period)}` : ""}
        </Text>
        <Text className="font-mono-semibold text-row" style={{ color: tone }}>
          {fmt(row.amount)}
        </Text>
      </View>
      <View className="mt-xs flex-row items-center">
        <Text className="mr-rowY min-w-0 flex-1 text-meta text-fg3" numberOfLines={1}>
          <Text className="font-mono-medium">
            {windowLabel(row.arrival_date, row.arrival_end)}
          </Text>
          {status != null ? `  ·  ${status}` : ""}
        </Text>
        {/* Tahmin oldugu SAKLANMAZ - gerceklesmis odeme gibi gostermek kokpitte
            en pahali yalandir. Tutarin hemen altina hizali: neyin tahmin oldugu
            belirsiz kalmaz. warn tonu sistemde "gercek olmayan veri" isareti. */}
        {showEstimate && row.estimated === true ? (
          <Text
            className="font-mono-medium text-eyebrow tracking-wide"
            style={{ color: theme.warn }}
          >
            {t("TAHMİN")}
          </Text>
        ) : null}
      </View>
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
  // Bekleyenlerin HEPSI tahminse isaret bir kez, toplamin yaninda durur: ayni
  // sari etiketi bes satirda tekrarlamak sinyal degil gurultu. Karisiksa satir
  // bazinda kalir. O(n), n = bekleyen satir sayisi.
  const allPendingEstimated = pending.length > 0 && pending.every((p) => p.estimated === true);

  return (
    <BentoTile>
      <Text className="font-semibold text-emph tracking-tight text-fg">
        {t("Banka ödemeleri")}
      </Text>

      {/* Kartin asil sorusu "bankaya ne kadar gelecek" - eskiden 10px gri
          eyebrow'daydi. MiniTile ile ayni etiket-ustte / rakam-altta dizilim. */}
      {pending.length > 0 ? (
        <View className="mb-rowY mt-sm">
          <Text className="font-mono-medium text-eyebrow tracking-wide text-fg3">
            {t("BEKLEYEN")}
            {allPendingEstimated ? (
              <Text style={{ color: theme.warn }}>{`  ·  ${t("TAHMİN")}`}</Text>
            ) : null}
          </Text>
          <Text
            className="mt-xs font-semibold text-statSm tracking-tighter text-fg"
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {fmt(pendingTotal)}
          </Text>
        </View>
      ) : null}

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
          {/* Index key'in PARCASI, yedegi degil: ayni kaynak+donem iki satir olabilir
              (senkron + elle girilen devir), yalniz donemle key cakisiyordu. */}
          {pending.map((p, i) => (
            <PayoutRow
              key={`p-${p.source}-${p.period ?? p.arrival_date ?? "na"}-${i}`}
              row={p}
              fmt={fmt}
              tone={theme.fg}
              showEstimate={!allPendingEstimated}
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
              showEstimate
            />
          ))}
        </>
      )}
    </BentoTile>
  );
}
