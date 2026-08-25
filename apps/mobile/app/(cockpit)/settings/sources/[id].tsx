import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { providerLabel } from "@helm/domain";
import { press, space } from "@helm/design";

import {
  useDeleteIntegration,
  useIntegrationConfig,
  useSetIntegrationEnabled,
  useUpdateIntegrationConfig,
} from "~/hooks/use-integrations";
import { haptic } from "~/lib/haptics";
import { useT } from "~/lib/i18n";
import { useTheme } from "~/theme/use-theme";
import { Toggle } from "~/components/liquid";
import { ScreenGround, BentoHeader, BentoTile, Empty, Rise } from "~/components/bento";
import { IntegrationForm, SettingsRow as Row } from "~/components/settings";

export default function SourceDetail() {
  const router = useRouter();
  const { theme } = useTheme();
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();

  const config = useIntegrationConfig(id ?? "");
  const update = useUpdateIntegrationConfig();
  const setEnabled = useSetIntegrationEnabled();
  const remove = useDeleteIntegration();

  const data = config.data;

  function confirmDelete() {
    if (data == null) return;
    haptic.tap();
    Alert.alert(
      t("Kaynağı kaldır"),
      t("{p} bağlantısı ve ayarları silinecek. Toplanmış metrikler kalır.", {
        p: providerLabel(data.provider),
      }),
      [
        { text: t("Vazgeç"), style: "cancel" },
        {
          text: t("Kaldır"),
          style: "destructive",
          onPress: () => remove.mutate(data.id, { onSuccess: () => router.back() }),
        },
      ],
    );
  }

  return (
    <ScreenGround>
      <SafeAreaView edges={["top"]} className="flex-1">
        <BentoHeader
          eyebrow={t("KAYNAK")}
          title={data != null ? providerLabel(data.provider) : t("Kaynak")}
          onBack={() => router.back()}
        />

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={90}
        >
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: space.screenX,
              paddingBottom: 160,
              gap: space.tileGap,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {config.isLoading && data == null ? (
              <Rise index={0}>
                <BentoTile>
                  <Empty label={t("YÜKLENİYOR")} />
                </BentoTile>
              </Rise>
            ) : config.isError || data == null ? (
              <Rise index={0}>
                <BentoTile>
                  <Empty label={t("KAYNAK OKUNAMADI")} />
                </BentoTile>
              </Rise>
            ) : (
              <>
                <Rise index={0}>
                  <BentoTile>
                    <Row
                      label={t("Etkin")}
                      sub={data.enabled ? t("senkrona dahil") : t("senkron dışı")}
                      right={
                        <Toggle
                          on={data.enabled}
                          offColor={theme.tile2}
                          onColor={theme.accent}
                          onChange={(v) => {
                            haptic.tap();
                            setEnabled.mutate({ id: data.id, enabled: v });
                          }}
                        />
                      }
                    />
                    {data.lastSyncStatus === "error" && data.lastSyncError != null ? (
                      <View className="border-t border-line py-rowY">
                        <Text className="font-medium text-row" style={{ color: theme.neg }}>
                          {t("Son senkron hatası")}
                        </Text>
                        {/* Ham hata mesaji: tek kullanicili ic arac, teshis
                            genellestirmekten daha degerli. */}
                        <Text className="mt-xs font-mono text-meta text-fg2">
                          {data.lastSyncError}
                        </Text>
                      </View>
                    ) : null}
                  </BentoTile>
                </Rise>

                <Rise index={1}>
                  <BentoTile>
                    <IntegrationForm
                      provider={data.provider}
                      initial={data.config}
                      secretKeysSet={data.secretKeysSet}
                      submitLabel={t("Kaydet")}
                      submitting={update.isPending}
                      onSubmit={(patch) => update.mutate({ id: data.id, patch })}
                    />
                  </BentoTile>
                </Rise>

                {/* Yikici eylem, hub'daki "Cikis yap" ile ayni bicimde: chevron
                    YOK, cunku bir yere gitmiyor - onay diyalogu aciyor. */}
                <Rise index={2}>
                  <Pressable onPress={confirmDelete} accessibilityRole="button">
                    {({ pressed }) => (
                      <View style={pressed ? { opacity: press.opacity } : undefined}>
                        <BentoTile padding={space.tilePadSm}>
                          <Text
                            className="font-semibold text-emph"
                            style={{ color: theme.neg }}
                          >
                            {t("Kaynağı kaldır")}
                          </Text>
                        </BentoTile>
                      </View>
                    )}
                  </Pressable>
                </Rise>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenGround>
  );
}
