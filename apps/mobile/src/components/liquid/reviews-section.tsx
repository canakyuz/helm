import { useState } from "react";
import { Text, TextInput, View } from "react-native";

import { useReviews } from "~/hooks/use-reviews";
import { useReviewReply } from "~/hooks/use-review-reply";
import { formatInteger, formatRelativeTime } from "~/lib/format";
import { haptic } from "~/lib/haptics";
import { colors, type } from "~/theme/tokens";
import { CardSection } from "~/components/liquid/card";
import { Row } from "~/components/liquid/card";
import { HBar } from "~/components/liquid/charts";
import { Stars, ActionBtn, EmptyHint } from "~/components/liquid/primitives";

const MONO_500 = "GeistMono-500";
const MONO_600 = "GeistMono-600";

type ReviewItem = {
  id: number;
  rating: number | null;
  body: string | null;
  source: "appstore" | "playstore";
  review_date: string | null;
  developer_response: string | null;
};

function ReviewRows({ items, reply }: { items: ReviewItem[]; reply: ReturnType<typeof useReviewReply> }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [replied, setReplied] = useState<Record<number, boolean>>({});
  if (items.length === 0) return <EmptyHint>NO REVIEWS YET</EmptyHint>;
  return (
    <View>
      {items.map((r, i) => {
        const open = openId === r.id;
        const hasReply = replied[r.id] || !!r.developer_response;
        return (
          <Row
            key={r.id}
            open={open}
            onToggle={() => setOpenId(open ? null : r.id)}
            isLast={i === items.length - 1}
            header={
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Stars n={r.rating ?? 0} size={10} />
                  <Text style={{ flex: 1, fontFamily: MONO_500, fontSize: 9, color: colors.fgMuted, letterSpacing: 0.4 }}>
                    {r.source.toUpperCase()}
                  </Text>
                  {hasReply ? (
                    <Text style={{ fontFamily: MONO_500, fontSize: 8, color: colors.green, letterSpacing: 0.6 }}>✓ REPLIED</Text>
                  ) : null}
                  <Text style={{ fontFamily: MONO_500, fontSize: type.label, color: colors.fgSubtle }}>
                    {r.review_date ? formatRelativeTime(r.review_date) : ""}
                  </Text>
                </View>
                <Text style={{ fontFamily: "Geist-400", fontSize: type.bodySm, color: colors.fgSecondary }} numberOfLines={1}>
                  {r.body ?? "-"}
                </Text>
              </View>
            }
            detail={
              <>
                <Text style={{ fontFamily: "Geist-400", fontSize: type.body, color: colors.fgSecondary, lineHeight: 18 }}>
                  {r.body ?? "-"}
                </Text>
                {hasReply ? (
                  <View
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      backgroundColor: `${colors.green}14`,
                      borderWidth: 1,
                      borderColor: `${colors.green}3D`,
                    }}
                  >
                    <Text style={{ fontFamily: MONO_500, fontSize: 9, color: colors.green, letterSpacing: 0.6 }}>YOUR REPLY</Text>
                    <Text style={{ fontFamily: "Geist-400", fontSize: type.bodySm, color: colors.fgSecondary, marginTop: 4 }}>
                      {r.developer_response ?? draft[r.id] ?? "Thanks for the feedback - we're on it!"}
                    </Text>
                  </View>
                ) : (
                  <>
                    <TextInput
                      value={draft[r.id] ?? ""}
                      onChangeText={(t) => setDraft((d) => ({ ...d, [r.id]: t }))}
                      placeholder="Write a reply…"
                      placeholderTextColor={colors.fgSubtle}
                      multiline
                      style={{
                        minHeight: 56,
                        backgroundColor: "rgba(255,255,255,0.04)",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.08)",
                        borderRadius: 12,
                        padding: 12,
                        color: colors.fgPrimary,
                        fontFamily: "Geist-400",
                        fontSize: type.body,
                        textAlignVertical: "top",
                      }}
                    />
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <ActionBtn
                        label="SEND REPLY"
                        tone="accent"
                        onPress={() => {
                          const body = draft[r.id];
                          if (!body || !body.trim()) return;
                          haptic.tap();
                          reply.mutate(
                            { review_id: r.id, body },
                            { onSuccess: () => setReplied((s) => ({ ...s, [r.id]: true })) },
                          );
                        }}
                      />
                    </View>
                  </>
                )}
              </>
            }
          />
        );
      })}
    </View>
  );
}

export function ReviewsSection({ index = "05" }: { index?: string }) {
  const reviewsQuery = useReviews();
  const reply = useReviewReply();
  const reviews = (reviewsQuery.data?.reviews ?? []).slice(0, 6) as ReviewItem[];
  const ratingAvg = reviewsQuery.data?.average ?? 0;
  const ratingTotal = reviewsQuery.data?.total ?? 0;
  const distribution = reviewsQuery.data?.distribution;
  const histMax = distribution
    ? Math.max(distribution[1], distribution[2], distribution[3], distribution[4], distribution[5], 1)
    : 1;

  return (
    <CardSection index={index} title="Reviews & ratings" action="App Store">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 }}>
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontFamily: MONO_600, fontSize: type.stat, lineHeight: 24, color: colors.fgPrimary, letterSpacing: -0.5 }}>
            {ratingAvg.toFixed(1)}
          </Text>
          <Stars n={Math.round(ratingAvg)} size={11} />
          <Text style={{ fontFamily: MONO_500, fontSize: 9, color: colors.fgSubtle, letterSpacing: 0.6, marginTop: 4 }}>
            {formatInteger(ratingTotal)}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          {[5, 4, 3, 2, 1].map((s) => {
            const n = distribution ? distribution[s as 1 | 2 | 3 | 4 | 5] : 0;
            return (
              <View key={s} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontFamily: MONO_500, fontSize: 9, color: colors.fgSubtle, width: 8 }}>{s}</Text>
                <View style={{ flex: 1 }}>
                  <HBar pct={(n / histMax) * 100} color={colors.accentWarn} height={4} />
                </View>
              </View>
            );
          })}
        </View>
      </View>
      <ReviewRows items={reviews} reply={reply} />
    </CardSection>
  );
}
