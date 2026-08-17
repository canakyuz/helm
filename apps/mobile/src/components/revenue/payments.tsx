import { MONTHS_SHORT } from "~/lib/labels";
import { tr, useT } from "~/lib/i18n";
import { Text, View } from "react-native";
import { RC_EVENT_LABEL } from "@helm/api";
import type { PaymentRow } from "@helm/api";

import { useTheme } from "~/theme/use-theme";
import { BentoTile } from "~/components/bento";

const STORE_SHORT: Record<string, string> = {
  APP_STORE: "App Store",
  PLAY_STORE: "Play",
  MAC_APP_STORE: "Mac",
  STRIPE: "Stripe",
};

/** "2026-07-28" → "28 Tem" */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${tr(MONTHS_SHORT[(m ?? 1) - 1] ?? "")}`;
}

/**
 * Donemdeki odemeler.
 *
 * IKI GRANULARITE bir arada: webhook baglandiktan sonrasi ISLEM bazinda, oncesi
 * GUN bazinda (magaza raporu yalnizca gunluk toplam verir). Ayrim gizlenmiyor —
 * "gunluk toplam" satirini tek bir satin alma gibi gostermek yanlis olurdu.
 */
export function PaymentsTile({
  payments,
  loading,
  fmt,
}: {
  payments: readonly PaymentRow[];
  loading: boolean;
  fmt: (n: number) => string;
}) {
  const t = useT();
  const { theme } = useTheme();
  const total = payments.reduce((a, p) => a + p.amount, 0);

  return (
    <BentoTile>
      <View className="flex-row items-center justify-between">
        <Text className="font-semibold text-emph tracking-tight text-fg">{t("Ödemeler")}</Text>
        <Text className="font-mono-medium text-[11px] text-fg3">
          {payments.length > 0 ? `${payments.length} KALEM · ${fmt(total)}` : ""}
        </Text>
      </View>

      {payments.length === 0 ? (
        <>
          <Text className="py-tilePad font-mono-medium text-eyebrow tracking-wide text-fg3">
            {loading ? t("YÜKLENİYOR…") : t("BU DÖNEMDE ÖDEME YOK")}
          </Text>
          {!loading ? (
            <Text className="text-meta leading-[18px] text-fg3">
              Reklam geliri burada listelenmez; yalnızca abonelik ve uygulama içi satın almalar.
            </Text>
          ) : null}
        </>
      ) : (
        payments.map((p, i) => (
          <View
            key={`${p.date}-${p.label}-${i}`}
            className="flex-row items-center gap-rowY border-t border-line py-rowY"
          >
            <Text className="w-[54px] font-mono-medium text-meta text-fg3">
              {shortDate(p.date)}
            </Text>
            <View className="min-w-0 flex-1">
              <Text className="font-medium text-row tracking-tight text-fg" numberOfLines={1}>
                {p.label}
              </Text>
              <Text className="mt-[1px] text-meta text-fg3" numberOfLines={1}>
                {p.granularity === "transaction"
                  ? `${t(RC_EVENT_LABEL[p.kind] ?? p.kind)}${p.store != null ? ` · ${STORE_SHORT[p.store] ?? p.store}` : ""}`
                  : p.kind}
              </Text>
            </View>
            <Text
              className="font-mono-semibold text-body"
              style={{ color: p.granularity === "transaction" ? theme.pos : theme.fg2 }}
            >
              {fmt(p.amount)}
            </Text>
          </View>
        ))
      )}
    </BentoTile>
  );
}
