import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "~/lib/supabase";
import { Icon } from "~/components/ui/icon";
import { colors, type } from "~/theme/tokens";
import { LiquidBackground, LiquidGlass, Eyebrow } from "~/components/liquid";

type Status = "idle" | "signing" | "error";

const FIELD = {
  backgroundColor: "rgba(255,255,255,0.04)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.08)",
  borderRadius: 14,
} as const;

function FieldLabel({ children }: { children: string }) {
  return <Eyebrow size={9}>{children}</Eyebrow>;
}

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
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <LiquidBackground />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 24 }}>
          {/* Brand */}
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: colors.accent }} />
              <Eyebrow>Founder's bridge · live</Eyebrow>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: colors.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontFamily: "GeistMono-600", fontSize: 24, color: colors.accentInk }}>h</Text>
              </View>
              <Text style={{ fontFamily: "Geist-700", fontSize: 44, color: colors.fgPrimary, letterSpacing: -2, lineHeight: 46 }}>
                helm
              </Text>
            </View>
            <Text style={{ fontFamily: "Geist-400", fontSize: type.body, color: colors.fgMuted, lineHeight: 19 }}>
              Cockpit'in cep yoldaşı. Portföyün, kuruşuna kadar.
            </Text>
          </View>

          {/* Form card */}
          <LiquidGlass padding={20}>
            <View style={{ gap: 16 }}>
              <View style={{ gap: 8 }}>
                <FieldLabel>E-POSTA</FieldLabel>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="can@example.com"
                  placeholderTextColor={colors.fgSubtle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  style={{
                    ...FIELD,
                    color: colors.fgPrimary,
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                    fontFamily: "Geist-500",
                    fontSize: 15,
                  }}
                />
              </View>

              <View style={{ gap: 8 }}>
                <FieldLabel>ŞİFRE</FieldLabel>
                <View style={{ ...FIELD, flexDirection: "row", alignItems: "center" }}>
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
                  <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10} style={{ paddingHorizontal: 14, paddingVertical: 13 }}>
                    <Icon name={showPassword ? "eyeOff" : "eye"} size={16} color={colors.fgMuted} />
                  </Pressable>
                </View>
              </View>

              <Pressable
                onPress={signIn}
                disabled={status === "signing"}
                style={{
                  backgroundColor: colors.accent,
                  borderRadius: 14,
                  paddingVertical: 15,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                  opacity: status === "signing" ? 0.5 : 1,
                  marginTop: 4,
                }}
              >
                {status === "signing" ? (
                  <ActivityIndicator color={colors.accentInk} />
                ) : (
                  <>
                    <Text style={{ fontFamily: "GeistMono-600", fontSize: type.bodySm, color: colors.accentInk, letterSpacing: 1.6 }}>
                      GİRİŞ YAP
                    </Text>
                    <Icon name="chevronRight" size={14} color={colors.accentInk} />
                  </>
                )}
              </Pressable>

              {status === "error" && errorMsg ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accentDanger }} />
                  <Text style={{ fontFamily: "GeistMono-500", fontSize: type.bodySm, color: colors.accentDanger, letterSpacing: 0.3 }}>
                    {errorMsg}
                  </Text>
                </View>
              ) : null}
            </View>
          </LiquidGlass>

          {/* Footer */}
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontFamily: "GeistMono-500", fontSize: 9, letterSpacing: 1.5, color: colors.fgSubtle }}>
              v1.0.0 · TESTFLIGHT
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
