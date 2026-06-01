import { useQuery } from "@tanstack/react-query";
import { propertiesQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";

export type { Property, PropertyType, PropertyStatus } from "@helm/api";

export function useProperties() {
  return useQuery(propertiesQueryOptions(supabase));
}
