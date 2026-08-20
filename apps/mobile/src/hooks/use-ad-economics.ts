import { useQuery } from "@tanstack/react-query";
import { adEconomicsQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { usePreferences } from "~/lib/preferences";

type QueryGate = { enabled?: boolean };

/**
 * Reklam ekonomisi - format basina gelir, eCPM, doluluk.
 *
 * `metrics` tablosundaki tek `ad_revenue` satirindan farkli olarak
 * `metrics_format` kirilimina bakar: hangi formatin kazandirdigini soyler.
 *
 * Aralik ekrandan gelir (secili donem kovasi), sabit "son N gun" degil.
 */
export function useAdEconomics(from: string, to: string, options: QueryGate = {}) {
  const { selectedPropertyId } = usePreferences();
  return useQuery(
    adEconomicsQueryOptions(supabase, selectedPropertyId, from, to, options),
  );
}
