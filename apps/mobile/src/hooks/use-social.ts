import { useQuery } from "@tanstack/react-query";
import { socialAccountsQueryOptions, socialKpisQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { usePreferences } from "~/lib/preferences";

export type { SocialAccount, SocialKpis } from "@helm/api";

export function useSocialAccounts() {
  const { selectedPropertyId } = usePreferences();
  return useQuery(socialAccountsQueryOptions(supabase, selectedPropertyId));
}

export function useSocialKpis(days = 30) {
  const { selectedPropertyId } = usePreferences();
  return useQuery(socialKpisQueryOptions(supabase, selectedPropertyId, days));
}
