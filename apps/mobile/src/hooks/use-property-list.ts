import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { propertyListQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { lensPropertyList, useDemoLens } from "~/lib/demo";
import type { PropertyListItem } from "@helm/api";

export type { PropertyListItem } from "@helm/api";

export function usePropertyList() {
  const lens = useDemoLens();
  return useQuery({
    ...propertyListQueryOptions(supabase),
    select: useCallback((rows: PropertyListItem[]) => lensPropertyList(rows, lens), [lens]),
  });
}
