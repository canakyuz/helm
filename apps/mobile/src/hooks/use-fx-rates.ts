import { useQuery } from "@tanstack/react-query";
import { fxRatesQueryOptions } from "@helm/queries";

export type { FxRates } from "@helm/api";

export function useFxRates() {
  return useQuery(fxRatesQueryOptions());
}
