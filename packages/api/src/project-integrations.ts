import type { SupabaseClient } from "@supabase/supabase-js";
import { isSecretKey, type ProviderName } from "@helm/domain";

/**
 * Entegrasyon yazma katmani.
 *
 * SIR POLITIKASI: `project_integrations.config` duz metin jsonb ve RLS
 * "authenticated full access" (0001_init.sql:64) - yani istemci teknik olarak
 * Service Role Key'i cekebilir. CEKMIYORUZ. Duzenleme ekrani sir alanlarinin
 * DEGERINI degil, YALNIZCA SET EDILMIS OLUP OLMADIGINI gorur; bu sayede sirlar
 * React state'ine, sorgu cache'ine ve ekran goruntusune hic girmez.
 *
 * TEK ISTISNA `updateIntegrationConfig`: birlestirme icin mevcut config bir kez
 * okunur. Dokunulmayan sirlar korunsun diye zorunlu - aksi halde formu kaydetmek
 * girilmemis her siri silerdi. Deger yalnizca fonksiyon kapsaminda yasar, disari
 * donmez. Atomik olmadigi icin es zamanli iki duzenleme birbirini ezebilir; tek
 * kullanicili uygulamada kabul edilebilir, cok kullaniciya cikarsa jsonb merge
 * yapan bir RPC'ye tasinmali.
 */

export type IntegrationConfigView = {
  id: string;
  projectId: string;
  provider: ProviderName;
  enabled: boolean;
  /** Sir OLMAYAN alanlar, oldugu gibi. */
  config: Record<string, string>;
  /** Kayitli sir alanlarinin ANAHTARLARI - degerleri degil. */
  secretKeysSet: string[];
  lastSyncStatus: "ok" | "error" | null;
  lastSyncError: string | null;
};

type Row = {
  id: string;
  project_id: string;
  provider: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
  last_sync_status: "ok" | "error" | null;
  last_sync_error: string | null;
};

/** Ham satiri sirlarindan arindirip goruntuye cevirir. */
function toView(row: Row): IntegrationConfigView {
  const provider = row.provider as ProviderName;
  const config: Record<string, string> = {};
  const secretKeysSet: string[] = [];

  for (const [key, value] of Object.entries(row.config ?? {})) {
    if (value == null || value === "") continue;
    if (isSecretKey(provider, key)) {
      secretKeysSet.push(key);
      continue; // deger BILEREK atiliyor
    }
    config[key] = String(value);
  }

  return {
    id: row.id,
    projectId: row.project_id,
    provider,
    enabled: row.enabled,
    config,
    secretKeysSet,
    lastSyncStatus: row.last_sync_status,
    lastSyncError: row.last_sync_error,
  };
}

export async function fetchIntegrationConfig(
  client: SupabaseClient,
  id: string,
): Promise<IntegrationConfigView> {
  const { data, error } = await client
    .from("project_integrations")
    .select("id, project_id, provider, enabled, config, last_sync_status, last_sync_error")
    .eq("id", id)
    .single();
  if (error) throw error;
  return toView(data as Row);
}

export async function createIntegration(
  client: SupabaseClient,
  args: { projectId: string; provider: ProviderName; config: Record<string, string> },
): Promise<{ id: string }> {
  const { data, error } = await client
    .from("project_integrations")
    .insert({
      project_id: args.projectId,
      provider: args.provider,
      config: stripEmpty(args.config),
      enabled: true,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: (data as { id: string }).id };
}

/**
 * Config gunceller. `patch` YALNIZCA kullanicinin doldurdugu alanlari icerir;
 * bos birakilan sir alanlari mevcut degerini korur (bkz. dosya basi).
 */
export async function updateIntegrationConfig(
  client: SupabaseClient,
  args: { id: string; patch: Record<string, string> },
): Promise<void> {
  const { data, error: readError } = await client
    .from("project_integrations")
    .select("config")
    .eq("id", args.id)
    .single();
  if (readError) throw readError;

  const current = ((data as { config: Record<string, unknown> | null }).config ?? {}) as Record<
    string,
    unknown
  >;
  const merged = { ...current, ...stripEmpty(args.patch) };

  const { error } = await client
    .from("project_integrations")
    .update({ config: merged })
    .eq("id", args.id);
  if (error) throw error;
}

export async function setIntegrationEnabled(
  client: SupabaseClient,
  args: { id: string; enabled: boolean },
): Promise<void> {
  const { error } = await client
    .from("project_integrations")
    .update({ enabled: args.enabled })
    .eq("id", args.id);
  if (error) throw error;
}

export async function deleteIntegration(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("project_integrations").delete().eq("id", id);
  if (error) throw error;
}

/** Bos string yazmak "alan silindi" ile karisir; hic yazma. */
function stripEmpty(o: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    const trimmed = v.trim();
    if (trimmed !== "") out[k] = trimmed;
  }
  return out;
}
