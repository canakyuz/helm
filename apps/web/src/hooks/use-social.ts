import { useQuery } from "@tanstack/react-query";
import {
  socialAccountDailyQueryOptions,
  socialAccountsQueryOptions,
  socialKpisQueryOptions,
} from "@helm/queries";

import { supabaseClient } from "@/providers/supabase-client";
import { useScope } from "@/context/scope";

export function useSocialAccounts() {
  const { scope, isAll } = useScope();
  return useQuery(socialAccountsQueryOptions(supabaseClient, isAll ? "all" : scope));
}

export function useSocialKpis(days: number) {
  const { scope, isAll } = useScope();
  return useQuery(socialKpisQueryOptions(supabaseClient, isAll ? "all" : scope, days));
}

export function useSocialAccountDaily(accountIds: string[], days: number) {
  return useQuery(socialAccountDailyQueryOptions(supabaseClient, accountIds, days));
}
