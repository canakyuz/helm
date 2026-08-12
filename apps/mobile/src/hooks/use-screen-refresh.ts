import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { haptic } from "~/lib/haptics";
import { supabase } from "~/lib/supabase";

/**
 * Ekran genelinde "asagi cekip yenile" davranisi.
 *
 * NEDEN ORTAK BIR HOOK:
 *
 * 1) Eski kurulum spinner'i TEK bir sorguya bagliyordu (`refreshing={kpis.isRefetching}`),
 *    oysa yenileme sekiz sorgu tetikliyordu. Spinner ilk sorgu biter bitmez duruyor,
 *    kullanici "yenilendi" saniyordu — digerleri hala ucuyorken. Burada `refreshing`
 *    gercekten HEPSI bitince kapaniyor.
 *
 * 2) Eskiden yenilenecek sorgular elle listeleniyordu. Ekrana yeni bir kart eklendiginde
 *    o listeye eklemeyi unutmak sessiz bir hataydi — haritayi baglarken `geo.refetch()`
 *    elle eklenmek zorunda kalindi, tam da bu tuzagin kaniti. `refetchQueries` o anda
 *    ekranda AKTIF olan her sorguyu kapsar, liste bakimi gerekmez.
 *
 * 3) Yenileme yalnizca Overview'da vardi; Revenue / Analytics / Health'te asagi cekmek
 *    hicbir sey yapmiyordu. Ortak hook bunu dort ekrana da bedavaya getiriyor.
 *
 * Hata durumu bilincli olarak yutulur: yenileme basarisiz olsa bile spinner kapanir ve
 * ekranda mevcut veri kalir. Sorgularin kendi hata durumlari zaten kartlarda gorunur;
 * burada ayrica uyari gostermek ayni hatayi iki kez soylemek olurdu.
 */

/**
 * Ingest'in bitmesini en fazla bu kadar bekleriz.
 *
 * NEDEN ZAMAN ASIMI VAR: helm-ingest her enabled entegrasyonu SIRAYLA gezer
 * (AdMob + RevenueCat + PostHog + Sentry...). Yavas bir saglayici tum yenilemeyi
 * kilitleyebilir. Sure dolunca istek iptal EDILMEZ — hub tarafinda calismaya
 * devam eder; biz sadece beklemeyi birakip elimizdekini tazeleriz. Bir sonraki
 * yenilemede o veri zaten yerinde olur.
 */
const INGEST_TIMEOUT_MS = 15_000;

/**
 * Ard arda cekislerde ingest'i yeniden tetiklemeyiz — sadece refetch yapariz.
 *
 * NEDEN GEREKLI: asagi cekmek bedava bir hareket, ingest degil. Her cekiste tum
 * dis saglayici API'lerine gitmek hem kotali (AdMob raporlama kotasi) hem yavas.
 * Sayac modul kapsaminda: her ekranin kendi hook ornegi var, bir ref sekme
 * degisiminde sifirlanir ve bekleme suresi hicbir zaman islemezdi.
 */
const INGEST_COOLDOWN_MS = 60_000;
let lastIngestAt = 0;

/**
 * Hub'a "dis kaynaklardan taze veri cek" der.
 *
 * BU SATIR NEDEN VAR: bento'ya gecerken kayboldu ve yenileme sessizce anlamini
 * yitirdi. Sadece `refetchQueries` cagirmak AYNI satirlari tekrar okumak demek —
 * metrics tablosunu saatlik cron doldurdugundan (0013_cron_hourly.sql) panel
 * bir saate kadar eski rakami "yeniledim" diye tekrar gosteriyordu.
 */
async function triggerIngest(): Promise<void> {
  if (Date.now() - lastIngestAt < INGEST_COOLDOWN_MS) return;
  lastIngestAt = Date.now();
  try {
    await Promise.race([
      supabase.functions.invoke("helm-ingest", { body: { trigger: "manual" } }),
      new Promise((resolve) => setTimeout(resolve, INGEST_TIMEOUT_MS)),
    ]);
  } catch {
    // Ingest hatasi olumcul degil — hub'da ne varsa onu tazelemeye devam.
  }
}

export function useScreenRefresh() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    haptic.tap();
    setRefreshing(true);
    try {
      await triggerIngest();
      await queryClient.refetchQueries({ type: "active" });
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  return { refreshing, onRefresh };
}
