import { useT } from "~/lib/i18n";
import { Text, View } from "react-native";
import { radius as R, space } from "@helm/design";
import type { ReconState, RevenueLeg } from "@helm/api";

import { useTheme } from "~/theme/use-theme";
import { BentoTile } from "~/components/bento";

const STORE_LABEL: Record<string, string> = {
  APP_STORE: "App Store",
  PLAY_STORE: "Play Store",
  STRIPE: "Stripe",
  MAC_APP_STORE: "Mac App Store",
  BILINMIYOR: "Bilinmiyor",
};

const STATE_LABEL: Record<ReconState, string> = {
  pending: "BEKLİYOR",
  confirmed: "DOĞRULANDI",
  mismatch: "UYUŞMUYOR",
  storeOnly: "MAĞAZA",
};

/**
 * Anlik/kesin mutabakat.
 *
 * NEDEN IKI BACAK: RevenueCat satin almayi ANINDA bilir ama rakami revize
 * olabilir; magaza raporu T-1 gecikmelidir ama komisyon, iade ve kur farkini
 * icerir. Tek kaynaga inmek ya bugunu gizler ya da farki gizler.
 *
 * "BEKLİYOR" bir hata degil, dogru durumdur: para geldi, magaza henuz
 * onaylamadi. Google Play icin dogrulama kaynagi HENUZ YOK — Play baglayicisi
 * yazilana kadar o bacak kalici olarak bekliyor gorunur, ki bu da dogru sinyal.
 */
export function ReconciliationTile({
  legs,
  fmt,
}: {
  legs: readonly RevenueLeg[];
  /** Tutarlar USD'ye normalize gelir; gosterim secili para birimine cevrilir. */
  fmt: (n: number) => string;
}) {
  const t = useT();
  const { theme } = useTheme();
  if (legs.length === 0) return null;

  const tone = (s: ReconState): string =>
    s === "confirmed" ? theme.pos
    : s === "mismatch" ? theme.neg
    : s === "pending" ? theme.warn
    : theme.fg3;

  return (
    <BentoTile>
      <View className="flex-row items-center justify-between">
        <Text className="font-semibold text-emph tracking-tight text-fg">
          Mağaza mutabakatı
        </Text>
        <Text className="font-mono-medium text-[11px] text-fg3">ANLIK / KESİN</Text>
      </View>

      <View className="mt-tilePadSm" style={{ gap: space.rowY }}>
        {legs.map((l) => (
          <View key={l.store}>
            <View className="flex-row items-center justify-between">
              <Text className="font-medium text-row text-fg">
                {STORE_LABEL[l.store] ?? l.store}
              </Text>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: R.pill,
                  borderWidth: 1,
                  borderColor: tone(l.state),
                }}
              >
                <Text
                  className="font-mono-medium text-eyebrow tracking-wide"
                  style={{ color: tone(l.state) }}
                >
                  {t(STATE_LABEL[l.state])}
                </Text>
              </View>
            </View>

            <Text className="mt-[4px] font-mono-medium text-meta text-fg2">
              {fmt(l.provisional)}
              <Text className="text-fg3"> anlık · </Text>
              {l.confirmed > 0 ? fmt(l.confirmed) : "—"}
              <Text className="text-fg3"> kesin</Text>
              {l.state === "mismatch" ? (
                <Text style={{ color: theme.neg }}>
                  {"  fark "}
                  {fmt(Math.abs(l.provisional - l.confirmed))}
                </Text>
              ) : null}
            </Text>
          </View>
        ))}
      </View>
    </BentoTile>
  );
}
