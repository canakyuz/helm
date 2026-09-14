import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { press, radius as R } from "@helm/design";

import { useTheme } from "~/theme/use-theme";

/**
 * Listenin yerine gecen tek satirlik durum: yukleniyor / hata / bos.
 * ScreenStatus degil - baslik ve segment ekranda kalmali, yalniz govde degisir.
 */
export function SocialNotice({
  label,
  tone = "default",
  loading = false,
}: {
  label: string;
  tone?: "default" | "danger";
  loading?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View className="flex-row items-center gap-sm py-tilePad">
      {loading ? <ActivityIndicator size="small" color={theme.fg3} /> : null}
      <Text className="flex-1 text-meta" style={{ color: tone === "danger" ? theme.neg : theme.fg2 }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Dolu buton. `primary` accent dolgu - ekranda EN FAZLA bir tane (accent
 * ekonomisi); digerleri chrome yuzey + fg metin.
 *
 * Basma geri bildirimi olcek degil opaklik: projedeki tum Pressable'lar
 * press.opacity kullaniyor, tek buton farkli davranirsa tutarsiz hissettirir.
 */
export function SocialButton({
  label,
  onPress,
  variant = "secondary",
  disabled = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  busy?: boolean;
}) {
  const { theme } = useTheme();
  const primary = variant === "primary";
  const inactive = disabled || busy;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
    >
      {({ pressed }) => (
        <View
          className="h-[46px] flex-row items-center justify-center gap-sm"
          style={{
            borderRadius: R.field,
            backgroundColor: primary ? theme.accent : theme.chrome,
            opacity: inactive ? 0.45 : pressed ? press.opacity : 1,
          }}
        >
          {busy ? <ActivityIndicator size="small" color={primary ? theme.accentInk : theme.fg} /> : null}
          <Text
            className="font-semibold text-emph"
            style={{ color: primary ? theme.accentInk : theme.fg }}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** Metin aksiyonu - satir sonunda "Kopyala", "Hepsini planla", "Planı iptal et". */
export function TextAction({
  label,
  onPress,
  color,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  color: string;
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" hitSlop={10}>
      {({ pressed }) => (
        <Text
          className="font-semibold text-row"
          style={{ color: disabled ? theme.fg3 : color, opacity: pressed ? press.opacity : 1 }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** Secilebilir hizli zaman cipi. Secili: accent kenar, dolgu degil (accent ekonomisi). */
export function ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {({ pressed }) => (
        <View
          className="rounded-pill px-boxPad py-sm"
          style={{
            backgroundColor: theme.tile2,
            borderWidth: 1,
            borderColor: selected ? theme.accent : "transparent",
            opacity: pressed ? press.opacity : 1,
          }}
        >
          <Text
            className="font-mono-semibold text-meta"
            style={{ color: selected ? theme.fg : theme.fg2 }}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
