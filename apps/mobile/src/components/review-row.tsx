import { View, Text } from "react-native";

import type { Review } from "~/hooks/use-reviews";
import { formatRelativeTime } from "~/lib/format";
import { colors } from "~/theme/tokens";

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <View style={{ flexDirection: "row", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text
          key={i}
          style={{
            fontSize: 11,
            color: i <= full ? colors.accentWarn : colors.fgSubtle,
            lineHeight: 13,
          }}
        >
          ★
        </Text>
      ))}
    </View>
  );
}

export function ReviewRow({ review }: { review: Review }) {
  const platformLabel = review.source === "appstore" ? "iOS" : "AND";
  const platformColor =
    review.source === "appstore" ? colors.accentInfo : colors.accent;

  return (
    <View
      style={{
        backgroundColor: colors.bgElevated,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
        gap: 8,
      }}
    >
      {/* Top — stars + platform chip + relative time */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Stars rating={review.rating} />
        <View
          style={{
            backgroundColor: `${platformColor}15`,
            borderWidth: 1,
            borderColor: `${platformColor}40`,
            paddingHorizontal: 6,
            paddingVertical: 1,
            borderRadius: 4,
          }}
        >
          <Text
            style={{
              fontFamily: "GeistMono-600",
              fontSize: 9,
              color: platformColor,
              letterSpacing: 1.2,
            }}
          >
            {platformLabel}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        {review.reviewDate ? (
          <Text
            style={{
              fontFamily: "GeistMono-500",
              fontSize: 9,
              color: colors.fgSubtle,
            }}
          >
            {formatRelativeTime(review.reviewDate)}
          </Text>
        ) : null}
      </View>

      {/* Title */}
      {review.title ? (
        <Text
          style={{
            fontFamily: "Geist-600",
            fontSize: 14,
            color: colors.fgPrimary,
            letterSpacing: -0.2,
          }}
          numberOfLines={1}
        >
          {review.title}
        </Text>
      ) : null}

      {/* Body */}
      {review.body ? (
        <Text
          style={{
            fontFamily: "Geist-400",
            fontSize: 13,
            color: colors.fgSecondary,
            lineHeight: 18,
          }}
          numberOfLines={4}
        >
          {review.body}
        </Text>
      ) : null}

      {/* Author */}
      {review.author ? (
        <Text
          style={{
            fontFamily: "GeistMono-500",
            fontSize: 10,
            color: colors.fgMuted,
            letterSpacing: 0.5,
          }}
        >
          — {review.author}
        </Text>
      ) : null}
    </View>
  );
}
