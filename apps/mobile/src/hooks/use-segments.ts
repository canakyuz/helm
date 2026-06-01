import { useQuery } from "@tanstack/react-query";

import { supabase } from "~/lib/supabase";
import { usePreferences, type SelectedPropertyId } from "~/lib/preferences";

export type SegmentRuleType = "new" | "active" | "inactive";

export type Segment = {
  id: string;
  name: string;
  propertyId: string | null;
  propertyName: string | null;
  ruleType: SegmentRuleType;
  ruleDays: number;
  createdAt: string;
};

type Row = {
  id: string;
  name: string;
  project_id: string | null;
  rule_type: string;
  rule_days: number;
  created_at: string;
  properties: { name: string } | null;
};

async function fetchSegments(propertyId: SelectedPropertyId): Promise<Segment[]> {
  let q = supabase
    .from("user_segments")
    .select(
      "id, name, project_id, rule_type, rule_days, created_at, properties ( name )",
    )
    .order("created_at", { ascending: false });

  if (propertyId !== "all") q = q.eq("project_id", propertyId);

  const { data, error } = await q;
  if (error) throw error;

  return ((data as unknown as Row[] | null) ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    propertyId: row.project_id,
    propertyName: row.properties?.name ?? null,
    ruleType: (row.rule_type === "active"
      ? "active"
      : row.rule_type === "inactive"
      ? "inactive"
      : "new") as SegmentRuleType,
    ruleDays: row.rule_days,
    createdAt: row.created_at,
  }));
}

export function useSegments() {
  const { selectedPropertyId } = usePreferences();
  return useQuery({
    queryKey: ["segments", selectedPropertyId],
    queryFn: () => fetchSegments(selectedPropertyId),
    staleTime: 5 * 60_000,
  });
}
