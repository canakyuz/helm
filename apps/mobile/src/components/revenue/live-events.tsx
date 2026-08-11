import { Text, View } from "react-native";
import { RC_EVENT_LABEL, type RevenueEvent } from "@helm/api";

import { formatRelativeTime } from "~/lib/format";
import { useTheme } from "~/theme/use-theme";
import { BentoTile } from "~/components/bento";

const TOP_N = 5;

/** Gelir dusuren olaylar — digerleri (iptal, odeme sorunu) notr gosterilir. */
const POSITIVE = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "NON_RENEWING_PURCHASE",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
]);
const NEGATIVE = new Set(["CANCELLATION", "EXPIRATION", "BILLING_ISSUE"]);

/**
 * Gercek zamanli satin alma akisi.
 *
 * NEDEN AYRI KART: bu tablo App Store Connect metrikleriyle TOPLANMAZ — ayni
 * para iki kez gorunurdu. Yukaridaki donem toplami Apple'in mutabakatli rakami
 * (T-1 gecikmeli), bu kart "az once ne oldu". Ikisi farkli sorulari cevaplar.
 */
export function LiveEventsTile({
  events,
  loading,
  fmtAmount,
}: {
  events: readonly RevenueEvent[];
  loading: boolean;
  fmtAmount: (n: number) => string;
}) {
  const { theme } = useTheme();

  const tone = (t: string): string =>
    POSITIVE.has(t) ? theme.pos : NEGATIVE.has(t) ? theme.neg : theme.fg2;

  return (
    <BentoTile>
      <View className="flex-row items-center justify-between">
        <Text className="font-semibold text-emph tracking-tight text-fg">
          Son işlemler
        </Text>
        <Text className="font-mono-medium text-[11px] text-fg3">CANLI</Text>
      </View>

      {events.length === 0 ? (
        <>
          <Text className="py-tilePad font-mono-medium text-eyebrow tracking-wide text-fg3">
            {loading ? "YÜKLENİYOR…" : "HENÜZ İŞLEM YOK"}
          </Text>
          {!loading ? (
            <Text className="text-meta leading-[18px] text-fg3">
              RevenueCat webhook'u bağlı değilse burası boş kalır; Apple raporu
              1–2 gün gecikmeli olduğu için satın almalar dönem toplamında sonra görünür.
            </Text>
          ) : null}
        </>
      ) : (
        events.slice(0, TOP_N).map((e) => (
          <View
            key={e.id}
            className="flex-row items-center gap-rowY border-t border-line py-rowY"
          >
            <View className="min-w-0 flex-1">
              <Text
                className="font-medium text-row tracking-tight text-fg"
                numberOfLines={1}
              >
                {e.productId ?? RC_EVENT_LABEL[e.eventType] ?? e.eventType}
              </Text>
              <Text className="mt-[1px] text-meta text-fg3" numberOfLines={1}>
                {RC_EVENT_LABEL[e.eventType] ?? e.eventType}
                {e.store != null ? ` · ${e.store}` : ""} ·{" "}
                {formatRelativeTime(e.occurredAt)}
              </Text>
            </View>
            <Text
              className="font-mono-semibold text-body"
              style={{ color: tone(e.eventType) }}
            >
              {e.amount != null ? fmtAmount(e.amount) : "—"}
            </Text>
          </View>
        ))
      )}
    </BentoTile>
  );
}
