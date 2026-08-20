import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { duration, EASE_OUT, radius as R, space, stagger } from "@helm/design";

import { useTheme } from "~/theme/use-theme";
import { BentoTile } from "~/components/bento";

const ease = Easing.bezier(...EASE_OUT);

export type FunnelRow = {
  label: string;
  /** Sagda gosterilen ham deger. */
  value: string;
  /** Cubuk dolulugu, 0–1. */
  ratio: number;
  /** İkincil satır - kayıp oranı, uyarı vb. */
  note?: string | undefined;
  /** "loss" kirmizi cubuk: bu adim kayip anlamina geliyor. */
  tone?: "normal" | "loss" | "warn" | undefined;
};

/**
 * Huni karti - adimlar ve dolgu oranlari.
 *
 * NEDEN YUZDE DEGIL ORAN CUBUGU: "%47" okunur ama karsilastirilmaz; yan yana
 * cubuklar hangi adimda ne kadar kaybettigini tek bakista gosterir. Ham sayi
 * yine sagda duruyor - cubuk hikaye, sayi kanit.
 */
export function FunnelTile({
  title,
  count,
  rows,
  empty,
  replayKey = 0,
  index = 0,
}: {
  title: string;
  count?: string | undefined;
  rows: readonly FunnelRow[];
  empty: string;
  replayKey?: number | undefined;
  index?: number | undefined;
}) {
  return (
    <BentoTile>
      <View className="flex-row items-center justify-between">
        <Text className="font-semibold text-emph tracking-tight text-fg">{title}</Text>
        {count != null ? (
          <Text className="font-mono-medium text-[11px] text-fg3">{count}</Text>
        ) : null}
      </View>

      {rows.length === 0 ? (
        <Text className="py-tilePad font-mono-medium text-eyebrow tracking-wide text-fg3">
          {empty}
        </Text>
      ) : (
        <View className="mt-tilePadSm" style={{ gap: 14 }}>
          {/* Not satiri TILE BAZINDA ya hep ya hic. Satirlarin bir kismi notlu
              bir kismi notsuz oldugunda yukseklikler ayrisiyor (Saglik'ta
              hatasiz satirlar tek, hatalilar iki satirdi); ama HIC notu olmayan
              bir huni icin de her satira bos satir ayirmak 9 satirda ~126px
              olu bosluk demek. Karar satira degil kartin tamamina bakar. */}
          {rows.map((r, i) => (
            <Step
              key={r.label}
              row={r}
              index={index + i}
              replayKey={replayKey}
              reserveNote={rows.some((x) => x.note != null)}
            />
          ))}
        </View>
      )}
    </BentoTile>
  );
}

function Step({
  row,
  index,
  replayKey,
  reserveNote,
}: {
  row: FunnelRow;
  index: number;
  replayKey: number;
  reserveNote: boolean;
}) {
  const { theme, glass } = useTheme();
  const fill = useSharedValue(0);
  const noMotion = useReducedMotion();

  useEffect(() => {
    fill.value = 0;
    fill.value = withDelay(
      60 + index * stagger.rail,
      withTiming(1, { duration: noMotion ? 0 : duration.rail, easing: ease }),
    );
  }, [index, replayKey, noMotion, fill]);

  const animated = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));

  // Oran 1'i asarsa bu bir OLCUM HATASI, basari degil ("63 bitis / 60 baslangic").
  // Kirpma sessizce yapiliyordu ve sonuc gercek bir 5/5 ile ayni dolu accent
  // cubuk oluyordu - ustelik ayni ekranin ust karti bunu "olcum supheli" diye
  // hata sayiyor. Tek ekranda iki celisen ifade kalmasin diye warn'a doner.
  const overflow = row.ratio > 1;

  const barColor = overflow
    ? theme.warn
    : row.tone === "loss"
      ? theme.neg
      : row.tone === "warn"
        ? theme.warn
        : theme.accent;

  return (
    <View>
      <View className="flex-row items-baseline justify-between">
        <Text className="flex-1 font-medium text-row text-fg" numberOfLines={1}>
          {row.label}
        </Text>
        <Text
          className="ml-rowY font-mono-semibold text-body"
          style={{ color: overflow ? theme.warn : theme.fg2 }}
        >
          {row.value}
          {overflow ? " ⚠" : ""}
        </Text>
      </View>

      <View
        style={{
          height: 6,
          borderRadius: R.pill,
          backgroundColor: glass.chartDim,
          marginTop: 7,
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={[
            {
              width: `${Math.max(0, Math.min(1, row.ratio)) * 100}%`,
              height: "100%",
              borderRadius: R.pill,
              backgroundColor: barColor,
              transformOrigin: "left",
            },
            animated,
          ]}
        />
      </View>

      {/* Kart icinde en az bir notlu satir varsa TUM satirlar not satirini
          ayirir (bos olsa bile) - yoksa yukseklikler ayrisir. Hicbir satirda
          not yoksa satir hic basilmaz. */}
      {reserveNote ? (
        <Text
          className="mt-[5px] text-meta"
          style={{
            color: overflow ? theme.warn : row.tone === "loss" ? theme.neg : theme.fg3,
          }}
        >
          {row.note ?? ""}
        </Text>
      ) : null}
    </View>
  );
}

/** İki değerli satır - sol etiket, sağ değer. Huni olmayan listeler için. */
export function KeyRow({
  label,
  value,
  tone,
  first,
}: {
  label: string;
  value: string;
  tone?: "normal" | "neg" | "pos" | undefined;
  first?: boolean | undefined;
}) {
  const { theme } = useTheme();
  const color = tone === "neg" ? theme.neg : tone === "pos" ? theme.pos : theme.fg2;

  return (
    <View
      className="flex-row items-center justify-between"
      style={{
        paddingVertical: space.rowY,
        ...(first ? {} : { borderTopWidth: 1, borderTopColor: theme.line }),
      }}
    >
      <Text className="mr-rowY flex-1 font-medium text-row text-fg" numberOfLines={1}>
        {label}
      </Text>
      <Text className="font-mono-semibold text-body" style={{ color }}>
        {value}
      </Text>
    </View>
  );
}
