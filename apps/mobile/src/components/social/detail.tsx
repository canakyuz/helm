import { type ReactNode } from "react";
import { Share, Text, View } from "react-native";

import { haptic } from "~/lib/haptics";
import { useT } from "~/lib/i18n";
import { useTheme } from "~/theme/use-theme";
import { TextAction } from "./controls";

/**
 * Detay ekraninin bolumu: ustte hairline, basliginda duz metin.
 * Kart degil - bolumler ayni zeminde, hairline ritmiyle ayrilir.
 */
export function DetailSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View className="border-t border-line py-tilePad">
      <View className="mb-sm flex-row items-center justify-between">
        <Text className="font-semibold text-emph text-fg">{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

/**
 * Platform metni + "Kopyala".
 *
 * NEDEN Share.share: projede clipboard modulu yok ve yeni native modul OTA ile
 * cikamaz. iOS paylas menusunde "Kopyala" ilk satirda; ayni is tek dokunusla
 * daha fazla hedefe (Notlar, TikTok) de acilir. Metin ayrica secilebilir.
 */
export function CaptionBlock({ title, text }: { title: string; text: string }) {
  const t = useT();
  const { theme } = useTheme();
  const empty = text.trim().length === 0;

  return (
    <DetailSection
      title={title}
      action={
        <TextAction
          label={t("Kopyala")}
          color={theme.accent}
          disabled={empty}
          onPress={() => {
            haptic.tap();
            void Share.share({ message: text });
          }}
        />
      }
    >
      <Text selectable className="text-body text-fg2" style={{ lineHeight: 19 }}>
        {empty ? t("Metin yok") : text}
      </Text>
    </DetailSection>
  );
}
