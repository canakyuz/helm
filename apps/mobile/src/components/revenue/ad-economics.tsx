import type { AdEconomics } from "@helm/api";

import { formatInteger, formatRatio } from "~/lib/format";
import { FunnelTile, type FunnelRow } from "~/components/analytics";

/**
 * Reklam ekonomisi — hangi format kazandiriyor.
 *
 * NEDEN GEREKLI: gelirin buyuk kismi reklamdan geliyor ama ekranda tek satir
 * ("Reklam ₺340.71") olarak duruyordu. Olculdu (6-13 Agustos): `rewarded`
 * gosterimlerin %15'ini alip gelirin %77'sini uretirken `banner` tersini
 * yapiyor. Tek sayiyla bu gorunmuyor, dolayisiyla hangi tarafa yatirim
 * yapilacagi da bilinmiyordu.
 *
 * NEDEN KENDI CUBUGUNU CIZMIYOR: FunnelTile zaten etiket/deger/oran/not
 * cizen genel bir liste (Saglik'ta huni olmayan "Reklam arizasi" icin de
 * kullaniliyor). Dorduncu bir cubuk uygulamasi yazmak ayni seyin dorduncu
 * kez ayrisan hali olurdu.
 *
 * CUBUK NEYI GOSTERIR: gelir PAYI — doluluk veya eCPM degil. Sorunun cevabi
 * "param nereden geliyor"; cubuk onu gosterir, kalan olculer notta durur.
 */
export function AdEconomicsTile({
  data,
  loading,
  error,
  fmt,
  replayKey = 0,
}: {
  data: AdEconomics | undefined;
  loading: boolean;
  /** Sorgu hatasi. Yutulmaz: veri gelmiyorsa ekran bunu SOYLEMELI — sessizce
   *  bos gorunen bir gelir karti "reklam geliri yok" diye okunur. */
  error?: Error | null;
  /** Tutarlar USD normalize gelir; gosterim secili para birimine cevrilir. */
  fmt: (n: number) => string;
  replayKey?: number;
}) {
  const rows: FunnelRow[] = (data?.rows ?? []).map((r) => ({
    label: r.label,
    value: fmt(r.revenue),
    ratio: r.revenueShare ?? 0,
    note: [
      r.ecpm != null ? `eCPM ${fmt(r.ecpm)}` : null,
      r.fillRate != null ? `doluluk ${formatRatio(r.fillRate)}${r.lowFill ? " ⚠" : ""}` : null,
      `${formatInteger(r.impressions)} gösterim`,
    ]
      .filter((s): s is string => s != null)
      .join(" · "),
    // Dusuk doluluk = masada kalmis para. "loss" (kirmizi) degil "warn":
    // kayip degil, kacirilmis firsat — ikisini ayni renge boyamak siddet
    // sinyalini duzlestirirdi.
    tone: r.lowFill ? "warn" : "normal",
  }));

  // Baslik sagi: TUM formatlar birlikte. Satir eCPM'lerinin ortalamasi DEGIL —
  // oranlarin ortalamasi oran degildir; toplanmis gelir/gosterimden geliyor.
  const summary =
    data == null
      ? undefined
      : [
          data.blendedEcpm != null ? `eCPM ${fmt(data.blendedEcpm)}` : null,
          data.overallFillRate != null
            ? `DOLULUK ${formatRatio(data.overallFillRate)}`
            : null,
        ]
          .filter((s): s is string => s != null)
          .join(" · ") || undefined;

  return (
    <FunnelTile
      title="Reklam ekonomisi"
      count={summary}
      rows={rows}
      empty={
        error != null
          ? `OKUNAMADI · ${error.message}`
          : loading
            ? "YÜKLENİYOR…"
            : "FORMAT KIRILIMI YOK"
      }
      replayKey={replayKey}
    />
  );
}
