import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

import { supabase } from "~/lib/supabase";

// Foreground'da gelen bildirimi banner + listede göster, ses çal, badge'e dokunma.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// İzin iste + Expo push token al. Simülatörde / izin reddinde / entitlement yoksa
// throw eder → null döner (non-fatal). Gerçek cihaz + grant → ExponentPushToken[...].
export async function registerForPush(): Promise<string | null> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) return null;

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
}

// Token'ı hub'a yaz. (user_id, token) unique → aynı token tekrar gelince no-op upsert.
export async function savePushToken(userId: string, token: string): Promise<void> {
  await supabase.from("helm_push_devices").upsert(
    {
      user_id: userId,
      token,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,token" },
  );
}
