import { Text, View } from "react-native";
import { press, space, type Theme } from "@helm/design";
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

/** Ozet'in uc kucuk stat kutusu — delta isaretiyle. */
export function StatTile({
  index,
  replayKey,
  label,
  value,
  delta,
}: {
  index: number;
  replayKey: number;
  label: string;
  value: string;
  delta: number | null | undefined;
}) {
  const { theme } = useTheme();
  const hasDelta = delta != null && Number.isFinite(delta);
  // Yuvarlandiginda sifira dusen degisim "degismedi" demektir — "+0.0%" yazmak
  // yanlis bir yon ima eder. Notr renkte, isaretsiz gosterilir. Esik
  // formatDelta ile ORTAK (isFlatDelta): renk ve metin ayrisamaz.
  const flat = hasDelta && isFlatDelta(delta);
  const positive = (delta ?? 0) >= 0;

  return (
    <Rise index={index} replayKey={replayKey} style={{ flex: 1 }}>
      {/* `flex: 1` — tile ESNETILMIS kapsayicisini doldursun diye. Rise satir
          icinde en uzun kardese gore uzuyordu ama tile kendi icerik
          yuksekliginde kaliyordu: uzun bir deger (₺2,338.66) adjustsFontSizeToFit
          ile kuculunce o kartin govdesi de kisaliyor, uc kartin ALT kenari
          ayrisiyordu. Ust kenari `transparent` delta metni hizaliyor, alt
          kenari bu. */}
      <BentoTile padding={space.tilePadSm} style={{ flex: 1 }}>
        <Text className="font-mono-medium text-eyebrow tracking-wide text-fg3">
          {label}
        </Text>
        <Text
          className="mt-sm font-semibold text-stat tracking-tightest text-fg"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value}
        </Text>
        {/* Delta yoksa da AYNI Text render edilir, sadece seffaf. Onceki hal
            sabit `h-[13px]` bir View koyuyordu; gercek satir yuksekligi font
            metriginden geliyor ve 13px degil — bu yuzden delta'si olmayan kart
            (CRASH) komsulariyla hizasiz duruyordu. Ayni dugum = ayni yukseklik. */}
        <Text
          className="mt-[6px] font-mono-medium text-[11px]"
          style={{
            color: !hasDelta
              ? "transparent"
              : flat
                ? theme.fg3
                : positive
                  ? theme.pos
                  : theme.neg,
          }}
          accessibilityElementsHidden={!hasDelta}
          importantForAccessibility={hasDelta ? "auto" : "no-hide-descendants"}
        >
          {hasDelta ? formatDelta(delta) : "0.0%"}
        </Text>
      </BentoTile>
    </Rise>
  );
}

/** Kucuk aksiyon butonu — accent veya notr dolgu. */
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
