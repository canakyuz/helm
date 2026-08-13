import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { ACCENTS, press, radius as R } from "@helm/design";

import { haptic } from "~/lib/haptics";
import { preferences, type Accent } from "~/lib/preferences";
import { useTheme } from "~/theme/use-theme";

/**
 * Ayar satiri. onPress verilmezse basilamaz — dekoratif buton yok.
 *
 * Eski ekranda dokuz satir `onPress={() => haptic.tap()}` idi: basinca titriyor,
 * baska hicbir sey yapmiyordu. Redesign'da tasinmadilar; calismayan bir butonu
 * yeniden cizmek onu calisiyormus gibi gosterir.
 */
export function SettingsRow({
  label,
  sub,
  value,
  right,
  divider,
  onPress,
}: {
  label: string;
  sub?: string;
  value?: string;
  right?: ReactNode;
  divider?: boolean;
  onPress?: () => void;
}) {
  const body = (
    // Bolucu `border-line` — uygulamanin geri kalaniyla ayni token. Onceki hali
    // elle yazilmis rgba(128,128,128,0.18) idi: tema-kor (acik temada yanlis
    // tarafa duser) ve olculdugunde cam yuzeyde theme.line'dan DAHA DUSUK
    // kontrast veriyordu (1.24:1 karsi 1.33:1) — yani gorunurluk de kazandirmiyordu.
    <View
      className={`flex-row items-center justify-between py-headerY${
        divider === true ? " border-t border-line" : ""
      }`}
    >
      <View className="mr-rowY flex-1">
        <Text className="font-medium text-emph text-fg">{label}</Text>
        {sub != null ? <Text className="mt-[1px] text-meta text-fg3">{sub}</Text> : null}
      </View>
      {right ?? (
        <Text className="font-mono-semibold text-body text-fg2">
          {value}
          {onPress != null ? " ›" : ""}
        </Text>
      )}
    </View>
  );

  if (onPress == null) return body;

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <View style={pressed ? { opacity: press.opacity } : undefined}>{body}</View>
      )}
    </Pressable>
  );
}

/**
 * Accent secici — renk orneklerinin kendisi.
 *
 * Ad yerine RENK gosteriliyor: "Teal" yazisi hangi tonu sececegini soylemez,
 * ornek soyler. Secili olan halka ile isaretlenir; renk korlugunde de ayirt
 * edilebilsin diye ayrim yalnizca renge birakilmiyor.
 */
export function AccentPicker({ value }: { value: Accent }) {
  const { name, theme } = useTheme();

  return (
    <View className="flex-row gap-sm">
      {ACCENTS.map((a) => {
        const swatch = name === "dark" ? a.dark : a.light;
        const active = a.id === value;
        return (
          <Pressable
            key={a.id}
            onPress={() => {
              if (active) return;
              haptic.tap();
              preferences.setAccent(a.id);
            }}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            accessibilityState={{ selected: active }}
          >
            {({ pressed }) => (
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: R.pill,
                  backgroundColor: swatch,
                  borderWidth: active ? 2 : 0,
                  borderColor: theme.fg,
                  opacity: pressed && !active ? press.opacity : 1,
                }}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
