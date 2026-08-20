// useEnabledModules - aktif scope için aktif modüllerin listesini döner.
// Detay: .docs/MODULES.md §3-§4
//
// Şu anda scope iki seviyeli: "all" | property_id.
// Brand seviyesi (Faz 8) eklenince burası genişler.

import { useList } from "@refinedev/core";
import { useMemo } from "react";

import { useScope } from "@/context/scope";
import {
  MODULE_KEYS,
  type ModuleKey,
  type PropertyType,
  PRESET_MODULES,
} from "@/lib/modules";

interface PropertyRow {
  id: string;
  brand_id?: string | null;
  type?: PropertyType | null;
  enabled_modules?: ModuleKey[] | null;
}

const ALL_MODULES: ModuleKey[] = [...MODULE_KEYS];

/**
 * Aktif scope için açık modüllerin listesi.
 * - scope === "all":     tüm property'lerin enabled_modules union'ı (boşsa preset fallback).
 * - scope === uuid:      o property'nin enabled_modules (boşsa preset fallback).
 *
 * Migration aşamasında enabled_modules text[] kolonu '{}' default ile gelir; bu yüzden
 * preset fallback elzem - eski projeler boş kalmasın, type'a göre default doldurulmuş gibi davransın.
 */
export function useEnabledModules(): ModuleKey[] {
  const { scope } = useScope();

  const { result } = useList<PropertyRow>({
    resource: "properties",
    pagination: { mode: "off" },
    queryOptions: {
      // Faz 1 migration uygulanmamışsa `properties` 404 verir; o durumda tüm modüller açık
      // gibi davran (UI kırılmasın). Migration sonrası gerçek liste gelir.
      retry: false,
    },
  });

  return useMemo(() => {
    const rows: PropertyRow[] = result?.data ?? [];

    // Migration henüz uygulanmamış (veya request hata aldı): geri-uyumluluk için tümü açık.
    if (rows.length === 0) return ALL_MODULES;

    const expand = (row: PropertyRow): ModuleKey[] => {
      const explicit = (row.enabled_modules ?? []).filter((k): k is ModuleKey =>
        MODULE_KEYS.includes(k),
      );
      if (explicit.length > 0) return explicit;
      // Boş array → preset fallback (mobile_app default'a düşmüş eski proje).
      return row.type ? PRESET_MODULES[row.type] : ALL_MODULES;
    };

    if (scope === "all") {
      const union = new Set<ModuleKey>();
      for (const row of rows) for (const m of expand(row)) union.add(m);
      return Array.from(union);
    }

    const current = rows.find((p: PropertyRow) => p.id === scope);
    return current ? expand(current) : ALL_MODULES;
  }, [result, scope]);
}

export function useIsModuleEnabled(key: ModuleKey): boolean {
  return useEnabledModules().includes(key);
}
