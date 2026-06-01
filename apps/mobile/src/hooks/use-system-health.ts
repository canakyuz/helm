import { useQuery } from "@tanstack/react-query";
import { systemHealthQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";

export type {
  ProviderName,
  IntegrationStatus,
  IntegrationHealth,
  SystemHealth,
} from "@helm/api";

export function useSystemHealth() {
  return useQuery(systemHealthQueryOptions(supabase));
}
