import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";

import { useAuth } from "~/hooks/use-auth";
import { ScreenGround } from "~/components/bento/ground";
import { useTheme } from "~/theme/use-theme";

export default function Index() {
  const { session, isLoading } = useAuth();
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <ScreenGround>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={theme.fg3} />
        </View>
      </ScreenGround>
    );
  }

  if (session) {
    return <Redirect href="/(cockpit)/overview" />;
  }

  return <Redirect href="/(auth)/login" />;
}
