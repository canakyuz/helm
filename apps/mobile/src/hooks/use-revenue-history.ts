import { useQuery } from "@tanstack/react-query";
import { revenueHistoryQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { usePreferences } from "~/lib/preferences";

type QueryGate = { enabled?: boolean };

/**
 * Gelir gecmisi - ay ve hafta gruplari, kaynak kirilimiyle.
 *
 * Tek sorgu tum donemleri getirir; donem degistirmek ag turu ISTEMEZ. Eski
 * ekran her donem icin ayri sorgu atsaydi, sekme her dokunusta beklerdi.
 */
export function useRevenueHistory(options: QueryGate = {}) {
  const { selectedPropertyId } = usePreferences();
  return useQuery(revenueHistoryQueryOptions(supabase, selectedPropertyId, options));
}
