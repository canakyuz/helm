import { useQuery } from "@tanstack/react-query";
import { gameFunnelsQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { usePreferences } from "~/lib/preferences";

type QueryGate = { enabled?: boolean };

/**
 * Oyun telemetrisi hunileri - oturum, reklam, oyun akisi, satin alma, fps.
 *
 * Diger analitik hook'larindan farkli olarak PostHog'a DEGIL game_events'e bakar;
 * PostHog uclari bu projede bos donuyor, gercek davranis verisi burada.
 */
export function useGameFunnels(days = 30, options: QueryGate = {}) {
  const { selectedPropertyId } = usePreferences();
  return useQuery(gameFunnelsQueryOptions(supabase, selectedPropertyId, days, options));
}
