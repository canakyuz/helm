import { useEffect } from "react";
import type { Session } from "@supabase/supabase-js";

import { registerForPush, savePushToken } from "~/lib/push";

// Session geldiğinde push iznini iste ve token'ı hub'a yaz. Tetikleyici (alert →
// push) ayrı turda; bu yalnız izin + token kaydı altyapısı.
export function usePushRegistration(session: Session | null): void {
  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const token = await registerForPush();
      if (!token || cancelled) return;
      await savePushToken(userId, token).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);
}
