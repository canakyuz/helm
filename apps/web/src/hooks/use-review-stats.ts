import { useQuery } from "@tanstack/react-query";
import { reviewStatsQueryOptions } from "@helm/queries";

import { supabaseClient } from "@/providers/supabase-client";
import { useScope } from "@/context/scope";

/**
 * Yorum ozeti - ortalama, yildiz dagilimi, platform kirilimi.
 *
 * NEDEN AYRI SORGU: PostgREST max_rows = 1000. Ozet listeden hesaplanirsa
 * portfoy buyudugunde sessizce yanlislasir (bos degil, YANLIS). Bu sorgu
 * helm_review_stats RPC'sine gider ve tum veriyi DB'de toplar; cevap
 * platform kirilimlarini birlikte tasidigi icin iOS/Android sekmesi
 * degisince yeniden sorgu gerekmez.
 */
export function useReviewStats() {
  const { scope, isAll } = useScope();
  return useQuery(reviewStatsQueryOptions(supabaseClient, isAll ? "all" : scope));
}
