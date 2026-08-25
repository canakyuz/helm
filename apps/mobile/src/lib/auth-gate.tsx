import { type ReactNode } from "react";
import { useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";

import { useAuth } from "~/hooks/use-auth";
import { usePushRegistration } from "~/hooks/use-push-registration";
import { ScreenGround } from "~/components/bento/ground";
import { useTheme } from "~/theme/use-theme";

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { theme } = useTheme();

  // Oturum açıldığında push izni + token kaydı (izin verilene kadar no-op).
  usePushRegistration(session);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace("/(cockpit)/overview");
    }
  }, [session, isLoading, segments, router]);

  if (isLoading) {
    return (
      <ScreenGround>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={theme.fg3} />
        </View>
      </ScreenGround>
    );
  }

  return <>{children}</>;
}
