import { View, Text, Pressable } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { usePreferences, preferences, type Currency } from "~/lib/preferences";
import { pushWidgetSnapshot } from "~/lib/push-widget-snapshot";
import { useFxRates } from "~/hooks/use-fx-rates";
import { haptic } from "~/lib/haptics";
import { colors } from "~/theme/tokens";

const CURRENCIES: Array<{ code: Currency; symbol: string }> = [
  { code: "TRY", symbol: "₺" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
];

export function CurrencyPicker() {
  const queryClient = useQueryClient();
  const { currency } = usePreferences();
  const { data: rates, isLoading } = useFxRates();

  const rate = rates?.[currency] ?? 1;
  const rateLabel =
    currency === "TRY"
      ? "HUB BAZ · 1:1"
      : isLoading
      ? "KUR YÜKLENIYOR"
      : `1 TRY ≈ ${rate.toFixed(4)} ${currency}`;

  return (
    <View
      style={{
        backgroundColor: colors.bgElevated,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        gap: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text
          style={{
            fontFamily: "GeistMono-600",
            fontSize: 10,
            letterSpacing: 2,
            color: colors.fgMuted,
          }}
        >
          PARA BİRİMİ
        </Text>
        <Text
          style={{
            fontFamily: "GeistMono-500",
            fontSize: 9,
            letterSpacing: 1.2,
            color: colors.fgSubtle,
          }}
        >
          {rateLabel}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {CURRENCIES.map((c) => {
          const active = currency === c.code;
          return (
            <Pressable
              key={c.code}
              onPress={() => {
                haptic.selection();
                preferences.setCurrency(c.code);
                pushWidgetSnapshot(queryClient);
              }}
              style={{
                flex: 1,
                backgroundColor: active ? colors.accent : colors.bgHigher,
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: "center",
                gap: 3,
              }}
            >
              <Text
                style={{
                  fontFamily: "GeistMono-600",
                  fontSize: 20,
                  color: active ? colors.bgBase : colors.fgPrimary,
                  lineHeight: 22,
                }}
              >
                {c.symbol}
              </Text>
              <Text
                style={{
                  fontFamily: "GeistMono-500",
                  fontSize: 9,
                  letterSpacing: 1.2,
                  color: active ? colors.bgBase : colors.fgMuted,
                }}
              >
                {c.code}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
