import { useQuery } from "@tanstack/react-query";
import { propertiesQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";

export type { Property, PropertyType, PropertyStatus } from "@helm/api";

type QueryGate = { enabled?: boolean };

export function useProperties(options: QueryGate = {}) {
  return useQuery(propertiesQueryOptions(supabase, options));
}
