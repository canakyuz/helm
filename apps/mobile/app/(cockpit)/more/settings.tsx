import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";

import { useAuth } from "~/hooks/use-auth";
import { supabase } from "~/lib/supabase";
import { Icon } from "~/components/ui/icon";
import { CurrencyPicker } from "~/components/currency-picker";
import { haptic } from "~/lib/haptics";
import { toast } from "~/lib/toast";
import { colors } from "~/theme/tokens";

function SectionLabel({
  children,
  accent = "#D4FF4D",
}: {
  children: string;
  accent?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 2,
        paddingTop: 8,
      }}
    >
      <View
        style={{
          width: 5,
          height: 5,
          borderRadius: 3,
          backgroundColor: accent,
          shadowColor: accent,
          shadowOpacity: 0.7,
          shadowRadius: 5,
          shadowOffset: { width: 0, height: 0 },
        }}
      />
      <Text
        style={{
          fontFamily: "GeistMono-600",
          fontSize: 10,
          letterSpacing: 2,
          color: colors.fgMuted,
        }}
      >
        {children.toUpperCase()}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  );
}

export default function Settings() {
  const { session } = useAuth();

  async function logout() {
    haptic.press();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Çıkış yapılamadı", error.message);
      return;
    }
    toast.success("Çıkış yapıldı");
  }

  const version = Constants.expoConfig?.version ?? "0.0.0";
  const build = Constants.expoConfig?.ios?.buildNumber ?? "?";
  const email = session?.user.email ?? "—";
  const initial = email[0]?.toUpperCase() ?? "?";
  const hubHost = (process.env.EXPO_PUBLIC_HELM_SUPABASE_URL ?? "")
    .replace("https://", "")
    .replace(".supabase.co", "");

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 96 }}>
        <SectionLabel>Hesap</SectionLabel>

        <View
          style={{
            backgroundColor: colors.bgElevated,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: colors.bgHigher,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Geist-600",
                fontSize: 20,
                color: colors.accent,
              }}
            >
              {initial}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text
              style={{
                fontFamily: "Geist-600",
                fontSize: 14,
                color: colors.fgPrimary,
                letterSpacing: -0.2,
              }}
              numberOfLines={1}
            >
              {email}
            </Text>
            <Text
              style={{
                fontFamily: "GeistMono-500",
                fontSize: 10,
                color: colors.fgMuted,
                letterSpacing: 0.8,
              }}
            >
              SON GİRİŞ ·{" "}
              {session?.user.last_sign_in_at
                ? new Date(session.user.last_sign_in_at)
                    .toLocaleDateString("tr-TR", {
                      day: "numeric",
                      month: "short",
                    })
                    .toUpperCase()
                : "—"}
            </Text>
          </View>
        </View>

        <SectionLabel>Tercihler</SectionLabel>

        <CurrencyPicker />

        <SectionLabel>Sürüm</SectionLabel>

        <View
          style={{
            backgroundColor: colors.bgElevated,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            <Text
              style={{
                fontFamily: "Geist-700",
                fontSize: 22,
                color: colors.fgPrimary,
                letterSpacing: -0.5,
              }}
            >
              helm
            </Text>
            <View
              style={{
                backgroundColor: colors.bgHigher,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
              }}
            >
              <Text
                style={{
                  fontFamily: "GeistMono-600",
                  fontSize: 9,
                  color: colors.fgMuted,
                  letterSpacing: 1.2,
                }}
              >
                MOBILE
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 16 }}>
            <View>
              <Text
                style={{
                  fontFamily: "GeistMono-500",
                  fontSize: 9,
                  color: colors.fgSubtle,
                  letterSpacing: 1.2,
                }}
              >
                SÜRÜM
              </Text>
              <Text
                style={{
                  fontFamily: "GeistMono-600",
                  fontSize: 13,
                  color: colors.fgPrimary,
                  marginTop: 2,
                }}
              >
                v{version}
              </Text>
            </View>
            <View>
              <Text
                style={{
                  fontFamily: "GeistMono-500",
                  fontSize: 9,
                  color: colors.fgSubtle,
                  letterSpacing: 1.2,
                }}
              >
                BUILD
              </Text>
              <Text
                style={{
                  fontFamily: "GeistMono-600",
                  fontSize: 13,
                  color: colors.fgPrimary,
                  marginTop: 2,
                }}
              >
                #{build}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "GeistMono-500",
                  fontSize: 9,
                  color: colors.fgSubtle,
                  letterSpacing: 1.2,
                }}
              >
                HUB
              </Text>
              <Text
                style={{
                  fontFamily: "GeistMono-600",
                  fontSize: 13,
                  color: colors.fgPrimary,
                  marginTop: 2,
                }}
                numberOfLines={1}
              >
                {hubHost}
              </Text>
            </View>
          </View>
        </View>

        <Pressable onPress={logout} style={{ marginTop: 8 }}>
          {({ pressed }) => (
            <View
              style={{
                backgroundColor: pressed
                  ? `${colors.accentDanger}20`
                  : colors.bgElevated,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: `${colors.accentDanger}40`,
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Icon name="logOut" size={16} color={colors.accentDanger} />
              <Text
                style={{
                  fontFamily: "GeistMono-600",
                  fontSize: 11,
                  letterSpacing: 1.8,
                  color: colors.accentDanger,
                  flex: 1,
                }}
              >
                ÇIKIŞ YAP
              </Text>
              <Icon name="chevronRight" size={14} color={`${colors.accentDanger}80`} />
            </View>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
