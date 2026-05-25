import { useMemo, useState } from "react";
import { View, Text, RefreshControl, ScrollView } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  useReviews,
  type PlatformFilter,
  type RatingFilter,
} from "~/hooks/use-reviews";
import { ReviewRow } from "~/components/review-row";
import { RatingHistogram } from "~/components/rating-histogram";
import { SegmentedControl } from "~/components/segmented-control";
import { FilterChip } from "~/components/filter-chip";
import { ScreenStatus } from "~/components/screen-status";
import { EmptyState } from "~/components/empty-state";
import { formatInteger } from "~/lib/format";
import { colors } from "~/theme/tokens";

export default function Reviews() {
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [rating, setRating] = useState<RatingFilter>("all");
  const reviews = useReviews(platform, rating);

  const segments = useMemo(
    () =>
      [
        { value: "all" as const, label: "Tümü", count: reviews.data?.total ?? 0 },
        {
          value: "appstore" as const,
          label: "iOS",
          count: reviews.data?.appstoreCount ?? 0,
        },
        {
          value: "playstore" as const,
          label: "Android",
          count: reviews.data?.playstoreCount ?? 0,
        },
      ] satisfies Array<{
        value: PlatformFilter;
        label: string;
        count: number;
      }>,
    [reviews.data],
  );

  if (reviews.isLoading) return <ScreenStatus label="Yükleniyor" />;
  if (reviews.isError) {
    return <ScreenStatus label="Reviews yüklenemedi" tone="danger" />;
  }

  const data = reviews.data;
  if (!data) return <ScreenStatus label="Veri yok" />;

  const avgRounded = data.average.toFixed(2);

  return (
    <SafeAreaView
      edges={[]}
      style={{ flex: 1, backgroundColor: colors.bgBase }}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 96 }}
        refreshControl={
          <RefreshControl
            tintColor={colors.fgPrimary}
            refreshing={reviews.isRefetching}
            onRefresh={reviews.refetch}
          />
        }
      >
        {/* Platform segmented */}
        <SegmentedControl
          segments={segments}
          active={platform}
          onChange={setPlatform}
        />

        {/* Hero — avg rating + distribution */}
        <View
          style={{
            backgroundColor: colors.bgElevated,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 18,
            flexDirection: "row",
            gap: 18,
          }}
        >
          {/* Sol: büyük avg */}
          <View
            style={{
              justifyContent: "space-between",
              alignItems: "flex-start",
              minWidth: 110,
            }}
          >
            <Text
              style={{
                fontFamily: "GeistMono-600",
                fontSize: 10,
                letterSpacing: 2,
                color: colors.fgMuted,
              }}
            >
              ORTALAMA
            </Text>
            <Text
              style={{
                fontFamily: "GeistMono-600",
                fontSize: 44,
                color: colors.fgPrimary,
                letterSpacing: -2,
                lineHeight: 48,
                fontVariant: ["tabular-nums"],
              }}
            >
              {avgRounded}
            </Text>
            <View style={{ flexDirection: "row", gap: 2 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Text
                  key={i}
                  style={{
                    fontSize: 14,
                    color:
                      i <= Math.round(data.average)
                        ? colors.accentWarn
                        : colors.fgSubtle,
                  }}
                >
                  ★
                </Text>
              ))}
            </View>
            <Text
              style={{
                fontFamily: "GeistMono-500",
                fontSize: 10,
                color: colors.fgMuted,
                letterSpacing: 0.5,
              }}
            >
              {formatInteger(data.total)} YORUM
            </Text>
          </View>

          {/* Sağ: histogram */}
          <View style={{ flex: 1, justifyContent: "center" }}>
            <RatingHistogram distribution={data.distribution} />
          </View>
        </View>

        {/* Rating filter strip */}
        <Text
          style={{
            fontFamily: "GeistMono-600",
            fontSize: 10,
            letterSpacing: 2,
            color: colors.fgMuted,
            paddingHorizontal: 4,
            paddingTop: 4,
          }}
        >
          FİLTRE
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ gap: 8, paddingRight: 16 }}
        >
          <FilterChip
            label="Tümü"
            count={data.total}
            active={rating === "all"}
            onPress={() => setRating("all")}
          />
          {([5, 4, 3, 2, 1] as const).map((star) => (
            <FilterChip
              key={star}
              label={`${star}★`}
              count={data.distribution[star]}
              active={rating === star}
              onPress={() => setRating(star)}
            />
          ))}
        </ScrollView>

        {/* List */}
        {data.reviews.length === 0 ? (
          <View style={{ minHeight: 240 }}>
            <EmptyState
              title="Yorum yok"
              subtitle={
                rating === "all" && platform === "all"
                  ? "Bu property için yorum kayıtlı değil."
                  : "Filtreye uyan yorum yok."
              }
            />
          </View>
        ) : (
          <View style={{ gap: 8, paddingTop: 4 }}>
            {data.reviews.map((review) => (
              <ReviewRow key={`${review.source}-${review.id}`} review={review} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
