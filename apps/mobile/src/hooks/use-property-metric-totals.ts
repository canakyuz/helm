import { useQuery } from "@tanstack/react-query";

import { supabase } from "~/lib/supabase";
import type { PropertyType } from "~/hooks/use-properties";

export type PropertyMetricTotal = {
  id: string;
  name: string;
  brandName: string | null;
  type: PropertyType;
  thisMonth: number;
  today: number;
};

type PropertyRow = {
  id: string;
  name: string;
  type: PropertyType;
  brands: { name: string } | null;
};

// Belirli bir metric için her property'nin "bu ay toplamı" + "bugün" değeri.
// Revenue ekranında per-property breakdown için.
async function fetchTotals(metric: string): Promise<PropertyMetricTotal[]> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const [propsRes, metricsRes] = await Promise.all([
    supabase
      .from("properties")
      .select("id, name, type, brands ( name )")
      .order("name"),
    supabase
      .from("metrics")
      .select("project_id, date, value")
      .eq("metric", metric)
      .gte("date", monthStart)
      .lte("date", today),
  ]);

  if (propsRes.error) throw propsRes.error;
  if (metricsRes.error) throw metricsRes.error;

  const properties = (propsRes.data as unknown as PropertyRow[] | null) ?? [];

  const totalByProperty = new Map<string, { month: number; today: number }>();
  for (const row of (metricsRes.data ?? []) as Array<{
    project_id: string;
    date: string;
    value: number;
  }>) {
    const acc = totalByProperty.get(row.project_id) ?? { month: 0, today: 0 };
    acc.month += Number(row.value);
    if (row.date === today) acc.today = Number(row.value);
    totalByProperty.set(row.project_id, acc);
  }

  return properties.map<PropertyMetricTotal>((p) => {
    const totals = totalByProperty.get(p.id) ?? { month: 0, today: 0 };
    return {
      id: p.id,
      name: p.name,
      brandName: p.brands?.name ?? null,
      type: p.type,
      thisMonth: totals.month,
      today: totals.today,
    };
  });
}

export function usePropertyMetricTotals(metric: string) {
  return useQuery({
    queryKey: ["property-metric-totals", metric],
    queryFn: () => fetchTotals(metric),
    staleTime: 60_000,
  });
}
