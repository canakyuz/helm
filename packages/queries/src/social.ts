import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";
import {
  fetchSocialAccountDaily,
  fetchSocialAccounts,
  fetchSocialMetricRows,
  summarizeSocialKpis,
} from "@helm/api";

export const socialKeys = {
  all: ["social"] as const,
  accounts: (id: SelectedPropertyId) => ["social", "accounts", id] as const,
  kpis: (id: SelectedPropertyId, days: number) => ["social", "kpis", id, days] as const,
  daily: (ids: string[], days: number) => ["social", "daily", ids.slice().sort().join(","), days] as const,
};

export function socialAccountsQueryOptions(client: SupabaseClient, propertyId: SelectedPropertyId) {
  return queryOptions({
    queryKey: socialKeys.accounts(propertyId),
    queryFn: () => fetchSocialAccounts(client, propertyId),
    staleTime: 5 * 60_000,
  });
}

export function socialKpisQueryOptions(client: SupabaseClient, propertyId: SelectedPropertyId, days: number) {
  return queryOptions({
    queryKey: socialKeys.kpis(propertyId, days),
    queryFn: async () => {
      const rows = await fetchSocialMetricRows(client, propertyId, days);
      return summarizeSocialKpis(rows, days, new Date().toISOString().slice(0, 10));
    },
    staleTime: 5 * 60_000,
  });
}

export function socialAccountDailyQueryOptions(client: SupabaseClient, accountIds: string[], days: number) {
  return queryOptions({
    queryKey: socialKeys.daily(accountIds, days),
    queryFn: () => fetchSocialAccountDaily(client, accountIds, days),
    staleTime: 5 * 60_000,
    enabled: accountIds.length > 0,
  });
}
