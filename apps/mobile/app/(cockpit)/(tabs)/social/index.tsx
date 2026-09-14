import { useMemo, useState } from "react";
import { Alert, FlatList, RefreshControl, ScrollView, SectionList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  SOCIAL_PLATFORMS,
  groupSocialQueue,
  isActivePost,
  latestPostByLibrary,
  socialItemState,
  type SocialKpis,
  type SocialLibraryItem,
  type SocialPost,
} from "@helm/api";
import { space } from "@helm/design";

import { useSocialAccounts, useSocialKpis } from "~/hooks/use-social";
import {
  useCancelSocialPost,
  useRefreshSocialPosts,
  useScheduleAllSocial,
  useSocialLibrary,
  useSocialPosts,
} from "~/hooks/use-social-publishing";
import { useScreenRefresh } from "~/hooks/use-screen-refresh";
import { formatInteger } from "~/lib/format";
import { haptic } from "~/lib/haptics";
import { useT } from "~/lib/i18n";
import { useTheme } from "~/theme/use-theme";
import { ScreenGround, BentoHeader } from "~/components/bento";
import { NativeSegmented } from "~/components/liquid";
import {
  AccountRow,
  LibraryRow,
  QueueRow,
  SocialNotice,
  TextAction,
  type Translate,
} from "~/components/social";

// Sekme etiketleri ceviri ANAHTARI; secim index ile tutulur, cunku NativeSegmented
// etiketi deger olarak da kullaniyor ve dil degisince etiket degisir.
const TAB_KEYS = ["Kütüphane", "Kuyruk", "Hesaplar"] as const;

/** Tab bar'in kapladigi alan - diger sekme ekranlariyla ayni pay. */
const LIST_BOTTOM = 120;

const listStyle = { paddingHorizontal: space.screenX, paddingBottom: LIST_BOTTOM };

/** "1.234 takipçi · 30 günde 56.789 gösterim". Veri yoksa null - satir hic cizilmez. */
function kpiSummary(k: SocialKpis | undefined, t: Translate): string | null {
  if (k == null) return null;
  const parts: string[] = [];
  if (k.followers != null) parts.push(t("{n} takipçi", { n: formatInteger(k.followers) }));
  if (k.impressions > 0) parts.push(t("30 günde {n} gösterim", { n: formatInteger(k.impressions) }));
  return parts.length === 0 ? null : parts.join(" · ");
}

