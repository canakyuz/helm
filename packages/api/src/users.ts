import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";
import type { PropertyType } from "./properties";

export type HubUser = {
  id: string;
  propertyId: string;
  propertyName: string | null;
  email: string | null;
  username: string | null;
  displayName: string | null;
  country: string | null;
  countryCode: string | null;
  city: string | null;
  location: string | null;
  avatarUrl: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  banned: boolean;
  premium: boolean;
  providers: string[];
};

type EdgeUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned: boolean;
  premium: boolean;
  providers: string[];
  username: string | null;
  display_name: string | null;
  country: string | null;
  country_code: string | null;
  city: string | null;
  location: string | null;
  avatar_url: string | null;
};

type FetchResp = { users?: EdgeUser[]; error?: string };
type PropertyRow = { id: string; name: string; type: PropertyType };

// Supabase-auth entegrasyonu olan property'ler (helm-users edge yalnız onlar için çalışır).
export async function listSupabaseProperties(
  client: SupabaseClient,
): Promise<PropertyRow[]> {
  const [integRes, propsRes] = await Promise.all([
    client
      .from("project_integrations")
      .select("project_id")
      .eq("provider", "supabase")
      .eq("enabled", true),
    client.from("properties").select("id, name, type"),
  ]);

  if (integRes.error) throw integRes.error;
  if (propsRes.error) throw propsRes.error;

  const allowed = new Set(
    ((integRes.data ?? []) as Array<{ project_id: string }>).map((r) => r.project_id),
  );
  return ((propsRes.data ?? []) as PropertyRow[]).filter((p) => allowed.has(p.id));
}

async function fetchUsersForProperty(
  client: SupabaseClient,
  property: PropertyRow,
): Promise<HubUser[]> {
  const { data, error } = await client.functions.invoke<FetchResp>("helm-users", {
    body: { project_id: property.id },
  });
  if (error || !data?.users) return [];

  return data.users.map((u) => ({
    id: u.id,
    propertyId: property.id,
    propertyName: property.name,
    email: u.email,
    username: u.username,
    displayName: u.display_name,
    country: u.country,
    countryCode: u.country_code,
    city: u.city,
    location: u.location,
    avatarUrl: u.avatar_url,
    createdAt: u.created_at,
    lastSignInAt: u.last_sign_in_at,
    banned: u.banned,
    premium: u.premium,
    providers: u.providers ?? [],
  }));
}

export async function fetchAllUsers(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
): Promise<HubUser[]> {
  const properties = await listSupabaseProperties(client);
  const filtered =
    propertyId === "all"
      ? properties
      : properties.filter((p) => p.id === propertyId);

  const batches = await Promise.all(
    filtered.map((p) => fetchUsersForProperty(client, p)),
  );
  return batches.flat();
}
