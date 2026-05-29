import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";

import { useAuth } from "~/hooks/use-auth";

export default function Index() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg-base">
        <ActivityIndicator color="#fafafa" />
      </View>
    );
  }

  if (session) {
    return <Redirect href="/(cockpit)/(home)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
