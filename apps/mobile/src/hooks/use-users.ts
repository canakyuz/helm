import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { usersQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { lensUsers, useDemoLens } from "~/lib/demo";
import type { HubUser } from "@helm/api";
import { usePreferences } from "~/lib/preferences";

export type { HubUser } from "@helm/api";

export function useUsers() {
  const { selectedPropertyId } = usePreferences();
  const lens = useDemoLens();
  return useQuery({
    ...usersQueryOptions(supabase, selectedPropertyId),
    select: useCallback((rows: HubUser[]) => lensUsers(rows, lens), [lens]),
  });
}
