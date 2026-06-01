import { useQuery } from "@tanstack/react-query";
import { propertyDauQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";

export type { PropertyDau } from "@helm/api";

export function usePropertyDau() {
  return useQuery(propertyDauQueryOptions(supabase));
}
