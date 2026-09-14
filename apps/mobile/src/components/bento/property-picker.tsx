import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { press, radius as R, space } from "@helm/design";

import { useProperties, type PropertyType } from "~/hooks/use-properties";
import { haptic } from "~/lib/haptics";
import { preferences, usePreferences } from "~/lib/preferences";
import { useTheme } from "~/theme/use-theme";
import { useT } from "~/lib/i18n";

const ALL = "Tüm projeler";

/** Tür etiketi. brandName KULLANILMIYOR: çoğu projede marka adı proje adıyla
 *  aynı ve satır "Block Forge · Block Forge" diye tekrar ediyordu. */
const TYPE_LABEL: Record<PropertyType, string> = {
  website: "Web",
  web_app: "Web app",
  mobile_app: "Uygulama",
  desktop_app: "Masaüstü",
  game: "Oyun",
};

/**
 * Seçili projenin görünen adı. Başlık ve tab bar aksesuarı aynı metni göstermeli.
 * Time: O(n) proje; Space: O(1).
 */
export function useSelectedProjectLabel(): string {
  const t = useT();
  const { selectedPropertyId } = usePreferences();
  const properties = useProperties();
  if (selectedPropertyId === "all") return t(ALL);
  return properties.data?.find((p) => p.id === selectedPropertyId)?.name ?? t(ALL);
}

/**
 * Proje seçici - portföy cockpit'inin en temel kontrolü.
 *
 * NEDEN ROUTE, NEDEN MODAL DEĞİL: liste artık `/project-picker` form sheet'i.
 * Aynı seçici hem başlıkta hem tab bar aksesuarında var; aksesuar iki kopya
 * render ediliyor ve yerel `open` state'i kopyalar arasında paylaşılmazdı.
 */
export function PropertyPicker() {
  const t = useT();
  const { theme } = useTheme();
  const router = useRouter();
  const label = useSelectedProjectLabel();

  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        router.push("/project-picker");
      }}
      accessibilityRole="button"
      accessibilityLabel={t("Proje seç")}
    >
      {({ pressed }) => (
        <View
          className="flex-row items-center gap-[6px]"
          style={pressed ? { opacity: press.opacity } : undefined}
        >
          <Text
            className="font-semibold text-title tracking-tighter text-fg"
            numberOfLines={1}
          >
            {label}
          </Text>
          <Text style={{ fontSize: 12, color: theme.fg3, marginTop: 2 }}>▾</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Sheet içeriği: "Tüm projeler" + her proje. Seçim preferences'a yazılır. */
export function ProjectOptionList({ onPicked }: { onPicked: () => void }) {
  const t = useT();
  const { selectedPropertyId } = usePreferences();
  const list = useProperties().data ?? [];

  const pick = (id: string) => {
    haptic.tap();
    preferences.setSelectedProperty(id);
    onPicked();
  };

  return (
    <>
      <Option
        label={t(ALL)}
        sub={t("{n} proje", { n: list.length })}
        active={selectedPropertyId === "all"}
        onPress={() => pick("all")}
      />
      {list.map((p) => (
        <Option
          key={p.id}
          label={p.name}
          sub={t(TYPE_LABEL[p.type] ?? p.type)}
          active={p.id === selectedPropertyId}
          onPress={() => pick(p.id)}
        />
      ))}
    </>
  );
}

function Option({
  label,
  sub,
  active,
  onPress,
}: {
  label: string;
  sub: string;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }}>
      {({ pressed }) => (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: space.tilePad,
            borderRadius: R.tile,
            backgroundColor: active ? theme.chrome : theme.tile2,
            borderWidth: 1,
            borderColor: active ? theme.accent : "transparent",
            opacity: pressed && !active ? press.opacity : 1,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text className="font-medium text-emph tracking-tight text-fg" numberOfLines={1}>
              {label}
            </Text>
            <Text className="mt-[2px] text-meta text-fg3" numberOfLines={1}>
              {sub}
            </Text>
          </View>
          {active ? (
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: R.pill,
                backgroundColor: theme.accent,
              }}
            />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}
