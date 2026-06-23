import { queryOptions } from "@tanstack/react-query";
import { fetchFxRates, FX_FALLBACK } from "@helm/api";
import { STALE_TIME } from "@helm/config";

type QueryGate = { enabled?: boolean };

export const fxRatesKeys = { all: ["fx-rates", "usd-base"] as const };

export function fxRatesQueryOptions(options: QueryGate = {}) {
  return queryOptions({
    queryKey: fxRatesKeys.all,
    enabled: options.enabled ?? true,
    queryFn: fetchFxRates,
    staleTime: STALE_TIME.fxRates,
    gcTime: 24 * 60 * 60 * 1000,
    placeholderData: FX_FALLBACK,
  });
}
