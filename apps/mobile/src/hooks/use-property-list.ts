import { useQuery } from "@tanstack/react-query";

import { supabase } from "~/lib/supabase";
import type { PropertyType } from "~/hooks/use-properties";

export type PropertyListItem = {
  id: string;
  name: string;
  brandName: string | null;
  type: PropertyType;
};

type Row = {
  id: string;
  name: string;
  type: PropertyType;
  brands: { name: string } | null;
};

async function fetchPropertyList(): Promise<PropertyListItem[]> {
  const { data, error } = await supabase
    .from("properties")
    .select("id, name, type, brands ( name )")
    .order("name", { ascending: true });

  if (error) throw error;

  return ((data as unknown as Row[] | null) ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    brandName: row.brands?.name ?? null,
    type: row.type,
  }));
}

export function usePropertyList() {
  return useQuery({
    queryKey: ["property-list"],
    queryFn: fetchPropertyList,
    staleTime: 5 * 60_000,
  });
}
