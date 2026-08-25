import { useList, useNavigation } from "@refinedev/core";
import { Boxes, ChevronsUpDown, Pencil, Plus } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

import { BrandLogo } from "@/components/brand-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useScope } from "@/context/scope";
import { PROPERTY_TYPE_LABELS } from "@/lib/modules";
import type { Brand, Property } from "@/types";

interface BrandGroup {
  brand: Brand;
  properties: Property[];
}

const ORPHAN_BRAND: Brand = {
  id: "__orphan__",
  name: "Marka'sız",
  slug: "",
  logo_url: null,
  created_at: "",
};

// Brand + property listeleri. Refine useList react-query üzerinden çalıştığı
// için aynı resource/param ile çağıran ikinci tüketici (SidebarLogo) ek network
// isteği doğurmaz - aynı cache anahtarını paylaşır.
const useScopeData = (): { brands: Brand[]; properties: Property[] } => {
  const { result: brandsResult } = useList<Brand>({
    resource: "brands",
    pagination: { mode: "off" },
    queryOptions: { retry: false },
  });
  const { result: propsResult } = useList<Property>({
    resource: "properties",
    pagination: { mode: "off" },
    queryOptions: { retry: false },
  });
  return {
    brands: brandsResult?.data ?? [],
    properties: propsResult?.data ?? [],
  };
};

/** Aktif kapsamın markası - scope "all" ise veya marka yoksa null. */
export const useActiveBrand = (): Brand | null => {
  const { scope } = useScope();
  const { brands, properties } = useScopeData();
  if (scope === "all") return null;
  const property = properties.find((p) => p.id === scope);
  if (!property) return null;
  return brands.find((b) => b.id === property.brand_id) ?? null;
};

// Sidebar üstündeki 2-seviye kapsam seçici:
// • Brand'ler altında property'ler grup grup listelenir.
// • Property tıklayınca scope = property.id (eski projects davranışı ile uyumlu).
// • "All properties" → scope = "all".
// • Brand satırının kalem ikonu /brands/edit/:id'ye gider.
//
// Faz 8: brand-level aggregate scope.kind eklenirse burası genişler.
export const ProjectSwitcher = () => {
  const { scope, setScope } = useScope();
  const { create, edit } = useNavigation();

  const { brands, properties } = useScopeData();

  const groups: BrandGroup[] = useMemo(() => {
    const byBrand = new Map<string, BrandGroup>();
    for (const b of brands) byBrand.set(b.id, { brand: b, properties: [] });
    const orphans: Property[] = [];
    for (const p of properties) {
      const g = p.brand_id ? byBrand.get(p.brand_id) : undefined;
      if (g) g.properties.push(p);
      else orphans.push(p);
    }
    const ordered = Array.from(byBrand.values())
      .filter((g) => g.properties.length > 0)
      .sort((a, b) => a.brand.name.localeCompare(b.brand.name));
    if (orphans.length > 0) {
      ordered.push({ brand: ORPHAN_BRAND, properties: orphans });
    }
    return ordered;
  }, [brands, properties]);

  const active = scope === "all" ? null : properties.find((p) => p.id === scope);
  const activeBrand = active
    ? brands.find((b) => b.id === active.brand_id)
    : null;

  const label = active?.name ?? "Tüm property'ler";
  const sub = active
    ? `${activeBrand?.name ?? "Marka'sız"} · ${PROPERTY_TYPE_LABELS[active.type] ?? active.type}`
    : `${properties.length} property · ${brands.length} marka`;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className={cn(
                "h-12 rounded-xl border border-border bg-card px-2.5 shadow-[0_1px_2px_rgba(16,17,20,0.04)] data-[state=open]:bg-card",
                // İkon modunda kart kabuğu 48px'e sıkışıp metni taşırıyordu.
                "group-data-[collapsible=icon]:h-8! group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:shadow-none",
              )}
            >
              {/* Aktif property'nin markasında logo varsa onu göster, yoksa
                  jenerik kutu ikonu. */}
              <BrandLogo
                name={activeBrand?.name ?? label}
                logoUrl={activeBrand?.logo_url}
                fallback={<Boxes className="size-4" />}
              />
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0 transition-[opacity,width] duration-200 ease-linear overflow-hidden">
                <span className="truncate font-medium">{label}</span>
                <span className="truncate text-xs text-muted-foreground">{sub}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-72" align="start">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Kapsam
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setScope("all")}>
              <Boxes className="size-4" /> Tüm property'ler
            </DropdownMenuItem>

            {groups.map((g) => (
              <div key={g.brand.id}>
                <DropdownMenuSeparator />
                <div className="flex items-center justify-between gap-2 px-2 py-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <BrandLogo
                      name={g.brand.name}
                      logoUrl={g.brand.logo_url}
                      className="size-5 rounded"
                    />
                    <span className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {g.brand.name}
                    </span>
                  </span>
                  {g.brand.id !== ORPHAN_BRAND.id && (
                    <button
                      type="button"
                      aria-label={`${g.brand.name} - markayı düzenle`}
                      onClick={(e) => {
                        e.stopPropagation();
                        edit("brands", g.brand.id);
                      }}
                      className="rounded p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="size-3" />
                    </button>
                  )}
                </div>
                {g.properties.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => setScope(p.id)}
                    className="group flex items-center justify-between gap-2"
                  >
                    <span className="flex flex-1 items-center gap-2 truncate">
                      <span className="size-4" />
                      <span className="truncate">{p.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {PROPERTY_TYPE_LABELS[p.type] ?? ""}
                      </span>
                    </span>
                    <button
                      type="button"
                      aria-label={`${p.name} - property düzenle`}
                      onClick={(e) => {
                        e.stopPropagation();
                        edit("properties", p.id);
                      }}
                      className="rounded p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  </DropdownMenuItem>
                ))}
              </div>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => create("properties")}>
              <Plus className="size-4" /> Yeni property
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
