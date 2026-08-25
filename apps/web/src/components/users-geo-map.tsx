import React, { useMemo, useState } from "react";
import { type CrudFilter, useList } from "@refinedev/core";
import { Globe2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GeoMap } from "@/components/tool-ui/geo-map";
import type { GeoMapMarker } from "@/components/tool-ui/geo-map";
import { getCountryGeo } from "@/lib/country-geo";
import { compact } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { useHelmTheme } from "@/theme/ThemeProvider";
import type { MetricCountry } from "@/types";

interface UsersGeoMapProps {
  scope: string;
  isAll: boolean;
  days: number;
  metrics?: string[];
  /** Map iç yüksekliği (px). Default 320. Haulix layout için 540. */
  mapHeight?: number;
  /** Background mode - Card kabuğu yerine sadece map + overlays.
   *  Map-as-background cockpit için. */
  fullCanvas?: boolean;
}

const DEFAULT_METRICS = ["app_downloads", "dau"];

/** Marker boyutu için lineer-log ölçek: 1 → 5px, max → ~16px.
 *  Küçük yarıçap + beyaz ring - düşük zoom'da blob birleşmesini önler. */
const radiusFor = (value: number, max: number) => {
  if (max <= 0) return 5;
  const ratio = Math.log10(Math.max(1, value)) / Math.log10(Math.max(10, max));
  return 5 + ratio * 11;
};

export const UsersGeoMap = ({
  scope,
  isAll,
  days,
  metrics = DEFAULT_METRICS,
  mapHeight,
  fullCanvas = false,
}: UsersGeoMapProps) => {
  // Tile temasını app temasından al - OS temasına düşerse light app'te
  // koyu harita çıkıyordu (okunmaz kontrast).
  const { theme } = useHelmTheme();
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
        label: `${geo.name} - ${compact(value)}`,
        description: `${geo.name}: ${value.toLocaleString("en-US")} users/downloads`,
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
        fullCanvas && "[&_[role=region]]:!h-full [&_[data-slot=geo-map]>div]:!h-full [&_[data-slot=geo-map]>div]:!min-h-0 [&_[data-slot=geo-map]>div]:!rounded-none [&_[data-slot=geo-map]>div]:!border-0",
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
        theme={theme.mode}
        onMarkerClick={(m) => setSelected(m.id ?? null)}
      />

      {/* Top-left: en yoğun ülke (zoom +/- sağ-üstte; çakışma yok). */}
      {topCountry && (
        <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-[0_1px_2px_rgba(16,17,20,0.06)]">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            En yoğun
          </div>
          <div className="mt-0.5 text-sm font-semibold tabular-nums">
            {topCountry[0]} · {compact(topCountry[1])}
          </div>
        </div>
      )}

      {selected && selectedGeo && (
        <div
          className={cn(
            "absolute left-1/2 top-1/2 z-[600] w-[260px] -translate-x-1/2 -translate-y-1/2",
            "rounded-xl border border-border bg-card p-4 shadow-lg",
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
            <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {selected}
            </span>
            <span className="text-sm font-semibold">{selectedGeo.name}</span>
          </div>
          <div className="mt-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Toplam (son {days}g)
            </div>
            <div className="helm-hero-number mt-1 text-2xl">
              {selectedValue.toLocaleString("en-US")}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Full canvas modu - Card kabuğu yok, sadece map + overlays (map background).
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
    <Card className="py-0">
      <CardHeader className="flex flex-row items-center justify-between px-5 pt-5 pb-0">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Globe2 className="size-4" />
          Kullanıcı Dağılımı
        </CardTitle>
        {markers.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {totalCountries} ülke · {compact(totalUsers)}
          </span>
        )}
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-3">
        {loading ? (
          <Skeleton className="h-[300px] w-full rounded-xl" />
        ) : markers.length === 0 ? (
          <div className="flex h-[300px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground">
            <Globe2 className="size-6 opacity-40" />
            <div>Henüz ülke verisi yok.</div>
            <div className="text-xs">
              App Store Connect veya PostHog (
              <code className="text-[10px]">$geoip_country_code</code>)
              senkronlandıktan sonra burada görünür.
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border [&_.leaflet-container]:!bg-muted">
            {mapInner}
          </div>
        )}

        {/* Top-5 ülke chip listesi (kart altında) - tıkla → detay */}
        {topCountries.length > 0 && !loading && (
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            {topCountries.map(([cc, v]) => {
              const g = getCountryGeo(cc);
              const active = selected === cc;
              return (
                <button
                  key={cc}
                  type="button"
                  onClick={() => setSelected(active ? null : cc)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 tabular-nums transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "font-semibold",
                      active ? "text-primary-foreground" : "text-foreground",
                    )}
                  >
                    {cc}
                  </span>
                  <span>{g?.name ?? cc}</span>
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
