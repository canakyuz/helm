import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { propertyDauQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { lensPropertyDau, useDemoLens } from "~/lib/demo";
import type { PropertyDau } from "@helm/api";

export type { PropertyDau } from "@helm/api";

export function usePropertyDau() {
  const lens = useDemoLens();
  return useQuery({
    ...propertyDauQueryOptions(supabase),
    select: useCallback((rows: PropertyDau[]) => lensPropertyDau(rows, lens), [lens]),
  });
}
