import { useT } from "~/lib/i18n";
import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePreferences, preferences } from "~/lib/preferences";
import {
  usePropertyList,
  type PropertyListItem,
} from "~/hooks/use-property-list";
import { Icon, type IconName } from "~/components/ui/icon";
import { haptic } from "~/lib/haptics";
import { colors } from "~/theme/tokens";
import type { PropertyType } from "~/hooks/use-properties";

const TYPE_ICON: Record<PropertyType, IconName> = {
  website: "layers",
  web_app: "layers",
  mobile_app: "activity",
  desktop_app: "layers",
  game: "activity",
};

export function PropertyPicker() {
  const t = useT();
  const { selectedPropertyId } = usePreferences();
  const { data } = usePropertyList();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = useMemo<PropertyListItem | null>(() => {
    if (selectedPropertyId === "all" || !data) return null;
    return data.find((p) => p.id === selectedPropertyId) ?? null;
  }, [selectedPropertyId, data]);

  const filtered = useMemo(() => {
    const list = data ?? [];
    if (!search.trim()) return list;
    const needle = search.toLowerCase();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        (p.brandName?.toLowerCase().includes(needle) ?? false),
    );
  }, [data, search]);

  function close() {
    setOpen(false);
    setSearch("");
  }

  function select(id: string) {
    haptic.selection();
    preferences.setSelectedProperty(id);
    close();
  }

  return (
    <>
      <Pressable
        onPress={() => {
          haptic.tap();
          setOpen(true);
        }}
        className="flex-row items-center justify-center gap-2 py-2 active:opacity-70"
        hitSlop={8}
      >
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: selected ? colors.accent : colors.fgMuted,
          }}
        />
        <Text
          style={{
            fontFamily: "Geist-600",
            fontSize: 15,
            color: colors.fgPrimary,
            letterSpacing: -0.2,
          }}
        >
          {selected ? selected.name : t("Tüm Projeler")}
        </Text>
        <View style={{ transform: [{ rotate: "90deg" }] }}>
          <Icon name="chevronRight" size={12} color={colors.fgMuted} />
        </View>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={close}
      >
        <SafeAreaView
          edges={["bottom"]}
          style={{ flex: 1, backgroundColor: colors.bgSurface }}
        >
          {/* Header bar */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: colors.accent,
                  shadowColor: colors.accent,
                  shadowOpacity: 0.7,
                  shadowRadius: 5,
                  shadowOffset: { width: 0, height: 0 },
                }}
              />
              <Text
                style={{
                  fontFamily: "GeistMono-600",
                  fontSize: 11,
                  letterSpacing: 2,
                  color: colors.fgMuted,
                }}
              >
                PROJE SEÇ
              </Text>
            </View>
            <Pressable onPress={close} hitSlop={10}>
              <Text
                style={{
                  fontFamily: "GeistMono-600",
                  fontSize: 11,
                  letterSpacing: 1.5,
                  color: colors.fgPrimary,
                }}
              >
                KAPAT
              </Text>
            </Pressable>
          </View>

          {/* Search */}
          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Ara…"
              placeholderTextColor={colors.fgSubtle}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                backgroundColor: colors.bgElevated,
                color: colors.fgPrimary,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 11,
                fontFamily: "Geist-500",
                fontSize: 14,
              }}
            />
          </View>

          {/* List */}
          <FlatList
            data={[{ id: "all" } as PropertyListItem, ...filtered]}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: 32,
              gap: 6,
            }}
            renderItem={({ item }) => {
              const isAll = item.id === "all";
              const active = selectedPropertyId === item.id;
              const icon = isAll
                ? "layers"
                : TYPE_ICON[item.type] ?? "layers";
              return (
                <Pressable
                  onPress={() => select(item.id)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    backgroundColor: pressed
                      ? colors.bgHigher
                      : colors.bgElevated,
                    borderWidth: 1,
                    borderColor: active
                      ? `${colors.accent}40`
                      : colors.border,
                    borderRadius: 12,
                    padding: 12,
                  })}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: active
                        ? `${colors.accent}15`
                        : colors.bgHigher,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon
                      name={icon}
                      size={15}
                      color={active ? colors.accent : colors.fgMuted}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      style={{
                        fontFamily: "Geist-600",
                        fontSize: 14,
                        color: colors.fgPrimary,
                        letterSpacing: -0.2,
                      }}
                      numberOfLines={1}
                    >
                      {isAll ? "Tüm Projeler" : item.name}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "GeistMono-500",
                        fontSize: 9,
                        color: colors.fgMuted,
                        letterSpacing: 1,
                      }}
                      numberOfLines={1}
                    >
                      {isAll
                        ? "AGGREGATE TOPLAM"
                        : (item.brandName ?? "—").toUpperCase()}
                    </Text>
                  </View>
                  {active ? (
                    <Icon
                      name="circleCheck"
                      size={18}
                      color={colors.accent}
                    />
                  ) : (
                    <Icon
                      name="chevronRight"
                      size={14}
                      color={colors.fgSubtle}
                    />
                  )}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}
