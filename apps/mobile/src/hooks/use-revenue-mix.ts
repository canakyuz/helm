import { useQuery } from "@tanstack/react-query";
import { revenueMixQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { usePreferences } from "~/lib/preferences";
import { colors } from "~/theme/tokens";

// api renk içermez (UI concern) → metric'e göre tema rengini select ile ekle.
export type MixSegment = {
  metric: string;
  label: string;
  value: number;
  pct: number;
  color: string;
};

const MIX_COLOR: Record<string, string> = {
  subscription_revenue: colors.accentViolet,
  iap_revenue: colors.accent,
  ad_revenue: colors.blue,
};

export function useRevenueMix() {
  const { selectedPropertyId } = usePreferences();
  const opts = revenueMixQueryOptions(supabase, selectedPropertyId);
  return useQuery({
    ...opts,
    select: (d): { segments: MixSegment[]; total: number } => ({
      total: d.total,
      segments: d.segments.map((s) => ({
        ...s,
        color: MIX_COLOR[s.metric] ?? colors.fgMuted,
      })),
    }),
  });
}
