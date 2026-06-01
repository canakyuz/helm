import { useQuery } from "@tanstack/react-query";

import { supabase } from "~/lib/supabase";
import type { PropertyType } from "~/hooks/use-properties";

type AuthLikeUser = {
  id: string;
  last_sign_in_at: string | null;
  created_at: string;
};

type FetchUsersResp = { users?: AuthLikeUser[]; error?: string };

export type PropertyDau = {
  id: string;
  name: string;
  brandName: string | null;
  type: PropertyType;
  dau: number; // son 24 saat
  total: number; // toplam kayıtlı
};

type PropertyRow = {
  id: string;
  name: string;
  type: PropertyType;
  brands: { name: string } | null;
};

async function fetchUsers(propertyId: string): Promise<AuthLikeUser[]> {
  const { data, error } = await supabase.functions.invoke<FetchUsersResp>(
    "helm-users",
    { body: { project_id: propertyId } },
  );
  if (error) return [];
  return data?.users ?? [];
}

async function fetchPropertyDau(): Promise<PropertyDau[]> {
  // Tüm property'leri ve aktif Supabase integration'larını al.
  const [propsRes, integRes] = await Promise.all([
    supabase
      .from("properties")
      .select("id, name, type, brands ( name )")
      .order("name"),
    supabase
      .from("project_integrations")
      .select("project_id")
      .eq("provider", "supabase")
      .eq("enabled", true),
  ]);

  if (propsRes.error) throw propsRes.error;
  if (integRes.error) throw integRes.error;

  const properties = (propsRes.data as unknown as PropertyRow[] | null) ?? [];
  const integrated = new Set(
    ((integRes.data ?? []) as Array<{ project_id: string }>).map(
      (r) => r.project_id,
    ),
  );

  const cutoff = Date.now() - 86_400_000; // son 24h

  // Sadece Supabase entegrasyonu olan property'ler için kullanıcı çek.
  const usersByProperty = await Promise.all(
    properties.map(async (p) => {
      if (!integrated.has(p.id)) return { id: p.id, users: [] as AuthLikeUser[] };
      const users = await fetchUsers(p.id);
      return { id: p.id, users };
    }),
  );

  const userMap = new Map(usersByProperty.map((u) => [u.id, u.users]));

  return properties.map<PropertyDau>((p) => {
    const users = userMap.get(p.id) ?? [];
    const dau = users.filter(
      (u) =>
        u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() >= cutoff,
    ).length;
    return {
      id: p.id,
      name: p.name,
      brandName: p.brands?.name ?? null,
      type: p.type,
      dau,
      total: users.length,
    };
  });
}

export function usePropertyDau() {
  return useQuery({
    queryKey: ["property-dau"],
    queryFn: fetchPropertyDau,
    staleTime: 2 * 60_000,
  });
}
