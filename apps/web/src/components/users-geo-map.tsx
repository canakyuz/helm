import { useMemo } from "react";
import { type CrudFilter, useList } from "@refinedev/core";
import { Globe2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GeoMap } from "@/components/tool-ui/geo-map";
import type { GeoMapMarker } from "@/components/tool-ui/geo-map";
import { getCountryGeo } from "@/lib/country-geo";
import { compact } from "@/lib/metrics";
import type { MetricCountry } from "@/types";

interface UsersGeoMapProps {
  /** Aktif proje scope. "all" → tüm projeler toplam. */
  scope: string;
  isAll: boolean;
  /** Geriye dönük gün sayısı (sayfanın range select'i). */
  days: number;
  /**
   * Ülke kırılımı hangi metrik(ler)den okunsun?
   *   - "app_downloads" (App Store Connect)
   *   - "dau" (PostHog $geoip_country_code)
   * Veri kaynağı yoksa boş state gösterilir.
   */
  metrics?: string[];
}

const DEFAULT_METRICS = ["app_downloads", "dau"];

/** Marker boyutu için lineer-log ölçek: 1 → 6px, 100 → ~10px, 10000 → ~14px. */
const radiusFor = (value: number, max: number) => {
  if (max <= 0) return 6;
  const ratio = Math.log10(Math.max(1, value)) / Math.log10(Math.max(10, max));
  return 6 + ratio * 10; // 6–16 arası
};

/** Toplam kullanıcı/indirme dağılımı dünya haritasında. Ana cockpit kartı. */
export const UsersGeoMap = ({
  scope,
  isAll,
  days,
  metrics = DEFAULT_METRICS,
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

  // Ülke kodu → toplam değer. Aynı ülkenin farklı tarih+metric satırlarını
  // topla. (Aynı kullanıcının birden fazla güne sayılması mümkün; bu kart
  // dağılımı göstermek için — exact unique count değil.)
  const byCountry = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const cc = r.country_code?.toUpperCase().trim();
      if (!cc || cc.length !== 2) continue;
      map.set(cc, (map.get(cc) ?? 0) + Number(r.value));
    }
    return map;
  }, [rows]);

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
          borderColor: "var(--background)",
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Globe2 className="size-4" />
            Kullanıcı Dağılımı — Ülkelere Göre
          </span>
          {markers.length > 0 && (
            <span className="font-mono text-sm font-normal text-muted-foreground tabular-nums">
              {totalCountries} ülke · {compact(totalUsers)} toplam
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[320px] w-full rounded-lg" />
        ) : markers.length === 0 ? (
          <div className="flex h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground">
            <Globe2 className="size-6 opacity-40" />
            <div>Henüz ülke verisi yok.</div>
            <div className="text-xs">
              App Store Connect veya PostHog (
              <code className="text-[10px]">$geoip_country_code</code>)
              senkronlandıktan sonra burada görünür.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <GeoMap
              id={`users-geo-map-${isAll ? "all" : scope}`}
              markers={markers}
              clustering={{ enabled: false }}
              viewport={{ mode: "fit", padding: 24, maxZoom: 5 }}
              showZoomControl
            />
            {topCountries.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                {topCountries.map(([cc, v]) => {
                  const g = getCountryGeo(cc);
                  return (
                    <span
                      key={cc}
                      className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 font-mono tabular-nums"
                    >
                      <span className="font-semibold">{cc}</span>
                      <span className="text-muted-foreground">
                        {g?.name ?? cc}
                      </span>
                      <span>· {compact(v)}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
