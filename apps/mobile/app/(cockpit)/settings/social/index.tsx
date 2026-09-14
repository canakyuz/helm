import { Image, Linking, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { press, space, withAlpha } from "@helm/design";

import { useSocialAccounts, useSocialKpis } from "~/hooks/use-social";
import { useScreenRefresh } from "~/hooks/use-screen-refresh";
import { formatInteger } from "~/lib/format";
import { haptic } from "~/lib/haptics";
import { useT } from "~/lib/i18n";
import { useTheme } from "~/theme/use-theme";
import { ScreenStatus } from "~/components/screen-status";
import { StatTile, statFontSize } from "~/components/overview";
import { ScreenGround, BentoHeader, BentoTile, Empty, Rise } from "~/components/bento";

export default function SocialOverview() {
  const router = useRouter();
  const { theme } = useTheme();
  const t = useT();
  const accounts = useSocialAccounts();
  const kpis = useSocialKpis(30);
  const { refreshing, onRefresh } = useScreenRefresh();

  if (accounts.isLoading || kpis.isLoading) return <ScreenStatus label={t("Sosyal veriler yükleniyor")} />;
  if (accounts.error) return <ScreenStatus label={accounts.error.message} tone="danger" />;

  const list = accounts.data ?? [];
  const k = kpis.data;
  const followers = k?.followers == null ? "-" : formatInteger(k.followers);
  const impressions = k ? formatInteger(k.impressions) : "-";
  const engagements = k ? formatInteger(k.engagements) : "-";
  const statSize = statFontSize([followers, impressions, engagements]);

  return (
    <ScreenGround>
      <SafeAreaView edges={["top"]} className="flex-1">
        <BentoHeader eyebrow={t("SOSYAL")} title={t("Hesaplar")} onBack={() => router.back()} />
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: space.screenX,
            paddingBottom: 120,
            gap: space.tileGap,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View className="flex-row gap-tileGap">
            <StatTile index={0} replayKey={0} label={t("TAKİPÇİ")} value={followers} delta={k?.followersDelta} fontSize={statSize} note={followers === "-" ? t("ölçüm yok") : undefined} />
            <StatTile index={1} replayKey={0} label="IMPR." value={impressions} delta={k?.impressionsDelta} fontSize={statSize} />
            <StatTile index={2} replayKey={0} label={t("ETKİLEŞİM")} value={engagements} delta={k?.engagementsDelta} fontSize={statSize} />
          </View>

          <Rise index={3}>
            <BentoTile>
              {list.length === 0 ? (
                <Empty label={t("Bağlı sosyal hesap yok - web'den Zernio'yu bağla")} />
              ) : (
                list.map((a, i) => (
                  <Pressable
                    key={a.id}
                    onPress={() => {
                      if (!a.profile_url) return;
                      haptic.tap();
                      Linking.openURL(a.profile_url);
                    }}
                    style={({ pressed }) => [
                      { flexDirection: "row", alignItems: "center", gap: space.tilePadSm, paddingVertical: space.tilePadSm },
                      i > 0 && { borderTopWidth: 1, borderTopColor: withAlpha(theme.fg3, 0.2) },
                      pressed && { opacity: press.opacity },
                    ]}
                  >
                    {a.avatar_url ? (
                      <Image source={{ uri: a.avatar_url }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                    ) : (
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: withAlpha(theme.fg3, 0.2) }} />
                    )}
                    <View className="flex-1">
                      <Text className="font-semibold text-body text-fg">{a.display_name ?? a.username ?? a.id}</Text>
                      <Text className="font-mono-medium text-eyebrow tracking-wide text-fg3">
                        {a.platform.toUpperCase()}{a.username ? ` · @${a.username}` : ""}
                      </Text>
                    </View>
                    <Text className="font-mono-medium text-body text-fg" style={a.needs_reconnection ? { color: theme.neg } : undefined}>
                      {a.needs_reconnection ? t("yeniden bağla") : a.followers_count == null ? "-" : formatInteger(a.followers_count)}
                    </Text>
                  </Pressable>
                ))
              )}
            </BentoTile>
          </Rise>
        </ScrollView>
      </SafeAreaView>
    </ScreenGround>
  );
}
