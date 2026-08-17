import { Text, View } from "react-native";
import type { Alert, CoverageIssue } from "@helm/api";

import { formatRelativeTime } from "~/lib/format";
import { haptic } from "~/lib/haptics";
import { useTheme } from "~/theme/use-theme";
import { BentoTile } from "~/components/bento";
import { Pill, SEVERITY_COLOR } from "./tiles";
import { useT } from "~/lib/i18n";

/** Ekranda kac madde gosterilir. Kalan sayisi BASLIKTA yazilir — sessizce
 *  kirpmak "hepsi bu" diye okunur. */
const VISIBLE = 3;

export type AttentionItem = {
  key: string;
  severity: Alert["severity"];
  title: string;
  detail: string;
  /** Kaydedilmis bir olay mi (cozulebilir) yoksa anlik turetme mi. */
  kind: "event" | "derived";
  /** Yalnizca kaydedilmis olaylarda: alert_events.id */
  eventId?: number;
};

export function toItems(
  alerts: readonly Alert[],
  coverage: readonly CoverageIssue[],
): AttentionItem[] {
  // Kaydedilmis olaylar ONCE: birinin elle cozmesi gerekiyor. Turetilen
  // sinyaller kaynak duzelince kendiliginden kaybolur.
  return [
    ...alerts.map((a) => ({
      key: `event:${a.id}`,
      severity: a.severity,
      title: a.ruleName,
      detail: `${a.message} · ${formatRelativeTime(a.triggeredAt)}`,
      kind: "event" as const,
      eventId: a.id,
    })),
    ...coverage.map((c) => ({
      key: c.id,
      severity: c.severity,
      title: c.title,
      detail: c.detail,
      kind: "derived" as const,
    })),
  ];
}

export function AttentionTile({
  items,
  onResolve,
  onMute,
}: {
  items: readonly AttentionItem[];
  /** Yalnizca kaydedilmis olaylar icin — turetilenlerde "cozulecek" bir kayit yok. */
  onResolve: (eventId: number, key: string) => void;
  onMute: (key: string) => void;
}) {
  const t = useT();
  const { theme } = useTheme();
  if (items.length === 0) return null;

  const shown = items.slice(0, VISIBLE);
  const rest = items.length - shown.length;

  return (
    <BentoTile>
      <View className="flex-row items-center justify-between">
        <Text className="font-semibold text-emph tracking-tight text-fg">
          {t("Dikkat gerekiyor")}
        </Text>
        <Text className="font-mono-medium text-[11px] text-fg3">
          {rest > 0 ? `${shown.length}/${items.length}` : String(items.length)}
        </Text>
      </View>

      {shown.map((it) => (
        <View
          key={it.key}
          className="mt-headerY border-l-2 pl-headerY"
          // Tasarim tek kirmizi kenar kullaniyordu; elimizde gercek siddet var,
          // onu gostermemek bilgi saklamak olurdu.
          style={{ borderLeftColor: SEVERITY_COLOR(theme, it.severity) }}
        >
          <Text className="font-medium text-row tracking-tight text-fg">
            {it.title}
          </Text>
          <Text className="mt-[3px] text-meta leading-[18px] text-fg2">{it.detail}</Text>
          <View className="mt-headerY flex-row gap-sm">
            {/* "Cöz" YALNIZCA kaydedilmis olayda: turetilen sinyalde
                cozulecek bir kayit yok, kaynak duzelince kendi kaybolur.
                Calismayan bir butonu cizmek onu calisiyormus gibi gosterir. */}
            {it.kind === "event" && it.eventId != null ? (
              <Pill
                label={t("Çöz")}
                background={theme.accent}
                color={theme.accentInk}
                onPress={() => {
                  haptic.tap();
                  onResolve(it.eventId!, it.key);
                }}
              />
            ) : null}
            <Pill
              label="Sustur"
              background={theme.tile2}
              color={theme.fg}
              onPress={() => onMute(it.key)}
            />
          </View>
        </View>
      ))}
    </BentoTile>
  );
}
