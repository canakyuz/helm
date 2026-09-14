// Cockpit'e (Can'in telefonuna) Expo push. helm_push_devices'taki tum
// token'lara gider; token yoksa sessizce false. helm-alert'ten tasindi:
// helm-zernio-webhook da ayni kanali kullanir.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Hub = ReturnType<typeof createClient>;

export interface CockpitPushData {
  kind: "alert" | "social";
  [key: string]: unknown;
}

export async function sendCockpitPush(
  hub: Hub,
  title: string,
  body: string,
  data: CockpitPushData,
): Promise<boolean> {
  const { data: devices } = await hub.from("helm_push_devices").select("token");
  const tokens = Array.from(
    new Set(
      (devices ?? [])
        .map((d: { token: string }) => d.token)
        .filter(
          (t: unknown): t is string =>
            typeof t === "string" && t.startsWith("ExponentPushToken["),
        ),
    ),
  );
  if (tokens.length === 0) return false;

  const messages = tokens.map((to) => ({ to, title, body, sound: "default", data }));
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    return res.ok;
  } catch {
    return false;
  }
}
