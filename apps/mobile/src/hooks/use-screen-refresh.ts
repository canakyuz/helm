import { useCallback, useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { lastSyncKeys } from "@helm/queries";
import type { LastSync } from "@helm/api";

import { haptic } from "~/lib/haptics";
import { supabase } from "~/lib/supabase";

/**
 * Ekran genelinde "asagi cekip yenile" davranisi.
 *
 * NEDEN ORTAK BIR HOOK: yenileme sekiz sorgu tetikliyor. Spinner'i tek sorguya
 * baglamak "yenilendi" yalani soyluyordu. `refetchQueries({type:"active"})` o anda
 * ekranda olan her sorguyu kapsar, elle liste bakimi gerekmez.
 *
 * NEDEN ARTIK INGEST'I BEKLEMIYORUZ:
 *
 * Onceki kurulum `Promise.race([invoke, 15sn])` yapip hemen ardindan refetch
 * ediyordu. Olcum: gercek bir ingest calismasi 90 saniyeyi asiyor (helm-ingest
 * her saglayiciyi SIRAYLA geziyor). Yani yaris hep zamanlayici tarafindan
 * kazaniliyor, refetch ingest daha hicbir sey YAZMADAN eski satirlari tekrar
 * okuyordu. Ekranda rakamlar degismiyor, kullanici "yenile calismiyor, veri
 * sadece cron'la geliyor" sonucuna variyordu - his degil, mekanizma.
 *
 * Yeni akis: ingest ates-et-unut tetiklenir, spinner sunucu "SURUYOR" der demez
 * kapanir, calisma bitince `useIngestWatcher` ekrani kendiliginden tazeler.
 * Kimse 90 saniye spinner izlemiyor, kimse eski rakama bakmiyor.
 */

/**
 * Ard arda cekislerde ingest'i yeniden tetiklemeyiz - sadece refetch yapariz.
 *
 * NEDEN GEREKLI: asagi cekmek bedava bir hareket, ingest degil. Her cekiste tum
 * dis saglayici API'lerine gitmek hem kotali (AdMob raporlama kotasi) hem yavas.
 */
const INGEST_COOLDOWN_MS = 60_000;
let lastIngestAt = 0;

/** Sunucunun sync_runs satirini yazmasini bu araliklarla, bu kadar yoklariz. */
const NUDGE_INTERVAL_MS = 1_500;
const NUDGE_ATTEMPTS = 4;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Hub'a "dis kaynaklardan taze veri cek" der ve BEKLEMEZ.
 *
 * Cagri reddedilirse cooldown geri acilir - yoksa basarisiz bir denemeden sonra
 * kullanici bir dakika boyunca yeniden deneyemezdi.
 */
function triggerIngest(): void {
  if (Date.now() - lastIngestAt < INGEST_COOLDOWN_MS) return;
  lastIngestAt = Date.now();
  void supabase.functions
    .invoke("helm-ingest", { body: { trigger: "manual" } })
    .catch(() => {
      lastIngestAt = 0;
    });
}

/**
 * Damgayi, sunucu calismayi kaydedene kadar kisa araliklarla yoklar.
 *
 * NEDEN GEREKLI: `useLastSync` yalnizca `running` true iken kendi kendine
 * yokluyor. O gecisi kacirirsak yoklama hic baslamaz ve ekran bitmis bir
 * calismayi fark edemez. Burasi o ilk gecisi yakalayan koprü.
 */
async function waitForRunToAppear(queryClient: QueryClient): Promise<void> {
  for (let attempt = 0; attempt < NUDGE_ATTEMPTS; attempt += 1) {
    await sleep(NUDGE_INTERVAL_MS);
    await queryClient.refetchQueries({ queryKey: lastSyncKeys.all });
    const last = queryClient.getQueryData<LastSync | null>(lastSyncKeys.all);
    if (last?.running) return;
  }
}

export function useScreenRefresh() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    haptic.tap();
    setRefreshing(true);
    try {
      triggerIngest();
      // Ekrandaki veriyi hemen tazele: ingest'ten bagimsiz olarak baska bir
      // istemci ya da onceki cron yeni satir yazmis olabilir.
      await queryClient.refetchQueries({ type: "active" });
      await waitForRunToAppear(queryClient);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  return { refreshing, onRefresh };
}
