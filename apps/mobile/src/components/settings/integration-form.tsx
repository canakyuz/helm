import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { PROVIDER_FIELDS, type FieldDef, type ProviderName } from "@helm/domain";
import { press, radius as R, space } from "@helm/design";

import { haptic } from "~/lib/haptics";
import { useT } from "~/lib/i18n";
import { useTheme } from "~/theme/use-theme";

type Props = {
  provider: ProviderName;
  /** Sir OLMAYAN mevcut degerler. */
  initial?: Record<string, string>;
  /** Kayitli sir alanlarinin anahtarlari - degerleri gelmez, gelmemeli. */
  secretKeysSet?: string[];
  submitLabel: string;
  submitting: boolean;
  onSubmit: (patch: Record<string, string>) => void;
};

/**
 * Saglayici formu - alanlar @helm/domain katalogundan gelir, burada elle
 * tanimlanmaz. Katalog web ile ortak; ikisi ayrisamaz.
 */
export function IntegrationForm({
  provider,
  initial,
  secretKeysSet = [],
  submitLabel,
  submitting,
  onSubmit,
}: Props) {
  const { theme } = useTheme();
  const t = useT();
  const fields = PROVIDER_FIELDS[provider];
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...initial }));

  const missing = useMemo(() => {
    // Zorunlu alan: bos VE kayitli bir sir degilse eksik sayilir.
    return fields.filter((f) => {
      if (f.optional === true) return false;
      const v = (values[f.key] ?? "").trim();
      if (v !== "") return false;
      return !secretKeysSet.includes(f.key);
    });
  }, [fields, values, secretKeysSet]);

  const canSubmit = missing.length === 0 && !submitting;

  return (
    <View style={{ gap: space.tilePadSm }}>
      {fields.map((f) => (
        <Field
          key={f.key}
          def={f}
          value={values[f.key] ?? ""}
          alreadySet={secretKeysSet.includes(f.key)}
          onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
        />
      ))}

      <Pressable
        onPress={() => {
          if (!canSubmit) return;
          haptic.tap();
          onSubmit(values);
        }}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmit }}
      >
        {/* Stil ic View'da: design.md §8 - Pressable'in fonksiyon style'inda
            layout ozellikleri uygulanmiyor, buton dolgusuz/paddingsiz cikardi. */}
        {({ pressed }) => (
          <View
            style={{
              marginTop: space.tilePadSm,
              borderRadius: R.btn,
              paddingVertical: 14,
              alignItems: "center",
              backgroundColor: canSubmit ? theme.accent : theme.tile2,
              opacity: pressed && canSubmit ? press.opacity : 1,
            }}
          >
            <Text
              className="font-semibold text-emph"
              style={{ color: canSubmit ? theme.accentInk : theme.fg3 }}
            >
              {submitting ? t("Kaydediliyor…") : submitLabel}
            </Text>
          </View>
        )}
      </Pressable>

      {missing.length > 0 ? (
        <Text className="text-meta text-fg3">
          {t("Eksik zorunlu alan: {list}", {
            list: missing.map((f) => t(f.label).split(" (")[0]).join(", "),
          })}
        </Text>
      ) : null}
    </View>
  );
}

function Field({
  def,
  value,
  alreadySet,
  onChange,
}: {
  def: FieldDef;
  value: string;
  alreadySet: boolean;
  onChange: (v: string) => void;
}) {
  const { theme } = useTheme();
  const t = useT();

  // Kayitli sir: DEGER GELMEZ. Kullaniciya "dolu ama gostermiyorum" denir;
  // bos birakirsa mevcut deger korunur (bkz. updateIntegrationConfig).
  const placeholder = alreadySet
    ? t("••••••••  kayıtlı - değiştirmek için yeni değer gir")
    : def.placeholder;

  return (
    <View>
      <Text className="font-medium text-row text-fg">
        {t(def.label)}
        {def.optional === true ? (
          <Text className="text-meta text-fg3">  {t("opsiyonel")}</Text>
        ) : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.fg3}
        multiline={def.multiline === true}
        // Sir ve anahtar alanlarinda klavye yardimlari ZARARLI: otomatik buyuk
        // harf bir API anahtarini bozar, otomatik duzeltme JSON'u bozar.
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        textContentType="none"
        style={{
          marginTop: 6,
          borderRadius: R.btn,
          backgroundColor: theme.tile2,
          borderWidth: 1,
          borderColor: theme.line,
          paddingHorizontal: 12,
          paddingVertical: 10,
          minHeight: def.multiline === true ? 120 : 44,
          textAlignVertical: def.multiline === true ? "top" : "center",
          color: theme.fg,
          fontFamily: def.multiline === true ? "GeistMono-400" : "Geist-400",
          fontSize: def.multiline === true ? 12 : 14,
        }}
      />
    </View>
  );
}
