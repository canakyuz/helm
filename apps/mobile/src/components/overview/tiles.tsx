import { Text, View } from "react-native";
import { press, space, type, type Theme } from "@helm/design";
import type { AlertSeverity } from "@helm/api";

import { formatDelta, isFlatDelta } from "~/lib/format";
import { useTheme } from "~/theme/use-theme";
import { BentoTile, Rise } from "~/components/bento";

/** Uyari siddetine gore sol kenar rengi. Tasarim tek kirmizi kullaniyordu;
 *  elimizde gercek siddet var, onu gostermemek bilgi saklamak olurdu. */
function SEVERITY_COLOR(theme: Theme, severity: AlertSeverity): string {
  if (severity === "critical") return theme.neg;
  if (severity === "warn") return theme.warn;
  return theme.blue;
}

/**
 * Uc stat kutusunun ORTAK rakam boyutu.
 *
 * NEDEN GEREKLI: her kutu kendi basina `adjustsFontSizeToFit` ile kuculuyordu.
 * Tile ic genisligi ~97pt; "₺2,340.78" 28pt'e sigmadigi icin ~18pt'e dusuyor,
 * "405" ise 28pt kaliyordu - ayni satirda 1.6 kat boy farki. Uc esit kutu
 * birbirinden farkli tipografiyle okununca satirin ritmi bozuluyor.
 *
 * Boyut EN UZUN degere gore secilir ve ucune de verilir. Esik degerleri
 * simulatorde olculdu (iPhone 17 Pro Max, 3 sutun, tilePadSm).
 */
export function statFontSize(values: readonly string[]): number {
  const longest = values.reduce((n, v) => Math.max(n, v.length), 0);
  if (longest <= 4) return type.stat;
  if (longest <= 5) return 26;
  if (longest <= 6) return 24;
  if (longest <= 7) return 22;
  if (longest <= 8) return 20;
  return 18;
}

/** Ozet'in uc kucuk stat kutusu - delta isaretiyle. */
export function StatTile({
  index,
  replayKey,
  label,
  value,
  delta,
  fontSize = type.stat,
  note,
}: {
  index: number;
  replayKey: number;
  label: string;
  value: string;
  delta: number | null | undefined;
  /** Satirdaki uc kutunun ORTAK boyutu - statFontSize() ile hesaplanir. */
  fontSize?: number;
  /** Delta yerine gosterilecek kisa aciklama (olcum yoksa). Kutu bos kalmasin:
   *  delta yuvasi seffaf birakilinca kutu bozuk gorunuyordu, veri yok demiyordu. */
  note?: string | undefined;
}) {
  const { theme } = useTheme();
  const hasDelta = delta != null && Number.isFinite(delta);
  // Yuvarlandiginda sifira dusen degisim "degismedi" demektir - "+0.0%" yazmak
  // yanlis bir yon ima eder. Notr renkte, isaretsiz gosterilir. Esik
  // formatDelta ile ORTAK (isFlatDelta): renk ve metin ayrisamaz.
  const flat = hasDelta && isFlatDelta(delta);
  const positive = (delta ?? 0) >= 0;

  return (
    <Rise index={index} replayKey={replayKey} style={{ flex: 1 }}>
      {/* `flex: 1` - tile ESNETILMIS kapsayicisini doldursun diye. Rise satir
          icinde en uzun kardese gore uzuyordu ama tile kendi icerik
          yuksekliginde kaliyordu: uzun bir deger (₺2,338.66) adjustsFontSizeToFit
          ile kuculunce o kartin govdesi de kisaliyor, uc kartin ALT kenari
          ayrisiyordu. Ust kenari `transparent` delta metni hizaliyor, alt
          kenari bu. */}
      <BentoTile padding={space.tilePadSm} style={{ flex: 1 }}>
        <Text className="font-mono-medium text-eyebrow tracking-wide text-fg3">
          {label}
        </Text>
        {/* adjustsFontSizeToFit KALDIRILDI: satir boyu artik statFontSize ile
            disaridan geliyor. Birakilsaydi tek bir kutu yine kendi basina
            kuculup komsularindan ayrilabilirdi. */}
        <Text
          className="mt-sm font-semibold tracking-tightest text-fg"
          style={{ fontSize, lineHeight: Math.round(fontSize * 1.15) }}
          numberOfLines={1}
        >
          {value}
        </Text>
        {/* Delta yoksa NOT gosterilir; not da yoksa AYNI dugum seffaf kalir.
            Sabit `h-[13px]` bir View koymak yanlisti: gercek satir yuksekligi
            font metriginden geliyor ve 13px degil, o yuzden delta'si olmayan
            kart komsulariyla hizasiz duruyordu. Ayni dugum = ayni yukseklik. */}
        <Text
          className="mt-[6px] font-mono-medium text-[11px]"
          numberOfLines={1}
          style={{
            color: hasDelta
              ? flat
                ? theme.fg3
                : positive
                  ? theme.pos
                  : theme.neg
              : note != null
                ? theme.fg3
                : "transparent",
          }}
          accessibilityElementsHidden={!hasDelta && note == null}
          importantForAccessibility={
            hasDelta || note != null ? "auto" : "no-hide-descendants"
          }
        >
          {hasDelta ? formatDelta(delta) : (note ?? "0.0%")}
        </Text>
      </BentoTile>
    </Rise>
  );
}

/** Kucuk aksiyon butonu - accent veya notr dolgu. */
export function Pill({
  label,
  background,
  color,
  onPress,
}: {
  label: string;
  background: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Text
      onPress={onPress}
      suppressHighlighting
      className="rounded-btn px-[18px] py-[9px] font-semibold text-meta"
      style={{ backgroundColor: background, color }}
    >
      {label}
    </Text>
  );
}

export { SEVERITY_COLOR };
