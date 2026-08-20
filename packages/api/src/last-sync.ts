import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Verinin GERCEK tazeligi.
 *
 * NEDEN AYRI (KUCUK) BIR SORGU: `fetchCockpitKpis` de son calismayi okuyor ama
 * o sorgu proje kapsamli ve agir (metrics + alerts + fx). Baslik seridi bes
 * ekranda ortak; oradan KPI sorgusuna bagimli olmak Gelir/Saglik ekranlarina
 * gereksiz bir yuk bindirirdi. Bu sorgu tek satir okur.
 *
 * NEDEN ISTEMCI ZAMANI DEGIL: "son yenileme" diye TanStack'in `dataUpdatedAt`
 * degerini gostermek yalan olurdu - istemci bir dakika once fetch etmis olsa
 * bile satirlar saatlik cron'dan geliyor olabilir. Kullanicinin sordugu soru
 * "veri ne kadar taze", "telefon ne zaman istek atti" degil.
 */
export type LastSync = {
  /** Biten calismada finished_at, devam edende started_at. */
  at: string;
  /** Calisma hala suruyor (finished_at null). */
  running: boolean;
  /** En az bir baglayici hata verdi. */
  failed: boolean;
};

type SyncRow = {
  started_at: string;
  finished_at: string | null;
  error_count: number;
};

export async function fetchLastSync(client: SupabaseClient): Promise<LastSync | null> {
  const { data, error } = await client
    .from("sync_runs")
    .select("started_at, finished_at, error_count")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const row = data as SyncRow | null;
  if (!row) return null;

  return {
    at: row.finished_at ?? row.started_at,
    running: row.finished_at === null,
    failed: row.error_count > 0,
  };
}
