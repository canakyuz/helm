import { View, Text } from "react-native";

import { formatInteger } from "~/lib/format";
import { colors } from "~/theme/tokens";

type Props = {
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

const STARS = [5, 4, 3, 2, 1] as const;
const BAR_HEIGHT = 8;

export function RatingHistogram({ distribution }: Props) {
  const max = Math.max(...STARS.map((s) => distribution[s]), 1);

  return (
    <View style={{ gap: 6 }}>
      {STARS.map((star) => {
        const count = distribution[star];
        const widthPct = (count / max) * 100;
        const color =
          star === 5
            ? colors.accent
            : star === 4
            ? colors.accentSoft
            : star === 3
            ? colors.accentInfo
            : star === 2
            ? colors.accentWarn
            : colors.accentDanger;

        return (
          <View
            key={star}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Text
              style={{
                fontFamily: "GeistMono-600",
                fontSize: 10,
                color: colors.fgMuted,
                width: 12,
                textAlign: "center",
              }}
            >
              {star}
            </Text>
            <View
              style={{
                flex: 1,
                height: BAR_HEIGHT,
                backgroundColor: colors.bgHigher,
                borderRadius: BAR_HEIGHT / 2,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${widthPct}%`,
                  height: "100%",
                  backgroundColor: color,
                  borderRadius: BAR_HEIGHT / 2,
                }}
              />
            </View>
            <Text
              style={{
                fontFamily: "GeistMono-500",
                fontSize: 10,
                color: colors.fgSecondary,
                width: 36,
                textAlign: "right",
                fontVariant: ["tabular-nums"],
              }}
            >
              {formatInteger(count)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
