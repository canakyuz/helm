import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";
import {
  fetchRevenueGoal,
  revenueGoalMonth,
  fetchRevenueMix,
  fetchPayouts,
  fetchMrrMovement,
} from "@helm/api";

// ── revenue-goal ──
export const revenueGoalKeys = {
  all: ["revenue-goal"] as const,
  byMonth: (month: string, id: SelectedPropertyId) =>
    ["revenue-goal", month, id] as const,
};

export function revenueGoalQueryOptions(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
) {
  return queryOptions({
    queryKey: revenueGoalKeys.byMonth(revenueGoalMonth(), propertyId),
    queryFn: () => fetchRevenueGoal(client, propertyId),
    staleTime: 5 * 60_000,
  });
}

// ── revenue-mix ──
export const revenueMixKeys = {
  all: ["revenue-mix"] as const,
  byProperty: (id: SelectedPropertyId) => ["revenue-mix", id] as const,
};

export function revenueMixQueryOptions(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
) {
  return queryOptions({
    queryKey: revenueMixKeys.byProperty(propertyId),
    queryFn: () => fetchRevenueMix(client, propertyId),
    staleTime: 5 * 60_000,
  });
}

// ── payouts (tek project scope) ──
export function payoutsQueryOptions(client: SupabaseClient, projectId?: string) {
  return queryOptions({
    queryKey: ["payouts", projectId],
    enabled: projectId != null,
    staleTime: 5 * 60_000,
    queryFn: () => fetchPayouts(client, projectId!),
  });
}

// ── mrr-movement (tek project scope) ──
export function mrrMovementQueryOptions(client: SupabaseClient, projectId?: string) {
  return queryOptions({
    queryKey: ["mrr-movement", projectId],
    enabled: projectId != null,
    staleTime: 5 * 60_000,
    queryFn: () => fetchMrrMovement(client, projectId!),
  });
}