export default function SocialTab() {
  const t = useT();
  const kpis = useSocialKpis(30);
  const { refreshing, onRefresh } = useScreenRefresh();
  const [tab, setTab] = useState(0);

  const labels = TAB_KEYS.map((key) => t(key));
  const summary = kpiSummary(kpis.data, t);

  return (
    <ScreenGround>
      <SafeAreaView edges={["top"]} className="flex-1">
        <BentoHeader
          eyebrow="ZERNIO"
          title={t("Sosyal")}
          onSync={onRefresh}
          syncing={refreshing}
          settings
        />
        <View className="gap-sm px-screenX pb-sm">
          {summary != null ? (
            <Text className="font-mono-medium text-meta text-fg2" numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
          <NativeSegmented
            value={labels[tab] ?? labels[0] ?? ""}
            options={labels}
            onChange={(label) => {
              const next = labels.indexOf(label);
              if (next < 0 || next === tab) return;
              haptic.selection();
              setTab(next);
            }}
          />
        </View>

        {tab === 0 ? <LibraryView /> : tab === 1 ? <QueueView /> : <AccountsView onRefresh={onRefresh} refreshing={refreshing} />}
      </SafeAreaView>
    </ScreenGround>
  );
}

function LibraryView() {
  const t = useT();
  const { theme } = useTheme();
  const router = useRouter();
  const library = useSocialLibrary();
  const posts = useSocialPosts();
  const scheduleAll = useScheduleAllSocial();
  const refresh = useRefreshSocialPosts();

  const items = library.data ?? [];
  // Time: O(p) map + O(n) sayim. Satir basina durum Map'ten O(1) okunur.
  const latest = useMemo(() => latestPostByLibrary(posts.data ?? []), [posts.data]);
  const readyCount = useMemo(() => {
    let n = 0;
    for (const item of items) {
      const post = latest.get(item.id);
      if (post == null || !isActivePost(post.status)) n += 1;
    }
    return n;
  }, [items, latest]);

  function confirmScheduleAll() {
    const first = items[0];
    if (first == null || readyCount === 0) return;
    haptic.press();
    Alert.alert(
      t("Hepsini planla"),
      t("{n} video her gün 20:00'de birer birer planlanacak. İlki en erken yarın.", { n: readyCount }),
      [
        { text: t("Vazgeç"), style: "cancel" },
        {
          text: t("Planla"),
          // Kutuphane ogeleri tek projeye ait (spec); proje id'si ilk ogeden.
          onPress: () => scheduleAll.mutate({ projectId: first.project_id, platforms: [...SOCIAL_PLATFORMS] }),
        },
      ],
    );
  }

  const header =
    items.length === 0 ? null : (
      <View>
        <View className="flex-row items-center justify-between py-sm">
          <Text className="font-mono-medium text-meta text-fg3">
            {t("{n} video · {m} hazır", { n: items.length, m: readyCount })}
          </Text>
          <TextAction
            label={t("Hepsini planla")}
            color={theme.accent}
            disabled={readyCount === 0 || scheduleAll.isPending}
            onPress={confirmScheduleAll}
          />
        </View>
        {posts.error != null ? (
          <SocialNotice tone="danger" label={t("Paylaşım durumları okunamadı: {e}", { e: posts.error.message })} />
        ) : null}
      </View>
    );

  return (
    <FlatList<SocialLibraryItem>
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={listStyle}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={header}
      ListEmptyComponent={
        library.isLoading ? (
          <SocialNotice loading label={t("Kütüphane yükleniyor")} />
        ) : library.error != null ? (
          <SocialNotice tone="danger" label={library.error.message} />
        ) : (
          <SocialNotice label={t("Kütüphane boş. Videoları scripts/social/import-library.ts ile içe aktar.")} />
        )
      }
      refreshControl={
        <RefreshControl tintColor={theme.fg} refreshing={refresh.isPending} onRefresh={() => refresh.mutate()} />
      }
      renderItem={({ item, index }) => (
        <LibraryRow
          item={item}
          state={socialItemState(latest.get(item.id))}
          divider={index > 0}
          onPress={() => {
            haptic.tap();
            router.push({ pathname: "/social/[id]", params: { id: item.id } });
          }}
        />
      )}
    />
  );
}

type QueueSection = { key: string; title: string; data: SocialPost[] };

function QueueView() {
  const t = useT();
  const { theme } = useTheme();
  const library = useSocialLibrary();
  const posts = useSocialPosts();
  const cancel = useCancelSocialPost();
  const refresh = useRefreshSocialPosts();

  const itemsById = useMemo(
    () => new Map((library.data ?? []).map((item) => [item.id, item] as const)),
    [library.data],
  );
  const sections = useMemo<QueueSection[]>(() => {
    const q = groupSocialQueue(posts.data ?? []);
    return [
      { key: "scheduled", title: t("Planlı"), data: q.scheduled },
      { key: "published", title: t("Yayınlanan"), data: q.published },
      { key: "failed", title: t("Hatalı"), data: q.failed },
    ].filter((s) => s.data.length > 0);
  }, [posts.data, t]);

  function confirmCancel(post: SocialPost) {
    haptic.press();
    Alert.alert(t("Planı iptal et"), t("Bu paylaşım Zernio'dan silinecek."), [
      { text: t("Vazgeç"), style: "cancel" },
      { text: t("İptal et"), style: "destructive", onPress: () => cancel.mutate(post.id) },
    ]);
  }

  return (
    <SectionList<SocialPost, QueueSection>
      sections={sections}
      keyExtractor={(post) => post.id}
      contentContainerStyle={listStyle}
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled={false}
      ListEmptyComponent={
        posts.isLoading ? (
          <SocialNotice loading label={t("Kuyruk yükleniyor")} />
        ) : posts.error != null ? (
          <SocialNotice tone="danger" label={posts.error.message} />
        ) : (
          <SocialNotice label={t("Kuyruk boş. Kütüphaneden bir video paylaş ya da planla.")} />
        )
      }
      refreshControl={
        <RefreshControl tintColor={theme.fg} refreshing={refresh.isPending} onRefresh={() => refresh.mutate()} />
      }
      renderSectionHeader={({ section }) => (
        <View className="flex-row items-baseline gap-sm pt-tilePad pb-xs">
          <Text className="font-semibold text-emph text-fg">{section.title}</Text>
          <Text className="font-mono-medium text-meta text-fg3">{section.data.length}</Text>
        </View>
      )}
      renderItem={({ item, index }) => (
        <QueueRow
          post={item}
          item={item.library_id == null ? undefined : itemsById.get(item.library_id)}
          divider={index > 0}
          onCancel={item.status === "scheduled" && !cancel.isPending ? () => confirmCancel(item) : null}
        />
      )}
    />
  );
}

function AccountsView({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  const t = useT();
  const { theme } = useTheme();
  const accounts = useSocialAccounts();
  const list = accounts.data ?? [];

  return (
    <ScrollView
      contentContainerStyle={listStyle}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl tintColor={theme.fg} refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {accounts.isLoading ? (
        <SocialNotice loading label={t("Hesaplar yükleniyor")} />
      ) : accounts.error != null ? (
        <SocialNotice tone="danger" label={accounts.error.message} />
      ) : list.length === 0 ? (
        <SocialNotice label={t("Bağlı sosyal hesap yok - web'den Zernio'yu bağla")} />
      ) : (
        list.map((account, i) => <AccountRow key={account.id} account={account} divider={i > 0} />)
      )}
    </ScrollView>
  );
}
