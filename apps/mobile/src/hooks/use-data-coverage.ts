import { useQuery } from "@tanstack/react-query";
import { dataCoverageQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { usePreferences } from "~/lib/preferences";

type QueryGate = { enabled?: boolean };

/**
 * Veri kapsami uyarilari — susmus kaynak, baglanmamis proje.
 *
 * alert_events'ten AYRI: bunlar kayitli olay degil, o anki durumdan turetilen
 * sinyaller. Kaynak duzelince kendiliginden kaybolurlar.
 */
export function useDataCoverage(options: QueryGate = {}) {
  const { selectedPropertyId } = usePreferences();
  return useQuery(dataCoverageQueryOptions(supabase, selectedPropertyId, options));
}
