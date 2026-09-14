import { Linking, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { press, withAlpha } from "@helm/design";
import type { SocialAccount, SocialItemState, SocialLibraryItem, SocialPost } from "@helm/api";

import { formatInteger } from "~/lib/format";
import { haptic } from "~/lib/haptics";
import { useT } from "~/lib/i18n";
import { shortDateTime } from "~/lib/labels";
import { useTheme } from "~/theme/use-theme";
import {
  PLATFORM_LABEL,
  durationLabel,
  itemStateTone,
  platformTone,
  postStatusTone,
} from "./status";
import { SocialThumb } from "./thumb";

const divided = (base: string, divider: boolean) => `${base}${divider ? " border-t border-line" : ""}`;

/**
 * Kutuphane satiri: kapak, hook, KOD · sure, sagda durum.
 * Kart yok - satirlar hairline ile ayrilir; yogunluk kullanicinin istegi.
 */
export function LibraryRow({
  item,
  state,
  divider,
  onPress,
}: {
  item: SocialLibraryItem;
  state: SocialItemState;
  divider: boolean;
  onPress: () => void;
}) {
  const t = useT();
  const { theme } = useTheme();
  const tone = itemStateTone(state, t, theme);
  const duration = durationLabel(item.duration_sec, t);
  const meta = duration == null ? item.code : `${item.code} · ${duration}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.hook}. ${tone.label}`}
    >
      {({ pressed }) => (
        <View
          className={divided("flex-row items-center gap-boxPad py-rowY", divider)}
          style={pressed ? { opacity: press.opacity } : undefined}
        >
          <SocialThumb uri={item.thumbnail_url} width={44} />
          <View className="flex-1">
            <Text className="font-medium text-row text-fg" numberOfLines={2}>
              {item.hook}
            </Text>
            <Text className="mt-xs font-mono-medium text-meta text-fg3" numberOfLines={1}>
              {meta}
            </Text>
          </View>
          <Text className="font-mono-semibold text-meta" style={{ color: tone.color }}>
            {tone.label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** Platform durum cipi. URL varsa dokununca yayini acar. */
export function PlatformChip({
  platform,
  status,
  url,
}: {
  platform: keyof typeof PLATFORM_LABEL;
  status: string;
  url: string | null;
}) {
  const t = useT();
  const { theme } = useTheme();
  const tone = platformTone(status, t, theme);
  const label = `${PLATFORM_LABEL[platform]} · ${tone.label}${url != null ? " ›" : ""}`;

  const body = (pressed: boolean) => (
    <View
      className="rounded-pill px-sm py-[3px]"
      style={{ backgroundColor: withAlpha(tone.color, 0.14), opacity: pressed ? press.opacity : 1 }}
    >
      <Text className="font-mono-medium text-eyebrow tracking-wide" style={{ color: tone.color }}>
        {label}
      </Text>
    </View>
  );

  if (url == null) return body(false);

  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        void Linking.openURL(url);
      }}
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={6}
    >
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

/** Kuyruk satiri: kapak, hook, zaman, platform cipleri; planlida iptal. */
export function QueueRow({
  post,
  item,
  divider,
  onCancel,
}: {
  post: SocialPost;
  item: SocialLibraryItem | undefined;
  divider: boolean;
  onCancel: (() => void) | null;
}) {
  const t = useT();
  const { theme } = useTheme();
  const tone = postStatusTone(post.status, t, theme);
  const at =
    post.status === "published" || post.status === "partial"
      ? (post.published_at ?? post.updated_at)
      : post.status === "failed"
        ? post.updated_at
        : (post.scheduled_for ?? post.created_at);

  return (
    <View className={divided("flex-row gap-boxPad py-rowY", divider)}>
      <SocialThumb uri={item?.thumbnail_url ?? null} width={32} />
      <View className="flex-1">
        <Text className="font-medium text-row text-fg" numberOfLines={1}>
          {item?.hook ?? t("Kütüphanede olmayan içerik")}
        </Text>
        <Text className="mt-[2px] font-mono-medium text-meta text-fg2">
          {shortDateTime(at)}
          {post.status === "scheduled" ? "" : <Text style={{ color: tone.color }}>{` · ${tone.label}`}</Text>}
        </Text>
        {post.platforms.length > 0 ? (
          <View className="mt-sm flex-row flex-wrap gap-xs">
            {post.platforms.map((p) => (
              <PlatformChip key={`${p.platform}-${p.account_id}`} platform={p.platform} status={p.status} url={p.url} />
            ))}
          </View>
        ) : null}
        {post.error != null ? (
          <Text className="mt-xs text-meta" style={{ color: theme.neg }} numberOfLines={3}>
            {post.error}
          </Text>
        ) : null}
      </View>
      {onCancel != null ? (
        <Pressable onPress={onCancel} accessibilityRole="button" hitSlop={10}>
          {({ pressed }) => (
            <Text
              className="font-mono-semibold text-meta"
              style={{ color: theme.neg, opacity: pressed ? press.opacity : 1 }}
            >
              {t("İptal")}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

/** Hesap satiri - avatar, ad, platform, takipci ya da yeniden bagla. */
export function AccountRow({ account, divider }: { account: SocialAccount; divider: boolean }) {
  const t = useT();
  const { theme } = useTheme();
  const url = account.profile_url;

  return (
    <Pressable
      onPress={() => {
        if (url == null) return;
        haptic.tap();
        void Linking.openURL(url);
      }}
      disabled={url == null}
      accessibilityRole={url == null ? "text" : "link"}
    >
      {({ pressed }) => (
        <View
          className={divided("flex-row items-center gap-boxPad py-rowY", divider)}
          style={pressed ? { opacity: press.opacity } : undefined}
        >
          {account.avatar_url != null ? (
            <Image source={{ uri: account.avatar_url }} style={{ width: 32, height: 32, borderRadius: 16 }} />
          ) : (
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.tile2 }} />
          )}
          <View className="flex-1">
            <Text className="font-medium text-row text-fg" numberOfLines={1}>
              {account.display_name ?? account.username ?? account.platform}
            </Text>
            <Text className="font-mono-medium text-eyebrow tracking-wide text-fg3" numberOfLines={1}>
              {account.platform.toUpperCase()}
              {account.username != null ? ` · @${account.username}` : ""}
            </Text>
          </View>
          <Text
            className="font-mono-semibold text-body"
            style={{ color: account.needs_reconnection ? theme.neg : theme.fg }}
          >
            {account.needs_reconnection
              ? t("yeniden bağla")
              : account.followers_count == null
                ? "-"
                : formatInteger(account.followers_count)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
