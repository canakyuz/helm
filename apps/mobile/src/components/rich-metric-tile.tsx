import { useMemo } from "react";
import { View, Text } from "react-native";
import {
  Canvas,
  RoundedRect,
  LinearGradient,
  vec,
  Group,
} from "@shopify/react-native-skia";

import { SparkLine } from "~/components/spark-line";
import { Icon } from "~/components/ui/icon";
import { useMetricDetail } from "~/hooks/use-metric-detail";
import { useFormatCurrency } from "~/hooks/use-format-currency";
import { formatInteger, formatDelta } from "~/lib/format";
import { colors } from "~/theme/tokens";
import { useT } from "~/lib/i18n";

type Props = {
  metric: string;
  label: string;
  isCurrency?: boolean;
  width: number;
  accent?: string;
};

const CARD_HEIGHT = 280;
const SPARK_HEIGHT = 56;
const CARD_RADIUS = 22;

export function RichMetricTile({
  metric,
  label,
  isCurrency = false,
  width,
  accent = colors.accent,
}: Props) {
  const t = useT();
  const fmt = useFormatCurrency();
  const { data, isLoading } = useMetricDetail(metric);

  const formatNumber = (v: number) =>
    isCurrency ? fmt(v) : formatInteger(v);

  const nowValue = isLoading ? "—" : formatNumber(data?.today ?? 0);

  const delta = useMemo(() => {
    if (!data || data.yesterday === 0) return null;
    return ((data.today - data.yesterday) / data.yesterday) * 100;
  }, [data]);

  const deltaPositive = (delta ?? 0) >= 0;
  const deltaColor = deltaPositive ? colors.accent : colors.accentDanger;

  return (
    <View
      style={{
        width,
        height: CARD_HEIGHT,
        borderRadius: CARD_RADIUS,
        overflow: "hidden",
      }}
    >
      <Canvas
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height: CARD_HEIGHT,
        }}
      >
        <Group>
          <RoundedRect x={0} y={0} width={width} height={CARD_HEIGHT} r={CARD_RADIUS}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(width, CARD_HEIGHT)}
              colors={[colors.bgElevated, colors.bgSurface]}
            />
          </RoundedRect>
          <RoundedRect x={0} y={0} width={width} height={CARD_HEIGHT} r={CARD_RADIUS}>
            <LinearGradient
              start={vec(width, 0)}
              end={vec(width * 0.3, CARD_HEIGHT * 0.7)}
              colors={[`${accent}28`, "transparent"]}
            />
          </RoundedRect>
        </Group>
      </Canvas>

      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: CARD_RADIUS,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />

      <View style={{ flex: 1, padding: 18, justifyContent: "space-between" }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: accent,
              }}
            />
            <Text
              style={{
                fontFamily: "GeistMono-600",
                fontSize: 10,
                letterSpacing: 2,
                color: colors.fgMuted,
              }}
            >
              NOW · {label.toUpperCase()}
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: `${accent}15`,
              paddingHorizontal: 6,
              paddingVertical: 2.5,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: `${accent}30`,
            }}
          >
            <View
              style={{
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: accent,
              }}
            />
            <Text
              style={{
                fontFamily: "GeistMono-600",
                fontSize: 8,
                letterSpacing: 1.5,
                color: accent,
              }}
            >
              LIVE
            </Text>
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.45}
            style={{
              fontFamily: "GeistMono-600",
              fontSize: 44,
              lineHeight: 48,
              letterSpacing: -1.5,
              color: colors.fgPrimary,
              fontVariant: ["tabular-nums"],
            }}
          >
            {nowValue}
          </Text>
          {delta !== null ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon
                name={deltaPositive ? "trendUp" : "trendDown"}
                size={12}
                color={deltaColor}
              />
              <Text
                style={{
                  fontFamily: "GeistMono-600",
                  fontSize: 12,
                  color: deltaColor,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {formatDelta(delta)}
              </Text>
              <Text
                style={{
                  fontFamily: "GeistMono-500",
                  fontSize: 10,
                  letterSpacing: 1,
                  color: colors.fgSubtle,
                }}
              >
                VS DÜN
              </Text>
            </View>
          ) : null}
        </View>

        {data && data.series.length > 1 ? (
          <SparkLine
            data={data.series}
            width={width - 36}
            height={SPARK_HEIGHT}
            color={accent}
          />
        ) : (
          <View style={{ height: SPARK_HEIGHT }} />
        )}

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: 12,
          }}
        >
          <PeriodCell
            label={t("DÜN")}
            value={data ? formatNumber(data.yesterday) : "—"}
          />
          <Divider />
          <PeriodCell
            label="BU AY"
            value={data ? formatNumber(data.thisMonth) : "—"}
          />
          <Divider />
          <PeriodCell
            label={t("GEÇEN AY")}
            value={data ? formatNumber(data.lastMonth) : "—"}
          />
        </View>
      </View>
    </View>
  );
}

function Divider() {
  return <View style={{ width: 1, backgroundColor: colors.border }} />;
}

function PeriodCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 3 }}>
      <Text
        style={{
          fontFamily: "GeistMono-500",
          fontSize: 9,
          letterSpacing: 1.5,
          color: colors.fgSubtle,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: "GeistMono-500",
          fontSize: 12,
          color: colors.fgSecondary,
          fontVariant: ["tabular-nums"],
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}
