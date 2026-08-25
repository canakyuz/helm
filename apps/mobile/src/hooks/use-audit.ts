import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { lensAudit, useDemoLens } from "~/lib/demo";
import type { AuditEntry } from "@helm/api";
import { usePreferences } from "~/lib/preferences";

export type { AuditEntry } from "@helm/api";

export function useAudit() {
  const { selectedPropertyId } = usePreferences();
  const lens = useDemoLens();
  return useQuery({
    ...auditQueryOptions(supabase, selectedPropertyId),
    select: useCallback((rows: AuditEntry[]) => lensAudit(rows, lens), [lens]),
  });
}
