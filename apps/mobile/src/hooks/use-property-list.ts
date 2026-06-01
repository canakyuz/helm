import { useQuery } from "@tanstack/react-query";
import { propertyListQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";

export type { PropertyListItem } from "@helm/api";

export function usePropertyList() {
  return useQuery(propertyListQueryOptions(supabase));
}
