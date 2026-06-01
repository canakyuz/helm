import { useQuery } from "@tanstack/react-query";
import { auditQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { usePreferences } from "~/lib/preferences";

export type { AuditEntry } from "@helm/api";

export function useAudit() {
  const { selectedPropertyId } = usePreferences();
  return useQuery(auditQueryOptions(supabase, selectedPropertyId));
}
