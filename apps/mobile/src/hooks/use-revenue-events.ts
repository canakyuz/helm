import { useQuery } from "@tanstack/react-query";
import { revenueEventsQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { usePreferences } from "~/lib/preferences";

type QueryGate = { enabled?: boolean };

/** Gercek zamanli satin alma akisi - RevenueCat webhook'undan. */
export function useRevenueEvents(options: QueryGate = {}) {
  const { selectedPropertyId } = usePreferences();
  return useQuery(revenueEventsQueryOptions(supabase, selectedPropertyId, options));
}
