import type { SupabaseClient } from "@supabase/supabase-js";

// Segment adları RC'nin döndüğü şekle göre dinamik (New/Churned ya da daha fazlası).
export type MrrSegment = { label: string; value: number };
export type MrrMovement = { segments: MrrSegment[]; net: number };

export async function fetchMrrMovement(
  client: SupabaseClient,
  projectId: string,
): Promise<MrrMovement> {
  const { data, error } = await client.functions.invoke<MrrMovement>("helm-mrr-movement", {
    body: { project_id: projectId },
  });
  if (error) throw error;
  return data ?? { segments: [], net: 0 };
}
