import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";

export type AuditEntry = {
  id: number;
  propertyId: string | null;
  propertyName: string | null;
  targetUser: string | null;
  action: string;
  detail: string | null;
  createdAt: string;
};

type AuditRow = {
  id: number;
  project_id: string | null;
  target_user: string | null;
  action: string;
  detail: string | null;
  created_at: string;
  properties: { name: string } | null;
};

export async function fetchAudit(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
): Promise<AuditEntry[]> {
  // FK kolon adı project_id (rename öncesi convention), properties tablosuna referans.
  let q = client
    .from("audit_log")
    .select("id, project_id, target_user, action, detail, created_at, properties ( name )")
    .order("created_at", { ascending: false })
    .limit(200);

  if (propertyId !== "all") q = q.eq("project_id", propertyId);

  const { data, error } = await q;
  if (error) throw error;

  return ((data as unknown as AuditRow[] | null) ?? []).map((row) => ({
    id: row.id,
    propertyId: row.project_id,
    propertyName: row.properties?.name ?? null,
    targetUser: row.target_user,
    action: row.action,
    detail: row.detail,
    createdAt: row.created_at,
  }));
}
