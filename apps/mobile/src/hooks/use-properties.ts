import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { propertiesQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { lensProperties, useDemoLens } from "~/lib/demo";
import type { Property } from "@helm/api";

export type { Property, PropertyType, PropertyStatus } from "@helm/api";

type QueryGate = { enabled?: boolean };

export function useProperties(options: QueryGate = {}) {
  const lens = useDemoLens();
  return useQuery({
    ...propertiesQueryOptions(supabase, options),
    select: useCallback((rows: Property[]) => lensProperties(rows, lens), [lens]),
  });
}
