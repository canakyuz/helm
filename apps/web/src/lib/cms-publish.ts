// helm - CMS publish + rollback yardımcıları.
// V1: 2 query (revision insert + entry update). V2'de RPC ile transaction.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CmsEntry, CmsRevision } from "@/types/cms";

export interface PublishOptions {
  note?: string;
}

export const publishEntry = async (
  supabase: SupabaseClient,
  entry: Pick<CmsEntry, "id" | "data" | "status">,
  options: PublishOptions = {},
): Promise<void> => {
  const { error: revErr } = await supabase.from("cms_revisions").insert({
    entry_id: entry.id,
    data: entry.data,
    status_at_snapshot: "published",
    note: options.note ?? null,
  });
  if (revErr) throw revErr;

  const { error: entryErr } = await supabase
    .from("cms_entries")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
    })
    .eq("id", entry.id);
  if (entryErr) throw entryErr;
};

export const revertToRevision = async (
  supabase: SupabaseClient,
  entryId: string,
  revision: Pick<CmsRevision, "data">,
): Promise<void> => {
  const { error } = await supabase
    .from("cms_entries")
    .update({
      data: revision.data,
      status: "draft",
    })
    .eq("id", entryId);
  if (error) throw error;
};
