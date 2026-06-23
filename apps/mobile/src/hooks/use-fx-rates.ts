import { useQuery } from "@tanstack/react-query";
import { fxRatesQueryOptions } from "@helm/queries";

export type { FxRates } from "@helm/api";

type QueryGate = { enabled?: boolean };

export function useFxRates(options: QueryGate = {}) {
  return useQuery(fxRatesQueryOptions(options));
}
