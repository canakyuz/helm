import { ScrollView, Text } from "react-native";
import { useRouter } from "expo-router";
import { space } from "@helm/design";

import { ProjectOptionList } from "~/components/bento/property-picker";
import { useT } from "~/lib/i18n";
import { useTheme } from "~/theme/use-theme";

/**
 * Proje seçim sheet'i. Başlıktaki seçici ve tab bar aksesuarı buraya iter;
 * form sheet ayarı `(cockpit)/_layout.tsx`'te.
 *
 * NEDEN ScreenGround YOK: formSheet, ScrollView'ın yanında en fazla 2 alt görünüm
 * bekliyor. Zeminin Skia katmanları 3. görünüm oluyor ve RNScreens "FormSheet with
 * ScrollView expects at most 2 subviews" uyarısıyla yüksekliği yanlış hesaplıyordu.
 * Kök doğrudan ScrollView, zemin rengi style ile.
 */
export default function ProjectPickerSheet() {
  const router = useRouter();
  const t = useT();
  const { theme } = useTheme();

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={{
        paddingHorizontal: space.screenX,
        paddingVertical: space.headerY,
        gap: space.tileGap,
      }}
    >
      <Text className="font-semibold text-title tracking-tighter text-fg">{t("Proje")}</Text>
      <ProjectOptionList onPicked={() => router.back()} />
    </ScrollView>
  );
}
