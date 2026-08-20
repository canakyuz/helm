import { Text, View } from "react-native";
import { radius as R, space } from "@helm/design";
import type { PerfRow, PlatformRow } from "@helm/api";

import { formatInteger, formatRatio } from "~/lib/format";
import { useTheme } from "~/theme/use-theme";
import { BentoTile } from "~/components/bento";
import type { InstrumentationWarning } from "@helm/api";
import { useT } from "~/lib/i18n";
import { usePreferences } from "~/lib/preferences";

/** fps eşikleri - 60 hedef, 45 altı hissedilir, 30 altı kırık. */
const FPS_OK = 45;
const FPS_BAD = 30;

const PERF_LABEL: Record<string, string> = {
  fps_min: "En düşük fps",
  fps_p95_low: "p95 düşük fps",
};

/**
 * Performans karti.
 *
 * NEDEN ORTALAMA YOK: ortalama fps neredeyse her zaman 60 cikar ve hicbir sey
 * soylemez - birkac saniyelik takilma ortalamada kaybolur. Alt %5 ve gorulen en
 * kotu olcum, kullanicinin gercekten hissettigi seydir.
 */
export function PerfTile({ rows }: { rows: readonly PerfRow[] }) {
  const t = useT();
  const { language } = usePreferences();
  const { theme } = useTheme();

  const tone = (fps: number): string =>
    fps >= FPS_OK ? theme.pos : fps >= FPS_BAD ? theme.warn : theme.neg;

  return (
    <BentoTile>
      <View className="flex-row items-center justify-between">
        <Text className="font-semibold text-emph tracking-tight text-fg">Performans</Text>
        <Text className="font-mono-medium text-[11px] text-fg3">
          {rows.length > 0 ? `${formatInteger(rows[0]!.samples)} ÖLÇÜM` : ""}
        </Text>
      </View>

      {rows.length === 0 ? (
        <Empty label={t("FPS ÖLÇÜMÜ YOK")} />
      ) : (
        <View className="mt-tilePadSm" style={{ gap: 10 }}>
          {rows.map((r) => (
            <View key={r.key} className="rounded-inner bg-tile2 p-boxPad">
              <Text className="font-mono-medium text-eyebrow tracking-wide text-fg3">
                {t(PERF_LABEL[r.key] ?? r.key).toLocaleUpperCase(language === "tr" ? "tr-TR" : "en-US")}
              </Text>
              <View className="mt-sm flex-row items-baseline" style={{ gap: 16 }}>
                <Stat label="ortanca" value={r.p50} color={tone(r.p50)} />
                <Stat label="alt %5" value={r.p05} color={tone(r.p05)} />
                <Stat label={t("en kötü")} value={r.worst} color={tone(r.worst)} />
              </View>
            </View>
          ))}
        </View>
      )}
    </BentoTile>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  const { language } = usePreferences();
  return (
    <View>
      <Text className="font-semibold text-statSm tracking-tighter" style={{ color }}>
        {value}
      </Text>
      <Text className="font-mono-medium text-eyebrow tracking-wide text-fg3">
        {label.toLocaleUpperCase(language === "tr" ? "tr-TR" : "en-US")}
      </Text>
    </View>
  );
}

/** Platform kirilimi - sorunun her yerde mi tek platformda mi oldugunu soyler. */
export function PlatformTile({ rows }: { rows: readonly PlatformRow[] }) {
  const t = useT();
  const { theme, glass } = useTheme();
  const total = rows.reduce((a, r) => a + r.events, 0);

  return (
    <BentoTile>
      <Text className="font-semibold text-emph tracking-tight text-fg">{t("Platformlar")}</Text>
      {rows.length === 0 ? (
        <Empty label={t("PLATFORM VERİSİ YOK")} />
      ) : (
        <View className="mt-tilePadSm" style={{ gap: 12 }}>
          {rows.map((r) => (
            <View key={r.platform}>
              <View className="flex-row items-baseline justify-between">
                <Text className="font-medium text-row text-fg">{r.platform}</Text>
                <Text className="font-mono-semibold text-body text-fg2">
                  {formatInteger(r.events)}
                  <Text className="text-fg3">
                    {"  "}{formatRatio(total > 0 ? r.events / total : 0)}
                  </Text>
                </Text>
              </View>
              <View
                style={{
                  height: 6,
                  marginTop: 7,
                  borderRadius: R.pill,
                  backgroundColor: glass.chartDim,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: `${total > 0 ? (r.events / total) * 100 : 0}%`,
                    height: "100%",
                    borderRadius: R.pill,
                    backgroundColor: theme.blue,
                  }}
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </BentoTile>
  );
}

/**
 * Enstrümantasyon uyarilari.
 *
 * NEDEN AYRI KART: "oturumlarin %100'u kapanmiyor" bir urun bulgusu degil, olcum
 * hatasidir. Kullanici davranisiyla ayni kutuda gostermek yanlis karar aldirir -
 * "kullanicilar kaciyor" diye okunur, oysa olay hic gonderilmiyordur.
 */
export function InstrumentationTile({
  warnings,
}: {
  warnings: readonly InstrumentationWarning[];
}) {
  const t = useT();
  const { theme } = useTheme();
  if (warnings.length === 0) return null;

  return (
    <BentoTile>
      <View className="flex-row items-center justify-between">
        <Text className="font-semibold text-emph tracking-tight text-fg">
          {t("Ölçüm şüpheli")}
        </Text>
        <Text
          className="font-mono-medium text-[11px]"
          style={{ color: theme.warn }}
        >
          {warnings.length}
        </Text>
      </View>
      <Text className="mt-[6px] text-meta leading-[18px] text-fg2">
        {t("Aşağıdakiler kullanıcı davranışı değil, eksik veya hatalı olay gönderimi.")}
      </Text>
      <View className="mt-headerY" style={{ gap: space.rowY }}>
        {warnings.map((w) => (
          <View
            key={w.key}
            className="border-l-2 pl-headerY"
            style={{ borderLeftColor: theme.warn }}
          >
            <Text className="text-row text-fg">{t(w.key, w.vars)}</Text>
          </View>
        ))}
      </View>
    </BentoTile>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <Text className="py-tilePad font-mono-medium text-eyebrow tracking-wide text-fg3">
      {label}
    </Text>
  );
}
