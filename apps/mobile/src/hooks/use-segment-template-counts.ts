import { useQuery } from "@tanstack/react-query";

import { supabase } from "~/lib/supabase";
import { usePreferences, type SelectedPropertyId } from "~/lib/preferences";

type AuthLikeUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
};

type FetchUsersResp = { users?: AuthLikeUser[]; error?: string };

export type SegmentMetrics = {
  new: number;
  active: number;
  passive: number;
  total: number;
};

async function listSupabasePropertyIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from("project_integrations")
    .select("project_id")
    .eq("provider", "supabase")
    .eq("enabled", true);
  if (error) throw error;
  return ((data ?? []) as Array<{ project_id: string }>).map((r) => r.project_id);
}

async function fetchUsersForProperty(propertyId: string): Promise<AuthLikeUser[]> {
  const { data, error } = await supabase.functions.invoke<FetchUsersResp>(
    "helm-users",
    { body: { project_id: propertyId } },
  );
  if (error) return [];
  return data?.users ?? [];
}

async function fetchAllUsers(propertyId: SelectedPropertyId): Promise<AuthLikeUser[]> {
  const ids =
    propertyId === "all" ? await listSupabasePropertyIds() : [propertyId];
  if (ids.length === 0) return [];
  const batches = await Promise.all(ids.map(fetchUsersForProperty));
  const all: AuthLikeUser[] = [];
  for (const b of batches) all.push(...b);
  return all;
}

function computeMetrics(
  users: AuthLikeUser[],
  periodDays: number,
): SegmentMetrics {
  const cutoff = Date.now() - periodDays * 86_400_000;
  let newCount = 0;
  let activeCount = 0;
  let passiveCount = 0;
  for (const u of users) {
    if (new Date(u.created_at).getTime() >= cutoff) newCount++;
    const lastSeen = u.last_sign_in_at
      ? new Date(u.last_sign_in_at).getTime()
      : 0;
    if (lastSeen >= cutoff) activeCount++;
    else passiveCount++;
  }
  return {
    new: newCount,
    active: activeCount,
    passive: passiveCount,
    total: users.length,
  };
}

export function useSegmentMetrics(periodDays: number) {
  const { selectedPropertyId } = usePreferences();
  return useQuery({
    queryKey: ["segment-metrics", selectedPropertyId, periodDays],
    queryFn: async () => {
      const users = await fetchAllUsers(selectedPropertyId);
      return computeMetrics(users, periodDays);
    },
    staleTime: 5 * 60_000,
  });
}
