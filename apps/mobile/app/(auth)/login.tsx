import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "~/lib/supabase";
import { Icon } from "~/components/ui/icon";
import { colors } from "~/theme/tokens";

type Status = "idle" | "signing" | "error";

export default function Login() {
  const [email, setEmail] = useState("canakyuz23@gmail.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function signIn() {
    if (!email.includes("@") || password.length < 6) {
      setErrorMsg("E-posta ve en az 6 karakter şifre gir.");
      setStatus("error");
      return;
    }
    setStatus("signing");
    setErrorMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.warn("[auth] sign-in error", error.message);
      setErrorMsg("E-posta veya şifre hatalı.");
      setStatus("error");
      return;
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgBase, paddingHorizontal: 24 }}>
      <View style={{ flex: 1, justifyContent: "center", gap: 28 }}>
        {/* Hero */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: colors.accent,
                shadowColor: colors.accent,
                shadowOpacity: 1,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 0 },
              }}
            />
            <Text
              style={{
                fontFamily: "GeistMono-500",
                fontSize: 10,
                letterSpacing: 2,
                color: colors.fgMuted,
              }}
            >
              FOUNDER'S BRIDGE · LIVE
            </Text>
          </View>
          <Text
            style={{
              fontFamily: "Geist-700",
              fontSize: 56,
              color: colors.fgPrimary,
              letterSpacing: -3,
              lineHeight: 60,
            }}
          >
            helm
          </Text>
          <Text
            style={{
              fontFamily: "Geist-400",
              fontSize: 14,
              color: colors.fgMuted,
              letterSpacing: -0.2,
              lineHeight: 20,
            }}
          >
            Cockpit'in cep yoldaşı. Portföyün, kuruşuna kadar.
          </Text>
        </View>

        {/* Form */}
        <View style={{ gap: 14 }}>
          <View style={{ gap: 6 }}>
            <Text
              style={{
                fontFamily: "GeistMono-500",
                fontSize: 9,
                letterSpacing: 1.8,
                color: colors.fgMuted,
              }}
            >
              E-POSTA
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="can@example.com"
              placeholderTextColor={colors.fgSubtle}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={{
                backgroundColor: colors.bgElevated,
                color: colors.fgPrimary,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 13,
                fontFamily: "Geist-500",
                fontSize: 15,
              }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text
              style={{
                fontFamily: "GeistMono-500",
                fontSize: 9,
                letterSpacing: 1.8,
                color: colors.fgMuted,
              }}
            >
              ŞİFRE
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.bgElevated,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
              }}
            >
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.fgSubtle}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={signIn}
                returnKeyType="go"
                style={{
                  flex: 1,
                  color: colors.fgPrimary,
                  paddingHorizontal: 14,
                  paddingVertical: 13,
                  fontFamily: "Geist-500",
                  fontSize: 15,
                }}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={10}
                style={{ paddingHorizontal: 14, paddingVertical: 13 }}
              >
                <Icon
                  name={showPassword ? "eyeOff" : "eye"}
                  size={16}
                  color={colors.fgMuted}
                />
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={signIn}
            disabled={status === "signing"}
            style={{
              backgroundColor: colors.accent,
              borderRadius: 12,
              paddingVertical: 15,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 10,
              opacity: status === "signing" ? 0.5 : 1,
              marginTop: 4,
            }}
          >
            {status === "signing" ? (
              <ActivityIndicator color={colors.bgBase} />
            ) : (
              <>
                <Text
                  style={{
                    fontFamily: "GeistMono-600",
                    fontSize: 12,
                    color: colors.bgBase,
                    letterSpacing: 2,
                  }}
                >
                  GİRİŞ YAP
                </Text>
                <Icon name="chevronRight" size={14} color={colors.bgBase} />
              </>
            )}
          </Pressable>

          {status === "error" && errorMsg ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 4,
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: colors.accentDanger,
                }}
              />
              <Text
                style={{
                  fontFamily: "GeistMono-500",
                  fontSize: 11,
                  color: colors.accentDanger,
                  letterSpacing: 0.3,
                }}
              >
                {errorMsg}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Footer */}
        <View style={{ alignItems: "center", paddingTop: 8 }}>
          <Text
            style={{
              fontFamily: "GeistMono-500",
              fontSize: 9,
              letterSpacing: 1.5,
              color: colors.fgSubtle,
            }}
          >
            v0.1.0 · TESTFLIGHT
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
