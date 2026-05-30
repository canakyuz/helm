import { useQuery } from "@tanstack/react-query";

import { supabase } from "~/lib/supabase";
import { usePreferences, type SelectedPropertyId } from "~/lib/preferences";
import { colors } from "~/theme/tokens";

// Gelir mix'i — bu ay subscription_revenue (ASC) + iap_revenue (ASC) + ad_revenue
// (AdMob) toplamları. metrics tablosundan doğrudan okunur (edge gerekmez).
// Platform split (iOS/Android/Web) DAHİL DEĞİL: Android gelir kaynağı yok.

export type MixSegment = { label: string; value: number; pct: number; color: string };
export type RevenueMix = { segments: MixSegment[]; total: number };

const MIX = [
  { metric: "subscription_revenue", label: "Subscriptions", color: colors.accentViolet },
  { metric: "iap_revenue", label: "In-app purchase", color: colors.accent },
  { metric: "ad_revenue", label: "Ad revenue", color: colors.blue },
] as const;

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

async function fetchMix(propertyId: SelectedPropertyId): Promise<RevenueMix> {
  const today = new Date().toISOString().slice(0, 10);
  let q = supabase
    .from("metrics")
    .select("metric, value")
    .in("metric", MIX.map((m) => m.metric))
    .gte("date", monthStart())
    .lte("date", today);
  if (propertyId !== "all") q = q.eq("project_id", propertyId);

  const { data, error } = await q;
  if (error) throw error;

  const sums = new Map<string, number>();
  for (const r of (data ?? []) as Array<{ metric: string; value: number }>) {
    sums.set(r.metric, (sums.get(r.metric) ?? 0) + Number(r.value));
  }
  const raw = MIX.map((m) => ({ ...m, value: sums.get(m.metric) ?? 0 }));
  const total = raw.reduce((a, b) => a + b.value, 0);
  const segments: MixSegment[] = raw.map((m) => ({
    label: m.label,
    value: m.value,
    color: m.color,
    pct: total > 0 ? Math.round((m.value / total) * 100) : 0,
  }));
  return { segments, total };
}

export function useRevenueMix() {
  const { selectedPropertyId } = usePreferences();
  return useQuery({
    queryKey: ["revenue-mix", selectedPropertyId],
    queryFn: () => fetchMix(selectedPropertyId),
    staleTime: 5 * 60_000,
  });
}
