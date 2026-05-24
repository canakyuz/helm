import React, { useMemo, useState } from "react";
import { type CrudFilter, useList } from "@refinedev/core";
import { Compass, Globe2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GeoMap } from "@/components/tool-ui/geo-map";
import type { GeoMapMarker } from "@/components/tool-ui/geo-map";
import { getCountryGeo } from "@/lib/country-geo";
import { compact } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import type { MetricCountry } from "@/types";

interface UsersGeoMapProps {
  scope: string;
  isAll: boolean;
  days: number;
  metrics?: string[];
  /** Map iç yüksekliği (px). Default 320. Haulix layout için 540. */
  mapHeight?: number;
  /** Background mode — Card kabuğu yerine sadece map + overlays.
   *  Map-as-background cockpit için. */
  fullCanvas?: boolean;
}

const DEFAULT_METRICS = ["app_downloads", "dau"];

/** Marker boyutu için lineer-log ölçek: 1 → 10px, max → ~24px.
 *  Daha büyük marker'lar — map'te kaybolma riskini azaltır. */
const radiusFor = (value: number, max: number) => {
  if (max <= 0) return 10;
  const ratio = Math.log10(Math.max(1, value)) / Math.log10(Math.max(10, max));
  return 10 + ratio * 14;
};

export const UsersGeoMap = ({
  scope,
  isAll,
  days,
  metrics = DEFAULT_METRICS,
  mapHeight,
  fullCanvas = false,
}: UsersGeoMapProps) => {
  const since = useMemo(
    () => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10),
    [days],
  );

  const filters: CrudFilter[] = [
    { field: "date", operator: "gte", value: since },
    { field: "metric", operator: "in", value: metrics },
  ];
  if (!isAll) {
    filters.push({ field: "project_id", operator: "eq", value: scope });
  }

  const { result, query } = useList<MetricCountry>({
    resource: "metrics_country",
    filters,
    pagination: { mode: "off" },
  });
  const loading = query.isLoading;
  const rows = result.data;

  const byCountry = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const cc = r.country_code?.toUpperCase().trim();
      if (!cc || cc.length !== 2) continue;
      map.set(cc, (map.get(cc) ?? 0) + Number(r.value));
    }
    return map;
  }, [rows]);

  const [selected, setSelected] = useState<string | null>(null);

  const { markers, totalCountries, totalUsers, topCountries } = useMemo(() => {
    const maxVal = Math.max(0, ...byCountry.values());
    const items: GeoMapMarker[] = [];
    for (const [cc, value] of byCountry) {
      const geo = getCountryGeo(cc);
      if (!geo) continue;
      items.push({
        id: cc,
        lat: geo.lat,
        lng: geo.lng,
        label: `${geo.name} — ${compact(value)}`,
        description: `${geo.name}: ${value.toLocaleString("tr-TR")} kullanıcı/indirme`,
        tooltip: "hover",
        icon: {
          type: "dot",
          color: "var(--primary)",
          borderColor: "rgba(255,255,255,0.9)",
          radius: radiusFor(value, maxVal),
        },
      });
    }
    const top = Array.from(byCountry.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    let total = 0;
    for (const v of byCountry.values()) total += v;
    return {
      markers: items,
      totalCountries: byCountry.size,
      totalUsers: total,
      topCountries: top,
    };
  }, [byCountry]);

  const topCountry = topCountries[0];
  const selectedGeo = selected ? getCountryGeo(selected) : null;
  const selectedValue = selected ? byCountry.get(selected) ?? 0 : 0;

  // Map + tüm overlay'leri (top country, compass, modal) içeren parça.
  const mapInner = (
    <div
      className={cn(
        "relative h-full helm-pulse-markers",
        !fullCanvas && "[&_[role=region]]:!h-[var(--helm-map-h)]",
        fullCanvas && "[&_[role=region]]:!h-full [&_[data-slot=geo-map]>div]:!h-full [&_[data-slot=geo-map]>div]:!rounded-none [&_[data-slot=geo-map]>div]:!border-0",
      )}
      style={
        !fullCanvas
          ? ({
              "--helm-map-h": `${mapHeight ?? 320}px`,
            } as React.CSSProperties)
          : undefined
      }
    >
      <GeoMap
        id={`users-geo-map-${isAll ? "all" : scope}${fullCanvas ? "-canvas" : ""}`}
        markers={markers}
        clustering={{ enabled: false }}
        viewport={{ mode: "fit", padding: 24, maxZoom: 5 }}
        showZoomControl
        onMarkerClick={(m) => setSelected(m.id ?? null)}
      />

      {topCountry && (
        <div className="pointer-events-none absolute right-3 top-3 z-[500] rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-xs shadow-md backdrop-blur-md">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            En yoğun
          </div>
          <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
            {topCountry[0]} · {compact(topCountry[1])}
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] grid size-12 place-items-center rounded-full border border-border/70 bg-background/70 shadow-md backdrop-blur-md">
        <Compass
          className="size-6 text-primary/70 animate-[spin_60s_linear_infinite]"
          strokeWidth={1.5}
        />
      </div>

      {selected && selectedGeo && (
        <div
          className={cn(
            "absolute left-1/2 top-1/2 z-[600] w-[260px] -translate-x-1/2 -translate-y-1/2",
            "rounded-xl border border-border/70 bg-popover/90 p-4 shadow-xl backdrop-blur-md",
          )}
        >
          <button
            type="button"
            onClick={() => setSelected(null)}
            aria-label="Kapat"
            className="absolute right-2 top-2 grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <X className="size-3.5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary ring-1 ring-primary/30">
              {selected}
            </span>
            <span className="text-sm font-semibold">{selectedGeo.name}</span>
          </div>
          <div className="mt-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Toplam (son {days}g)
            </div>
            <div className="font-mono text-2xl font-semibold tabular-nums">
              {selectedValue.toLocaleString("tr-TR")}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Full canvas modu — Card kabuğu yok, sadece map + overlays (map background).
  if (fullCanvas) {
    if (loading) {
      return <Skeleton className="absolute inset-0 rounded-none" />;
    }
    if (markers.length === 0) {
      return (
        <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
          <div className="text-center">
            <Globe2 className="mx-auto size-8 opacity-30" />
            <div className="mt-2">Henüz ülke verisi yok</div>
            <div className="text-xs opacity-70">
              ASC veya PostHog senkronlandıktan sonra görünür
            </div>
          </div>
        </div>
      );
    }
    return mapInner;
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Globe2 className="size-4" />
            Kullanıcı Dağılımı
          </span>
          {markers.length > 0 && (
            <span className="font-mono text-sm font-normal text-muted-foreground tabular-nums">
              {totalCountries} ülke · {compact(totalUsers)}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[320px] w-full rounded-lg" />
        ) : markers.length === 0 ? (
          <div className="flex h-[320px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground">
            <Globe2 className="size-6 opacity-40" />
            <div>Henüz ülke verisi yok.</div>
            <div className="text-xs">
              App Store Connect veya PostHog (
              <code className="text-[10px]">$geoip_country_code</code>)
              senkronlandıktan sonra burada görünür.
            </div>
          </div>
        ) : (
          mapInner
        )}

        {/* Top-5 ülke chip listesi (kart altında) */}
        {topCountries.length > 0 && !loading && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {topCountries.map(([cc, v]) => {
              const g = getCountryGeo(cc);
              return (
                <button
                  key={cc}
                  type="button"
                  onClick={() => setSelected(cc)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 font-mono tabular-nums transition-colors hover:bg-accent",
                    selected === cc && "ring-1 ring-primary",
                  )}
                >
                  <span className="font-semibold">{cc}</span>
                  <span className="text-muted-foreground">
                    {g?.name ?? cc}
                  </span>
                  <span>· {compact(v)}</span>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
