import type { SupabaseClient } from "@supabase/supabase-js";
import type { PropertyType } from "./properties";

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

export async function fetchPropertyList(
  client: SupabaseClient,
): Promise<PropertyListItem[]> {
  const { data, error } = await client
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
