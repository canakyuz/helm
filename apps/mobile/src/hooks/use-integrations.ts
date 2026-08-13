import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createIntegration,
  deleteIntegration,
  setIntegrationEnabled,
  updateIntegrationConfig,
} from "@helm/api";
import {
  integrationConfigKeys,
  integrationConfigQueryOptions,
  systemHealthKeys,
} from "@helm/queries";
import type { ProviderName } from "@helm/domain";

import { supabase } from "~/lib/supabase";
import { toast } from "~/lib/toast";

export type { IntegrationConfigView } from "@helm/api";

export function useIntegrationConfig(id: string) {
  return useQuery({
    ...integrationConfigQueryOptions(supabase, id),
    enabled: id !== "",
  });
}

/** Her mutasyon hem detay hem de liste (system-health) sorgusunu tazeler. */
function useInvalidateIntegrations() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: integrationConfigKeys.all });
    void qc.invalidateQueries({ queryKey: systemHealthKeys.all });
  };
}

export function useCreateIntegration() {
  const invalidate = useInvalidateIntegrations();
  return useMutation({
    mutationFn: (args: {
      projectId: string;
      provider: ProviderName;
      config: Record<string, string>;
    }) => createIntegration(supabase, args),
    onSuccess: () => {
      toast.success("Kaynak bağlandı");
      invalidate();
    },
    onError: (e: Error) => toast.error("Kaynak bağlanamadı", e.message),
  });
}

export function useUpdateIntegrationConfig() {
  const invalidate = useInvalidateIntegrations();
  return useMutation({
    mutationFn: (args: { id: string; patch: Record<string, string> }) =>
      updateIntegrationConfig(supabase, args),
    onSuccess: () => {
      toast.success("Ayarlar kaydedildi");
      invalidate();
    },
    onError: (e: Error) => toast.error("Kaydedilemedi", e.message),
  });
}

export function useSetIntegrationEnabled() {
  const invalidate = useInvalidateIntegrations();
  return useMutation({
    mutationFn: (args: { id: string; enabled: boolean }) =>
      setIntegrationEnabled(supabase, args),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error("Durum değiştirilemedi", e.message),
  });
}

export function useDeleteIntegration() {
  const invalidate = useInvalidateIntegrations();
  return useMutation({
    mutationFn: (id: string) => deleteIntegration(supabase, id),
    onSuccess: () => {
      toast.success("Kaynak kaldırıldı");
      invalidate();
    },
    onError: (e: Error) => toast.error("Kaldırılamadı", e.message),
  });
}
