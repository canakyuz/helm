import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";

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

// local — users.ts'in export'lu fetchAllUsers'ı ile çakışmasın.
async function listSupabasePropertyIds(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client
    .from("project_integrations")
    .select("project_id")
    .eq("provider", "supabase")
    .eq("enabled", true);
  if (error) throw error;
  return ((data ?? []) as Array<{ project_id: string }>).map((r) => r.project_id);
}

async function fetchUsersForProperty(
  client: SupabaseClient,
  propertyId: string,
): Promise<AuthLikeUser[]> {
  const { data, error } = await client.functions.invoke<FetchUsersResp>("helm-users", {
    body: { project_id: propertyId },
  });
  if (error) return [];
  return data?.users ?? [];
}

async function collectUsers(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
): Promise<AuthLikeUser[]> {
  const ids =
    propertyId === "all" ? await listSupabasePropertyIds(client) : [propertyId];
  if (ids.length === 0) return [];
  const batches = await Promise.all(ids.map((id) => fetchUsersForProperty(client, id)));
  const all: AuthLikeUser[] = [];
  for (const b of batches) all.push(...b);
  return all;
}

function computeMetrics(users: AuthLikeUser[], periodDays: number): SegmentMetrics {
  const cutoff = Date.now() - periodDays * 86_400_000;
  let newCount = 0;
  let activeCount = 0;
  let passiveCount = 0;
  for (const u of users) {
    if (new Date(u.created_at).getTime() >= cutoff) newCount++;
    const lastSeen = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0;
    if (lastSeen >= cutoff) activeCount++;
    else passiveCount++;
  }
  return { new: newCount, active: activeCount, passive: passiveCount, total: users.length };
}

export async function fetchSegmentMetrics(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
  periodDays: number,
): Promise<SegmentMetrics> {
  const users = await collectUsers(client, propertyId);
  return computeMetrics(users, periodDays);
}
