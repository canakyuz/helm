import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { PROVIDERS, providerLabel, type ProviderName } from "@helm/domain";
import { press, radius as R, space, withAlpha } from "@helm/design";

import { useCreateIntegration } from "~/hooks/use-integrations";
import { useProperties } from "~/hooks/use-properties";
import { haptic } from "~/lib/haptics";
import { useTheme } from "~/theme/use-theme";
import { BentoBackground, BentoHeader, BentoTile, Empty, Rise } from "~/components/bento";
import { IntegrationForm } from "~/components/settings";

export default function NewSource() {
  const router = useRouter();
  const { theme } = useTheme();
  const properties = useProperties();
  const create = useCreateIntegration();

  const [projectId, setProjectId] = useState<string | null>(null);
  const [provider, setProvider] = useState<ProviderName | null>(null);

  const projects = properties.data ?? [];
  // Tek proje varsa secim sormak gereksiz tiklama — otomatik sec.
  const effectiveProjectId = projectId ?? (projects.length === 1 ? projects[0]!.id : null);

  return (
    <View className="flex-1 bg-canvas">
      <BentoBackground />
      <SafeAreaView edges={["top"]} className="flex-1">
        <BentoHeader eyebrow="KAYNAKLAR" title="Yeni kaynak" onBack={() => router.back()} />

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
            <Rise index={0}>
              <BentoTile>
                <Text className="font-mono-medium text-eyebrow tracking-wide text-fg3">
                  PROJE
                </Text>
                {projects.length === 0 ? (
                  <Empty label="ÖNCE PROJE GEREKLİ" />
                ) : (
                  <View className="mt-sm flex-row flex-wrap gap-sm">
                    {projects.map((p) => (
                      <Chip
                        key={p.id}
                        label={p.name}
                        active={effectiveProjectId === p.id}
                        onPress={() => setProjectId(p.id)}
                      />
                    ))}
                  </View>
                )}
              </BentoTile>
            </Rise>

            <Rise index={1}>
              <BentoTile>
                <Text className="font-mono-medium text-eyebrow tracking-wide text-fg3">
                  SAĞLAYICI
                </Text>
                <View className="mt-sm flex-row flex-wrap gap-sm">
                  {PROVIDERS.map((p) => (
                    <Chip
                      key={p}
                      label={providerLabel(p)}
                      active={provider === p}
                      onPress={() => setProvider(p)}
                    />
                  ))}
                </View>
              </BentoTile>
            </Rise>

            {provider != null && effectiveProjectId != null ? (
              <Rise index={2}>
                <BentoTile>
                  <IntegrationForm
                    provider={provider}
                    submitLabel="Bağla"
                    submitting={create.isPending}
                    onSubmit={(config) =>
                      create.mutate(
                        { projectId: effectiveProjectId, provider, config },
                        { onSuccess: () => router.back() },
                      )
                    }
                  />
                </BentoTile>
              </Rise>
            ) : (
              <Rise index={2}>
                <BentoTile>
                  <Text className="text-meta text-fg3">
                    {effectiveProjectId == null
                      ? "Devam etmek için proje seç."
                      : "Devam etmek için sağlayıcı seç."}
                  </Text>
                </BentoTile>
              </Rise>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {/* Stil Pressable'in FONKSIYON style'inda DEGIL, ic View'da.
          design.md §8: fonksiyon-style'da layout ozellikleri uygulanmiyor —
          ilk yazimda cipin dolgusu, kenarligi ve padding'i tamamen dusuyordu,
          secenekler akan duz metin gibi goruunuyordu. */}
      {({ pressed }) => (
        <View
          style={{
            borderRadius: R.pill,
            paddingHorizontal: 12,
            paddingVertical: 7,
            backgroundColor: active ? theme.accent : theme.tile2,
            borderWidth: 1,
            // `line` DEGIL: o hairline olarak tasarlandi ve tile uzerinde
            // bilerek neredeyse gorunmez. Dokunulabilirlik isareti icin fg3'un
            // alfali hali gerekiyor.
            borderColor: active ? theme.accent : withAlpha(theme.fg3, 0.32),
            opacity: pressed && !active ? press.opacity : 1,
          }}
        >
          <Text
            className="font-medium text-body"
            style={{ color: active ? theme.accentInk : theme.fg2 }}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
