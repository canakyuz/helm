import { type ReactNode } from "react";
import { Text, View } from "react-native";

import { colors } from "~/theme/tokens";
import { AreaChart, Ring } from "~/components/liquid/charts";
import { CountUp, Delta, Eyebrow } from "~/components/liquid/primitives";

const MONO_600 = "GeistMono-600";

export type HeroStat = {
  label: string;
  value: string;
  delta?: number | undefined;
  invert?: boolean | undefined;
};

export function Sep() {
  return (
    <View
      style={{
        width: 1,
        alignSelf: "stretch",
        marginHorizontal: 2,
        backgroundColor: "rgba(255,255,255,0.08)",
      }}
    />
  );
}

export function MiniStat({ label, value, delta, invert }: HeroStat) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Eyebrow size={9}>{label}</Eyebrow>
      <Text style={{ fontFamily: MONO_600, fontSize: 16, color: colors.fgPrimary, letterSpacing: -0.3 }}>
        {value}
      </Text>
      {delta != null ? <Delta value={delta} size={10} invert={invert ?? false} /> : null}
    </View>
  );
}

export function OpenHero({
  eyebrow,
  live = false,
  right,
  value,
  format,
  delta,
  deltaInvert,
  caption,
  chartWidth,
  chartData,
  chartEl,
  color = colors.accent,
  chartH = 96,
  stats,
  ring,
}: {
  eyebrow: string;
  live?: boolean;
  right?: ReactNode;
  value: number;
  format: (n: number) => string;
  delta?: number;
  deltaInvert?: boolean;
  caption?: string;
  chartWidth: number;
  chartData?: number[];
  chartEl?: ReactNode;
  color?: string;
  chartH?: number;
  stats?: HeroStat[];
  ring?: { value: number; color: string };
}) {
  return (
    <View style={{ paddingHorizontal: 6, paddingTop: 2 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: 24,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {live ? (
            <View style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: colors.accent }} />
          ) : null}
          <Eyebrow color={live ? colors.accent : colors.fgMuted}>{eyebrow}</Eyebrow>
        </View>
        {right}
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 14,
          marginTop: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
            <CountUp
              value={value}
              format={format}
              style={{
                fontFamily: MONO_600,
                fontSize: ring ? 46 : 56,
                lineHeight: ring ? 50 : 60,
                letterSpacing: -2,
                color: colors.fgPrimary,
              }}
            />
            {delta != null ? (
              <View style={{ marginBottom: ring ? 6 : 9 }}>
                <Delta value={delta} size={13} invert={deltaInvert ?? false} />
              </View>
            ) : null}
          </View>
          {caption ? (
            <View style={{ marginTop: 9 }}>
              <Eyebrow color={colors.fgMuted}>{caption}</Eyebrow>
            </View>
          ) : null}
        </View>
        {ring ? (
          <Ring value={ring.value} size={82} stroke={8} color={ring.color}>
            <Text style={{ fontFamily: MONO_600, fontSize: 16, color: colors.fgPrimary }}>
              {ring.value}%
            </Text>
          </Ring>
        ) : null}
      </View>

      {chartEl ? (
        <View style={{ marginTop: 16 }}>{chartEl}</View>
      ) : chartData ? (
        <View style={{ marginTop: 16 }}>
          <AreaChart data={chartData} width={chartWidth} height={chartH} color={color} />
        </View>
      ) : null}

      {stats ? (
        <View
          style={{
            flexDirection: "row",
            marginTop: 16,
            paddingTop: 14,
            borderTopWidth: 1,
            borderTopColor: "rgba(255,255,255,0.08)",
          }}
        >
          {stats.map((s, i) => (
            <View key={s.label} style={{ flex: 1, flexDirection: "row" }}>
              {i > 0 ? <Sep /> : null}
              <MiniStat {...s} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
