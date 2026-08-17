import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
 * Proje seçici — portföy cockpit'inin en temel kontrolü.
 *
 * NEDEN YENİDEN YAZILDI: mevcut src/components/property-picker.tsx (277 satır)
 * eski statik `colors` token'larını kullanıyor — dark hardcode. Bento'da light
 * temada bozulur ve seçili accent'i takip etmez. 277 satırı çevirmek yerine
 * başlığa sığan kompakt ve tema-duyarlı bir sürüm.
 */
export function PropertyPicker() {
  const t = useT();
  const { theme } = useTheme();
  const { selectedPropertyId } = usePreferences();
  const properties = useProperties();
  const [open, setOpen] = useState(false);

  const list = properties.data ?? [];
  const selected = list.find((p) => p.id === selectedPropertyId);
  const label = selectedPropertyId === "all" ? ALL : (selected?.name ?? ALL);

  const pick = (id: string) => {
    haptic.tap();
    preferences.setSelectedProperty(id);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => {
          haptic.tap();
          setOpen(true);
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

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
          <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
            <View
              className="flex-row items-center justify-between"
              style={{ paddingHorizontal: space.screenX, paddingVertical: space.headerY }}
            >
              <Text className="font-semibold text-title tracking-tighter text-fg">
                Proje
              </Text>
              <Pressable onPress={() => setOpen(false)} accessibilityRole="button">
                <Text className="font-mono-medium text-eyebrow tracking-wide text-fg2">
                  KAPAT
                </Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: space.screenX,
                paddingBottom: 40,
                gap: space.tileGap,
              }}
            >
              <Option
                label={ALL}
                sub={`${list.length} proje`}
                active={selectedPropertyId === "all"}
                onPress={() => pick("all")}
              />
              {list.map((p) => (
                <Option
                  key={p.id}
                  label={p.name}
                  sub={TYPE_LABEL[p.type] ?? p.type}
                  active={p.id === selectedPropertyId}
                  onPress={() => pick(p.id)}
                />
              ))}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
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
