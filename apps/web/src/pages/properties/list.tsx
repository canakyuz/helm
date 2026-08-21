import { useMemo } from "react";
import { Link } from "react-router";
import { useList, useNavigation } from "@refinedev/core";
import { Boxes, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MODULE_META,
  PROPERTY_TYPE_LABELS,
  type ModuleKey,
} from "@/lib/modules";
import type { Brand, Property } from "@/types";

interface BrandGroup {
  brand: Brand;
  properties: Property[];
}

export const PropertiesListPage = () => {
  const { create, edit } = useNavigation();

  const { result: brandsResult } = useList<Brand>({
    resource: "brands",
    pagination: { mode: "off" },
  });
  const { result: propsResult } = useList<Property>({
    resource: "properties",
    pagination: { mode: "off" },
  });

  const brands = brandsResult?.data ?? [];
  const properties = propsResult?.data ?? [];

  const groups = useMemo<BrandGroup[]>(() => {
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
        brand: { id: "__orphan__", name: "Markasız", slug: "", created_at: "" },
        properties: orphans,
      });
    }
    return ordered;
  }, [brands, properties]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Property'ler</h1>
        <Button onClick={() => create("properties")}>
          <Plus className="size-4" />
          Yeni property
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Henüz property yok. <strong>Yeni property</strong> ile başla.
          </CardContent>
        </Card>
      ) : (
        groups.map((g) => (
          <Card key={g.brand.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Boxes className="size-4" />
                  {g.brand.name}
                  <Badge variant="secondary" className="text-xs tabular-nums">
                    {g.properties.length} property
                  </Badge>
                </span>
                {g.brand.id !== "__orphan__" && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Markayı düzenle"
                    onClick={() => edit("brands", g.brand.id)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.properties.map((p) => (
                <PropertyCard key={p.id} property={p} onEdit={edit} />
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

interface PropertyCardProps {
  property: Property;
  onEdit: (resource: string, id: string) => void;
}

const PropertyCard = ({ property, onEdit }: PropertyCardProps) => {
  const typeLabel =
    PROPERTY_TYPE_LABELS[property.type] ?? property.type;
  const modules = (property.enabled_modules ?? []) as ModuleKey[];
  return (
    <div className="group flex flex-col rounded-lg border bg-card p-3 transition-colors hover:bg-accent">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/properties/edit/${property.id}`}
            className="block truncate font-medium hover:underline"
          >
            {property.name}
          </Link>
          <div className="font-mono text-xs text-muted-foreground">
            {property.slug}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Düzenle"
          onClick={() => onEdit("properties", property.id)}
        >
          <Pencil className="size-4" />
        </Button>
      </div>

      <Badge variant="outline" className="mb-3 w-fit text-xs">
        {typeLabel}
      </Badge>

      {modules.length === 0 ? (
        <div className="text-xs text-muted-foreground">
          Aktif modül yok - düzenle, seç.
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {modules.map((m) => (
            <Badge
              key={m}
              variant="secondary"
              className="text-[10px] tabular-nums"
            >
              {MODULE_META[m]?.label ?? m}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};
