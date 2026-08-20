import { useT } from "~/lib/i18n";
import { Text, View } from "react-native";
import type { AppVersion, IntegrationHealth, SentryIssue, SentryLevel } from "@helm/api";
import { VERSION_STATUS_LABEL } from "@helm/api";
import { providerLabel } from "@helm/domain";

import { formatInteger, formatRelativeTime } from "~/lib/format";
import { useTheme } from "~/theme/use-theme";
import { BentoTile, Empty } from "~/components/bento";

/** Listelerde ilk N satir gosterilir - kokpit tarama icin, arsiv icin degil. */
const TOP_CRASHES = 4;
const TOP_VERSIONS = 4;

/** Sentry siddeti → renk. fatal ve error AYNI kirmizi: ikisi de "kirildi"
 *  demek, aralarindaki fark kullanicinin alacagi aksiyonu degistirmiyor. */
function levelColor(theme: ReturnType<typeof useTheme>["theme"], level: SentryLevel): string {
  if (level === "fatal" || level === "error") return theme.neg;
  if (level === "warning") return theme.warn;
  return theme.fg3;
}

export function CrashTile({
  issues,
  loading,
}: {
  issues: readonly SentryIssue[];
  loading: boolean;
}) {
  const t = useT();
  const { theme } = useTheme();

  return (
    <BentoTile>
      <View className="flex-row items-center justify-between">
        <Text className="font-semibold text-emph tracking-tight text-fg">{t("Crash'ler")}</Text>
        <Text className="font-mono-medium text-[11px] text-fg3">{issues.length}</Text>
      </View>

      {issues.length === 0 ? (
        <Empty label={loading ? t("YÜKLENİYOR…") : t("AÇIK CRASH YOK")} />
      ) : (
        issues.slice(0, TOP_CRASHES).map((c) => (
          <View
            key={c.id}
            className="flex-row items-center gap-rowY border-t border-line py-rowY"
          >
            <View
              className="h-sm w-sm rounded-bar"
              style={{ backgroundColor: levelColor(theme, c.level) }}
            />
            <View className="min-w-0 flex-1">
              <Text
                className="font-medium text-row tracking-tight text-fg"
                numberOfLines={1}
              >
                {c.title}
              </Text>
              <Text className="mt-[1px] text-meta text-fg3" numberOfLines={1}>
                {c.propertyName ?? "-"} · {c.level} · {formatRelativeTime(c.lastSeen)}
              </Text>
            </View>
            <Text className="font-mono-semibold text-body text-fg2">
              {formatInteger(c.count)}
            </Text>
          </View>
        ))
      )}
    </BentoTile>
  );
}

export function IntegrationsTile({
  integrations,
  okCount,
  total,
  loading,
}: {
  integrations: readonly IntegrationHealth[];
  okCount: number;
  total: number;
  loading: boolean;
}) {
  const t = useT();
  const { theme } = useTheme();

  return (
    <BentoTile>
      <View className="flex-row items-center justify-between">
        <Text className="font-semibold text-emph tracking-tight text-fg">{t("Entegrasyonlar")}</Text>
        <Text
          className="font-mono-medium text-[11px]"
          style={{ color: okCount === total ? theme.pos : theme.warn }}
        >
          {okCount}/{total} OK
        </Text>
      </View>

      {integrations.length === 0 ? (
        <Empty label={loading ? t("YÜKLENİYOR…") : t("ENTEGRASYON YOK")} />
      ) : (
        <View className="mt-headerY flex-row flex-wrap gap-sm">
          {integrations.map((i) => {
            const bad = i.status === "error";
            return (
              <View
                key={i.id}
                className="rounded-field px-headerY py-[9px]"
                // Hatali olan dolgusuyla da ayrisir, yalnizca metin rengiyle
                // degil: renk korlugunde tek basina renk ayirt ettirmez.
                style={{ backgroundColor: bad ? `${theme.neg}1F` : theme.tile2 }}
              >
                <Text
                  className="font-medium text-meta"
                  style={{ color: bad ? theme.neg : theme.fg }}
                >
                  {providerLabel(i.provider)}
                  {bad ? " · hata" : ""}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </BentoTile>
  );
}

export function VersionsTile({
  versions,
  loading,
}: {
  versions: readonly AppVersion[];
  loading: boolean;
}) {
  const t = useT();
  return (
    <BentoTile>
      <Text className="font-semibold text-emph tracking-tight text-fg">{t("Sürümler")}</Text>
      {versions.length === 0 ? (
        <Empty label={loading ? t("YÜKLENİYOR…") : t("SÜRÜM KAYDI YOK")} />
      ) : (
        versions.slice(0, TOP_VERSIONS).map((v) => (
          <View
            key={v.id}
            className="flex-row items-center gap-rowY border-t border-line py-[11px]"
          >
            <Text className="w-[52px] font-mono-semibold text-body text-fg">{v.version}</Text>
            <Text className="flex-1 text-meta text-fg2" numberOfLines={1}>
              {v.source === "ios" ? "App Store" : "Play Store"}
              {v.status != null ? ` · ${VERSION_STATUS_LABEL[v.status]}` : ""}
            </Text>
            <Text className="font-mono-medium text-[11px] text-fg3">
              {v.releaseDate != null ? formatRelativeTime(v.releaseDate) : "-"}
            </Text>
          </View>
        ))
      )}
    </BentoTile>
  );
}
