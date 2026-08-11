import { Text, View } from "react-native";
import { radius as R, space } from "@helm/design";
import type { PerfRow, PlatformRow } from "@helm/api";

import { formatInteger } from "~/lib/format";
import { useTheme } from "~/theme/use-theme";
import { BentoTile } from "~/components/bento";

/** fps eşikleri — 60 hedef, 45 altı hissedilir, 30 altı kırık. */
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
 * soylemez — birkac saniyelik takilma ortalamada kaybolur. Alt %5 ve gorulen en
 * kotu olcum, kullanicinin gercekten hissettigi seydir.
 */
export function PerfTile({ rows }: { rows: readonly PerfRow[] }) {
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
        <Empty label="FPS ÖLÇÜMÜ YOK" />
      ) : (
        <View className="mt-tilePadSm" style={{ gap: 10 }}>
          {rows.map((r) => (
            <View key={r.key} className="rounded-inner bg-tile2 p-boxPad">
              <Text className="font-mono-medium text-eyebrow tracking-wide text-fg3">
                {(PERF_LABEL[r.key] ?? r.key).toLocaleUpperCase("tr-TR")}
              </Text>
              <View className="mt-sm flex-row items-baseline" style={{ gap: 16 }}>
                <Stat label="ortanca" value={r.p50} color={tone(r.p50)} />
                <Stat label="alt %5" value={r.p05} color={tone(r.p05)} />
                <Stat label="en kötü" value={r.worst} color={tone(r.worst)} />
              </View>
            </View>
          ))}
        </View>
      )}
    </BentoTile>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View>
      <Text className="font-semibold text-statSm tracking-tighter" style={{ color }}>
        {value}
      </Text>
      <Text className="font-mono-medium text-eyebrow tracking-wide text-fg3">
        {label.toLocaleUpperCase("tr-TR")}
      </Text>
    </View>
  );
}

/** Platform kirilimi — sorunun her yerde mi tek platformda mi oldugunu soyler. */
export function PlatformTile({ rows }: { rows: readonly PlatformRow[] }) {
  const { theme, glass } = useTheme();
  const total = rows.reduce((a, r) => a + r.events, 0);

  return (
    <BentoTile>
      <Text className="font-semibold text-emph tracking-tight text-fg">Platformlar</Text>
      {rows.length === 0 ? (
        <Empty label="PLATFORM VERİSİ YOK" />
      ) : (
        <View className="mt-tilePadSm" style={{ gap: 12 }}>
          {rows.map((r) => (
            <View key={r.platform}>
              <View className="flex-row items-baseline justify-between">
                <Text className="font-medium text-row text-fg">{r.platform}</Text>
                <Text className="font-mono-semibold text-body text-fg2">
                  {formatInteger(r.events)}
                  <Text className="text-fg3">
                    {"  "}%{total > 0 ? Math.round((r.events / total) * 100) : 0}
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
 * hatasidir. Kullanici davranisiyla ayni kutuda gostermek yanlis karar aldirir —
 * "kullanicilar kaciyor" diye okunur, oysa olay hic gonderilmiyordur.
 */
export function InstrumentationTile({ warnings }: { warnings: readonly string[] }) {
  const { theme } = useTheme();
  if (warnings.length === 0) return null;

  return (
    <BentoTile>
      <View className="flex-row items-center justify-between">
        <Text className="font-semibold text-emph tracking-tight text-fg">
          Ölçüm şüpheli
        </Text>
        <Text
          className="font-mono-medium text-[11px]"
          style={{ color: theme.warn }}
        >
          {warnings.length}
        </Text>
      </View>
      <Text className="mt-[6px] text-meta leading-[18px] text-fg2">
        Aşağıdakiler kullanıcı davranışı değil, eksik veya hatalı olay gönderimi.
      </Text>
      <View className="mt-headerY" style={{ gap: space.rowY }}>
        {warnings.map((w) => (
          <View
            key={w}
            className="border-l-2 pl-headerY"
            style={{ borderLeftColor: theme.warn }}
          >
            <Text className="text-row text-fg">{w}</Text>
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
