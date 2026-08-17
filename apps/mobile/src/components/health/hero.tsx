import { useT } from "~/lib/i18n";
import { Text, View } from "react-native";
import { space } from "@helm/design";

import { formatInteger, formatPercent } from "~/lib/format";
import { useTheme } from "~/theme/use-theme";
import { Ring } from "~/components/liquid";
import { BentoTile } from "~/components/bento";

/** Crash-free esikleri — ekrandaki "Sağlıklı" hukmunu bunlar verir.
 *  Bilesenle BIRLIKTE duruyor: esik ile onu gosteren metin ayri dosyalara
 *  dagilirsa biri degisip digeri kalir. */
const HEALTHY_AT = 99.5;
const DEGRADED_AT = 99.0;

type Verdict = { label: string; color: string };

function verdictOf(
  theme: ReturnType<typeof useTheme>["theme"],
  crashFree: number | null,
): Verdict {
  if (crashFree == null) return { label: "Veri yok", color: theme.fg3 };
  if (crashFree >= HEALTHY_AT) return { label: "Sağlıklı", color: theme.pos };
  if (crashFree >= DEGRADED_AT) return { label: "Zayıflamış", color: theme.warn };
  return { label: "Kritik", color: theme.neg };
}

export function CrashFreeHero({
  crashFree,
  issueCount,
  fatalCount,
  totalEvents,
}: {
  crashFree: number | null;
  issueCount: number;
  fatalCount: number;
  totalEvents: number;
}) {
  const { theme, glass } = useTheme();
  const t = useT();
  const verdict = verdictOf(theme, crashFree);

  return (
    <BentoTile padding={space.tilePadLg}>
      <View className="flex-row items-center gap-tilePadLg">
        <Ring
          value={crashFree ?? 0}
          size={96}
          stroke={9}
          color={verdict.color}
          // Ray rengi: hairline degil. `theme.line` cam yuzeye karsi ~1.3:1 ve
          // halkanin bos kismi gorunmuyordu.
          trackColor={glass.chartDim}
        >
          <Text className="font-semibold text-title tracking-tighter text-fg">
            {crashFree != null ? formatPercent(crashFree, 1) : "—"}
          </Text>
        </Ring>

        <View className="min-w-0 flex-1">
          <Text className="font-mono-medium text-eyebrow tracking-wider text-fg3">
            CRASH-FREE OTURUM
          </Text>
          <Text
            className="mt-[6px] font-semibold text-statSm tracking-tighter"
            style={{ color: verdict.color }}
          >
            {t(verdict.label)}
          </Text>
          <Text className="mt-xs text-meta leading-[18px] text-fg2">
            {issueCount} aktif sorun · {fatalCount} fatal · {formatInteger(totalEvents)} olay
          </Text>
        </View>
      </View>
    </BentoTile>
  );
}
