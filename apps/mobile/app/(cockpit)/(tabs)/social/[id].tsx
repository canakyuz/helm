import { useMemo, useState } from "react";
import { Alert, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import {
  SOCIAL_PLATFORMS,
  isActivePost,
  latestPostByLibrary,
  socialItemState,
  type SocialLibraryItem,
  type SocialPlatform,
  type SocialPost,
} from "@helm/api";
import { press, space } from "@helm/design";

import {
  useCancelSocialPost,
  usePublishSocialItem,
  useSocialLibrary,
  useSocialPosts,
} from "~/hooks/use-social-publishing";
import { haptic } from "~/lib/haptics";
import { currentLocale, useT } from "~/lib/i18n";
import { shortDateTime } from "~/lib/labels";
import { toast } from "~/lib/toast";
import { useTheme } from "~/theme/use-theme";
import { ScreenGround, BentoHeader } from "~/components/bento";
import { Toggle } from "~/components/liquid";
import {
  CaptionBlock,
  ChoiceChip,
  DetailSection,
  MIN_LEAD_MS,
  PLATFORM_LABEL,
  SocialButton,
  SocialNotice,
  SocialThumb,
  TextAction,
  durationLabel,
  itemStateTone,
  platformTone,
  postStatusTone,
  quickSlots,
} from "~/components/social";

export default function SocialItemDetail() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const library = useSocialLibrary();
  const posts = useSocialPosts();

  const item = useMemo(() => library.data?.find((i) => i.id === id), [library.data, id]);
  const latest = useMemo(
    () => (id == null ? undefined : latestPostByLibrary(posts.data ?? []).get(id)),
    [posts.data, id],
  );

  return (
    <ScreenGround>
      <SafeAreaView edges={["top"]} className="flex-1">
        <BentoHeader eyebrow={item?.code ?? t("İÇERİK")} title={t("Paylaşım")} onBack={() => router.back()} />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: space.screenX, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {library.isLoading ? (
            <SocialNotice loading label={t("İçerik yükleniyor")} />
          ) : library.error != null ? (
            <SocialNotice tone="danger" label={library.error.message} />
          ) : item == null ? (
            <SocialNotice label={t("İçerik bulunamadı. Kütüphaneye dön ve listeyi yenile.")} />
          ) : (
            <>
              <ItemHero item={item} post={latest} />
              {posts.isLoading ? (
                <SocialNotice loading label={t("Paylaşım durumu yükleniyor")} />
              ) : latest != null && isActivePost(latest.status) ? (
                <ActivePost post={latest} />
              ) : (
                <PublishPanel item={item} lastFailed={latest?.status === "failed" ? latest : undefined} />
              )}
              <CaptionBlock title="TikTok" text={item.tiktok_caption} />
              <CaptionBlock title="Instagram" text={item.instagram_caption} />
              {item.pinned_comment != null && item.pinned_comment.trim() !== "" ? (
                <CaptionBlock title={t("Sabit yorum")} text={item.pinned_comment} />
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenGround>
  );
}

/** Kapak (dokununca video tarayicida) + hook + kod/sure + durum. */
function ItemHero({ item, post }: { item: SocialLibraryItem; post: SocialPost | undefined }) {
  const t = useT();
  const { theme } = useTheme();
  const tone = itemStateTone(socialItemState(post), t, theme);
  const duration = durationLabel(item.duration_sec, t);
  const hasVideo = item.video_url != null;
  const openVideo = () => {
    if (item.video_url == null) return;
    haptic.tap();
    // Linking.openURL cihazda ilgili uygulama/tarayici yoksa reddedebilir;
    // yakalanmazsa unhandled rejection olur.
    Linking.openURL(item.video_url).catch(() => toast.error(t("Video açılamadı")));
  };

  return (
    <View className="flex-row gap-tilePad pb-tilePad pt-xs">
      {hasVideo ? (
        <Pressable onPress={openVideo} accessibilityRole="link" accessibilityLabel={t("Videoyu aç")}>
          {({ pressed }) => (
            <View style={pressed ? { opacity: press.opacity } : undefined}>
              <SocialThumb uri={item.thumbnail_url} width={124} />
            </View>
          )}
        </Pressable>
      ) : (
        <SocialThumb uri={item.thumbnail_url} width={124} />
      )}
      <View className="flex-1 justify-between">
        <View>
          <Text className="font-semibold text-emph text-fg">{item.hook}</Text>
          <Text className="mt-xs font-mono-medium text-meta text-fg3">
            {duration == null ? item.code : `${item.code} · ${duration}`}
          </Text>
        </View>
        <View className="gap-sm">
          <Text className="font-mono-semibold text-meta" style={{ color: tone.color }}>
            {tone.label}
          </Text>
          {hasVideo ? (
            <TextAction label={t("Videoyu aç ›")} color={theme.fg2} onPress={openVideo} />
          ) : (
            <Text className="text-meta" style={{ color: theme.neg }}>
              {t("Video yüklenmemiş")}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

/** Aktif post varken yayin kontrolleri yerine durum + platform baglantilari. */
function ActivePost({ post }: { post: SocialPost }) {
  const t = useT();
  const { theme } = useTheme();
  const cancel = useCancelSocialPost();
  const tone = postStatusTone(post.status, t, theme);
  const at = post.published_at ?? post.scheduled_for;

  function confirmCancel() {
    haptic.press();
    Alert.alert(t("Planı iptal et"), t("Bu paylaşım Zernio'dan silinecek."), [
      { text: t("Vazgeç"), style: "cancel" },
      { text: t("İptal et"), style: "destructive", onPress: () => cancel.mutate(post.id) },
    ]);
  }

  return (
    <DetailSection
      title={t("Durum")}
      action={
        post.status === "scheduled" ? (
          <TextAction
            label={t("Planı iptal et")}
            color={theme.neg}
            disabled={cancel.isPending}
            onPress={confirmCancel}
          />
        ) : undefined
      }
    >
      <Text className="font-mono-semibold text-body" style={{ color: tone.color }}>
        {at == null ? tone.label : `${tone.label} · ${shortDateTime(at)}`}
      </Text>
      {post.platforms.map((p) => {
        const pt = platformTone(p.status, t, theme);
        return (
          <View key={`${p.platform}-${p.account_id}`} className="border-t border-line py-rowY mt-sm">
            <View className="flex-row items-center justify-between">
              <Text className="font-medium text-row text-fg">{PLATFORM_LABEL[p.platform]}</Text>
              <View className="flex-row items-center gap-boxPad">
                <Text className="font-mono-semibold text-meta" style={{ color: pt.color }}>
                  {pt.label}
                </Text>
                {p.url != null ? (
                  <TextAction
                    label={t("Aç ›")}
                    color={theme.fg}
                    onPress={() => {
                      haptic.tap();
                      void Linking.openURL(p.url ?? "");
                    }}
                  />
                ) : null}
              </View>
            </View>
            {p.error != null ? (
              <Text className="mt-xs text-meta" style={{ color: theme.neg }}>
                {p.error}
              </Text>
            ) : null}
          </View>
        );
      })}
      {post.error != null ? (
        <Text className="mt-sm text-meta" style={{ color: theme.neg }}>
          {post.error}
        </Text>
      ) : null}
    </DetailSection>
  );
}

type PlatformFlags = Record<SocialPlatform, boolean>;

/** Platform secimi, "Simdi paylas" (onayli) ve "Planla" (hizli cip + tarih secici). */
function PublishPanel({ item, lastFailed }: { item: SocialLibraryItem; lastFailed: SocialPost | undefined }) {
  const t = useT();
  const { name: themeName, theme } = useTheme();
  const publish = usePublishSocialItem();
  const [flags, setFlags] = useState<PlatformFlags>({ tiktok: true, instagram: true });
  const [planning, setPlanning] = useState(false);
  // Sinir ve hizli secenekler panel ACILDIGINDA hesaplanir; her render'da yeni
  // Date native secicinin prop'unu surekli degistirirdi.
  const [openedAt, setOpenedAt] = useState(() => new Date());
  const slots = useMemo(() => quickSlots(openedAt), [openedAt]);
  const [when, setWhen] = useState<Date>(() => quickSlots(new Date())[0]?.at ?? new Date());

  const selected = SOCIAL_PLATFORMS.filter((p) => flags[p]);
  const minimumDate = new Date(openedAt.getTime() + MIN_LEAD_MS);
  const platformNames = selected.map((p) => PLATFORM_LABEL[p]).join(" + ");
  const hasVideo = item.video_url != null;

  function openPlanning() {
    haptic.tap();
    const now = new Date();
    setOpenedAt(now);
    if (when.getTime() < now.getTime() + MIN_LEAD_MS) setWhen(quickSlots(now)[0]?.at ?? now);
    setPlanning(true);
  }

  function shareNow() {
    if (!hasVideo || selected.length === 0) return;
    haptic.press();
    Alert.alert(t("Şimdi paylaş"), t("{p} için yaklaşık 2 dakika içinde yayınlanacak.", { p: platformNames }), [
      { text: t("Vazgeç"), style: "cancel" },
      {
        text: t("Paylaş"),
        onPress: () => publish.mutate({ libraryId: item.id, platforms: selected, scheduledFor: null }),
      },
    ]);
  }

  function schedule() {
    if (!hasVideo || selected.length === 0) return;
    if (when.getTime() < Date.now() + 60_000) {
      toast.error(t("Geçmiş bir zaman seçilemez"));
      return;
    }
    haptic.press();
    publish.mutate(
      { libraryId: item.id, platforms: selected, scheduledFor: when.toISOString() },
      { onSuccess: () => setPlanning(false) },
    );
  }

  return (
    <DetailSection title={t("Paylaş")}>
      {hasVideo ? null : (
        <Text className="mb-sm text-meta" style={{ color: theme.neg }}>
          {t("Video yüklenmemiş")}
        </Text>
      )}
      {lastFailed != null ? (
        <Text className="mb-sm text-meta" style={{ color: theme.neg }}>
          {t("Son deneme başarısız: {e}", { e: lastFailed.error ?? t("bilinmeyen hata") })}
        </Text>
      ) : null}

      {SOCIAL_PLATFORMS.map((p, i) => (
        <View
          key={p}
          className={`flex-row items-center justify-between py-sm${i > 0 ? " border-t border-line" : ""}`}
        >
          <Text className="font-medium text-row text-fg">{PLATFORM_LABEL[p]}</Text>
          <Toggle
            on={flags[p]}
            offColor={theme.tile2}
            onColor={theme.accent}
            onChange={(on) => {
              haptic.tap();
              setFlags((prev) => ({ ...prev, [p]: on }));
            }}
          />
        </View>
      ))}

      <View className="mt-boxPad gap-sm">
        <SocialButton
          variant="primary"
          label={t("Şimdi paylaş")}
          onPress={shareNow}
          disabled={!hasVideo || selected.length === 0 || planning}
          busy={publish.isPending && !planning}
        />
        {planning ? null : (
          <SocialButton
            label={t("Planla")}
            onPress={openPlanning}
            disabled={!hasVideo || selected.length === 0}
          />
        )}
        {selected.length === 0 ? (
          <Text className="text-meta text-fg3">{t("En az bir platform seç.")}</Text>
        ) : null}
      </View>

      {planning ? (
        <View className="mt-boxPad gap-boxPad">
          <View className="flex-row flex-wrap gap-sm">
            {slots.map((slot) => (
              <ChoiceChip
                key={slot.key}
                label={t(slot.label)}
                selected={when.getTime() === slot.at.getTime()}
                onPress={() => {
                  haptic.tap();
                  setWhen(slot.at);
                }}
              />
            ))}
          </View>
          {Platform.OS === "ios" ? (
            <View className="flex-row items-center justify-between">
              <Text className="font-medium text-row text-fg">{t("Tarih ve saat")}</Text>
              <DateTimePicker
                value={when}
                mode="datetime"
                display="compact"
                minimumDate={minimumDate}
                accentColor={theme.accent}
                themeVariant={themeName}
                locale={currentLocale().replace("-", "_")}
                // Host yalniz dikeyde icerige oturuyor; genislik verilmezse satirda
                // sifira coker. Kalan alani alir, SwiftUI pill'leri saga yaslar.
                style={{ flex: 1 }}
                onValueChange={(_event, date) => setWhen(date)}
              />
            </View>
          ) : null}
          <SocialButton
            label={t("{d} için planla", { d: shortDateTime(when.toISOString()) })}
            onPress={schedule}
            busy={publish.isPending}
            disabled={selected.length === 0}
          />
          <View className="items-center">
            <TextAction label={t("Vazgeç")} color={theme.fg2} onPress={() => setPlanning(false)} />
          </View>
        </View>
      ) : null}
    </DetailSection>
  );
}
