import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lastSyncQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";

export type { LastSync } from "@helm/api";

/**
 * Bir calisma surerken damgayi bu sikilikta yokluyoruz.
 *
 * NEDEN SADECE SURERKEN: bos zamanda yoklamak bedava degil; calisma bitince
 * `refetchInterval` false doner ve sorgu normal staleTime'ina geri duser.
 */
const RUNNING_POLL_MS = 5_000;

/** Hub'in son ingest calismasi - baslik seridindeki "SON hh:mm" damgasi. */
export function useLastSync() {
  return useQuery({
    ...lastSyncQueryOptions(supabase),
    refetchInterval: (query) => (query.state.data?.running ? RUNNING_POLL_MS : false),
  });
}

/**
 * Ingest bitince ekrandaki her sorguyu tazeler. Kokpit layout'unda BIR KEZ mount
 * edilir.
 *
 * NEDEN VAR: yenileme hareketi ingest'i tetikliyor ama ingest 90+ saniye suruyor.
 * Kullaniciyi o kadar bekletmek yerine spinner erken kapaniyor; taze rakamlar
 * calisma bitince buradan geliyor. `running` true'dan false'a dondugu an tek
 * tetikleyici - ayni calisma icin iki kez tazelenmez.
 *
 * NEDEN LAYOUT'TA: her ekranda mount edilseydi sekme degistikce ref sifirlanir
 * ve gecis kacardi; ayrica dort ekran ayni anda refetch tetiklerdi.
 */
export function useIngestWatcher(): void {
  const queryClient = useQueryClient();
  const { data } = useLastSync();
  const wasRunning = useRef(false);

  useEffect(() => {
    const running = data?.running ?? false;
    if (wasRunning.current && !running) {
      void queryClient.refetchQueries({ type: "active" });
    }
    wasRunning.current = running;
  }, [data?.running, queryClient]);
}
