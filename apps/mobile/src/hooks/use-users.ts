import { useQuery } from "@tanstack/react-query";
import { usersQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { usePreferences } from "~/lib/preferences";

export type { HubUser } from "@helm/api";

export function useUsers() {
  const { selectedPropertyId } = usePreferences();
  return useQuery(usersQueryOptions(supabase, selectedPropertyId));
}
