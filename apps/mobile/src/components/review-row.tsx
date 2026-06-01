import { View, Text, Pressable } from "react-native";

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

interface ReviewRowProps {
  review: Review;
  onReply?: (review: Review) => void;
}

export function ReviewRow({ review, onReply }: ReviewRowProps) {
  const platformLabel = review.source === "appstore" ? "iOS" : "ANDROID";
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
        <Stars rating={review.rating ?? 0} />
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
        {review.review_date ? (
          <Text
            style={{
              fontFamily: "GeistMono-500",
              fontSize: 9,
              color: colors.fgSubtle,
            }}
          >
            {formatRelativeTime(review.review_date)}
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

      {/* Badges — source / version / territory */}
      <View style={{ flexDirection: "row", gap: 4, marginTop: 4 }}>
        <View style={{
          backgroundColor: colors.bgHigher,
          borderRadius: 4,
          paddingHorizontal: 6,
          paddingVertical: 2,
        }}>
          <Text style={{
            fontFamily: "GeistMono-600",
            fontSize: 9,
            color: colors.fgMuted,
            letterSpacing: 1,
          }}>
            {review.source === "appstore" ? "iOS" : "ANDROID"}
          </Text>
        </View>
        {review.app_version ? (
          <View style={{ backgroundColor: colors.bgHigher, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ fontFamily: "GeistMono-500", fontSize: 9, color: colors.fgMuted }}>
              v{review.app_version}
            </Text>
          </View>
        ) : null}
        {review.territory ? (
          <View style={{ backgroundColor: colors.bgHigher, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ fontFamily: "GeistMono-600", fontSize: 9, color: colors.fgMuted, letterSpacing: 1 }}>
              {review.territory.toUpperCase()}
            </Text>
          </View>
        ) : null}
      </View>

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

      {/* Reply block */}
      {review.developer_response ? (
        <View
          style={{
            marginTop: 8,
            borderLeftWidth: 2,
            borderLeftColor: colors.accent,
            paddingLeft: 10,
            paddingVertical: 6,
            backgroundColor: `${colors.accent}10`,
            borderRadius: 6,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "GeistMono-600",
                fontSize: 9,
                letterSpacing: 1,
                color: colors.accent,
              }}
            >
              YANIT
            </Text>
            <Pressable onPress={() => onReply?.(review)} hitSlop={6}>
              <Text
                style={{
                  fontFamily: "GeistMono-500",
                  fontSize: 10,
                  color: colors.accentInfo,
                }}
              >
                DÜZENLE
              </Text>
            </Pressable>
          </View>
          <Text
            style={{
              fontFamily: "Geist-400",
              fontSize: 13,
              color: colors.fgPrimary,
              marginTop: 4,
            }}
          >
            {review.developer_response}
          </Text>
        </View>
      ) : review.source_method !== "rss" ? (
        <Pressable
          onPress={() => onReply?.(review)}
          style={{
            marginTop: 8,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 8,
            paddingVertical: 6,
            paddingHorizontal: 12,
            alignSelf: "flex-start",
          }}
          hitSlop={4}
        >
          <Text
            style={{
              fontFamily: "Geist-500",
              fontSize: 12,
              color: colors.fgPrimary,
            }}
          >
            Yanıtla
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
