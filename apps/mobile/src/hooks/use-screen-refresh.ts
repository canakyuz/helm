import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { haptic } from "~/lib/haptics";

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
export function useScreenRefresh() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    haptic.tap();
    setRefreshing(true);
    try {
      await queryClient.refetchQueries({ type: "active" });
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  return { refreshing, onRefresh };
}
