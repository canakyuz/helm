import { useList, useNavigation } from "@refinedev/core";
import { Boxes, ChevronsUpDown, Pencil, Plus } from "lucide-react";
import { useMemo } from "react";

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

  const brands: Brand[] = brandsResult?.data ?? [];
  const properties: Property[] = propsResult?.data ?? [];

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
      ordered.push({
        brand: { id: "__orphan__", name: "Brand'siz", slug: "", created_at: "" },
        properties: orphans,
      });
    }
    return ordered;
  }, [brands, properties]);

  const active = scope === "all" ? null : properties.find((p) => p.id === scope);
  const activeBrand = active
    ? brands.find((b) => b.id === active.brand_id)
    : null;

  const label = active?.name ?? "All properties";
  const sub = active
    ? `${activeBrand?.name ?? "Brand'siz"} · ${PROPERTY_TYPE_LABELS[active.type] ?? active.type}`
    : `${properties.length} property · ${brands.length} brand`;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-foreground ring-1 ring-foreground/10">
                <Boxes className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{label}</span>
                <span className="truncate text-xs text-muted-foreground">{sub}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-72" align="start">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Kapsam
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setScope("all")}>
              <Boxes className="size-4" /> Tüm Property'ler
            </DropdownMenuItem>

            {groups.map((g) => (
              <div key={g.brand.id}>
                <DropdownMenuSeparator />
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {g.brand.name}
                  </span>
                  {g.brand.id !== "__orphan__" && (
                    <button
                      type="button"
                      aria-label={`${g.brand.name} — edit brand`}
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
                      aria-label={`${p.name} — edit property`}
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
