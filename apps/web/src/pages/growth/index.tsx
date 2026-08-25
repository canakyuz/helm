import { useEffect, useMemo, useState } from "react";
import { type CrudFilter, useList } from "@refinedev/core";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Globe,
  MapPin,
  Megaphone,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { supabaseClient } from "@/providers/supabase-client";
import type { ProjectIntegration } from "@/types";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageStatus } from "@/components/ui/page-status";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RangeSelect } from "@/components/range-select";
import { StatCard } from "@/components/stat-card";
import { TrendChart } from "@/components/trend-chart";
import { GeoMap } from "@/components/tool-ui/geo-map";
import { useScope } from "@/context/scope";
import { useHelmTheme } from "@/theme/ThemeProvider";
import { getCountryGeo } from "@/lib/country-geo";
import { cn } from "@/lib/utils";
import { compact, deltaPct, latest, series } from "@/lib/metrics";
import type { Metric, MetricCountry } from "@/types";

export const GrowthPage = () => {
  const { scope, isAll } = useScope();
  const { theme } = useHelmTheme();
  const [range, setRange] = useState(90);

  const since = useMemo(
    () =>
      new Date(Date.now() - range * 86_400_000).toISOString().slice(0, 10),
    [range],
  );

  // Bu sayfanin okudugu metrikler. Metrik filtresi OLMADAN bu sorgu 90 gunluk
  // pencerede 3.102 satir istiyor; PostgREST 1.000'de sessizce kesiyor ve
  // hangi 1.000'in gelecegi ORDER BY olmadan belirsiz kaliyor. Sonuc yavaslik
  // degil, veri kaybi: kartlar sifir gorunurken veri veritabaninda duruyor.
  // Yeni metrik eklersen bu listeye de ekle.
  const GROWTH_METRICS = ["dau", "wau", "mau", "new_users", "total_users"];

  // Kapsam filtreleri (tarih + proje) - metrik filtresi ICERMEZ.
  // Ulke sorgusu tek bir metrige "eq" ile bakiyor; asagidaki metric-"in"
  // filtresiyle birlikte gonderilirse PostgREST ikisini AND'ler ve sorgu
  // hicbir zaman eslesmez (ulke widget'i her zaman bos gorunurdu).
  const scopeFilters: CrudFilter[] = [
    { field: "date", operator: "gte", value: since },
  ];
  if (!isAll) {
    scopeFilters.push({ field: "project_id", operator: "eq", value: scope });
  }

  const filters: CrudFilter[] = [
    ...scopeFilters,
    { field: "metric", operator: "in", value: GROWTH_METRICS },
  ];
  const { result, query } = useList<Metric>({
    resource: "metrics",
    filters,
    // Tavan yine de asilirsa kaybedilen EN ESKI gunler olsun, rastgele gunler
    // degil: grafik kisalir ama bugunun rakami dogru kalir.
    sorters: [{ field: "date", order: "desc" }],
    pagination: { mode: "off" },
  });
  const metrics = result.data;
  const loading = query.isLoading;

  // Ülke kırılımı
  const [geoMetric, setGeoMetric] = useState<string>("app_downloads");
  const { result: countryResult, query: countryQuery } = useList<MetricCountry>({
    resource: "metrics_country",
    filters: [
      ...scopeFilters,
      { field: "metric", operator: "eq", value: geoMetric },
    ],
    pagination: { mode: "off" },
  });
  const countryRows = countryResult.data;

  // Ülke koduna göre topla
  const byCountry = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of countryRows) {
      totals.set(
        r.country_code,
        (totals.get(r.country_code) ?? 0) + Number(r.value),
      );
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [countryRows]);

  const grandTotal = byCountry.reduce((a, [, v]) => a + v, 0);
  const maxCountryValue = byCountry[0]?.[1] ?? 0;

  // Harita marker'ları - koordinatlı ülkeler
  const geoMarkers = useMemo(() => {
    return byCountry
      .map(([code, value]) => {
        const info = getCountryGeo(code);
        if (!info) return null;
        // Marker yarıçapı sıklığa göre - radius 6-22 arası
        const ratio =
          maxCountryValue > 0 ? Math.sqrt(value / maxCountryValue) : 0;
        const radius = Math.round(6 + ratio * 16);
        return {
          id: code,
          lat: info.lat,
          lng: info.lng,
          label: `${info.name}: ${compact(value)}`,
          tooltip: "hover" as const,
          icon: {
            type: "dot" as const,
            color: "var(--primary)",
            borderColor: "var(--background)",
            radius,
          },
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  }, [byCountry, maxCountryValue]);

  const dauSeries = useMemo(() => series(metrics, "dau"), [metrics]);
  const usersSeries = useMemo(
    () => series(metrics, "total_users"),
    [metrics],
  );
  const newUsersSeries = useMemo(
    () => series(metrics, "new_users"),
    [metrics],
  );

  const dau = latest(metrics, "dau");
  const mau = latest(metrics, "mau");
  const stickiness = mau > 0 ? (dau / mau) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Büyüme</h1>
        <RangeSelect value={range} onChange={setRange} />
      </div>

      {query.isError && (
        <PageStatus
          tone="error"
          label="Metrikler yüklenemedi - rakamlar eksik olabilir, sayfayı yenile"
          className="min-h-0 py-4"
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="DAU"
          value={compact(dau)}
          icon={<Users />}
          delta={deltaPct(dauSeries)}
          loading={loading}
        />
        <StatCard
          title="WAU"
          value={compact(latest(metrics, "wau"))}
          icon={<CalendarDays />}
          loading={loading}
        />
        <StatCard
          title="MAU"
          value={compact(mau)}
          icon={<CalendarDays />}
          loading={loading}
        />
        <StatCard
          title="Stickiness (DAU/MAU)"
          value={`%${stickiness.toFixed(0)}`}
          icon={<Sparkles />}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{`Günlük aktif kullanıcı - son ${range} gün`}</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={dauSeries}
              color={theme.chart.users}
              format={compact}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{`Yeni kullanıcılar - son ${range} gün`}</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={newUsersSeries}
              color={theme.chart.revenue}
              format={compact}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{`Toplam kullanıcı büyümesi - son ${range} gün`}</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart
            data={usersSeries}
            color={theme.chart.users}
            format={compact}
            height={200}
          />
        </CardContent>
      </Card>

      {/* PostHog geo breakdown - IP tabanlı, izinsiz */}
      <PostHogGeoCard scope={scope} isAll={isAll} days={range} />

      {/* Acquisition: referrer kırılımı + UTM (ücretli kampanya) atıfı */}
      <AcquisitionSection scope={scope} isAll={isAll} days={range} />

      {/* Ülke kırılımı - metrics_country tablosundan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="size-4" />
            Ülke Kırılımı - son {range} gün
          </CardTitle>
          <CardAction>
            <Select value={geoMetric} onValueChange={setGeoMetric}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="app_downloads">İndirme</SelectItem>
                <SelectItem value="app_revenue">Mağaza geliri</SelectItem>
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>
        <CardContent>
          {countryQuery.isLoading ? (
            <PageStatus tone="loading" label="Ülke kırılımı yükleniyor…" />
          ) : byCountry.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Ülke kırılımı yok. App Store Connect bağlanınca App Store
              raporundan otomatik dolar (App Store ilk senkronda T-1 günü
              dahil).
            </div>
          ) : (
            <div className="space-y-4">
              {geoMarkers.length > 0 && (
                <GeoMap
                  id="growth-country-map"
                  markers={geoMarkers}
                  viewport={{ mode: "fit", target: "markers", padding: 32 }}
                  clustering={{ enabled: false }}
                />
              )}
              <div className="overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ülke</TableHead>
                      <TableHead className="text-right">Değer</TableHead>
                      <TableHead className="text-right">Pay</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byCountry.slice(0, 20).map(([code, value]) => (
                      <TableRow key={code}>
                        <TableCell>
                          <span className="font-mono text-xs text-muted-foreground">
                            {code}
                          </span>{" "}
                          <span className="font-medium">
                            {getCountryGeo(code)?.name ?? code}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {compact(value)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                          {grandTotal > 0
                            ? `${((value / grandTotal) * 100).toFixed(1)}%`
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {byCountry.length > 20 && (
                <p className="text-center text-xs text-muted-foreground">
                  +{byCountry.length - 20} ülke daha
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

/* ───────────────────────── PostHog Geo Card ───────────────────────── */

interface CountryRow {
  country: string;
  country_name: string | null;
  users: number;
}
interface RegionRow {
  region: string;
  city: string;
  users: number;
}

const PostHogGeoCard = ({
  scope,
  isAll,
  days,
}: {
  scope: string;
  isAll: boolean;
  days: number;
}) => {
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [regions, setRegions] = useState<Record<string, RegionRow[]>>({});
  const [regionLoading, setRegionLoading] = useState<string | null>(null);

  // PostHog bağlı mı?
  const { result: integResult } = useList<ProjectIntegration>({
    resource: "project_integrations",
    filters: isAll
      ? []
      : [{ field: "project_id", operator: "eq", value: scope }],
    pagination: { mode: "off" },
  });
  const phConnected = integResult.data.some(
    (i) => i.provider === "posthog" && i.enabled,
  );

  useEffect(() => {
    if (isAll || !phConnected) {
      setCountries([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setExpanded(null);
    setRegions({});
    supabaseClient.functions
      .invoke("helm-geo-breakdown", {
        body: { project_id: scope, days },
      })
      .then(({ data, error: fnErr }) => {
        if (cancelled) return;
        if (fnErr) throw fnErr;
        if (data?.error) throw new Error(data.error);
        setCountries((data?.rows as CountryRow[]) ?? []);
        setTotal(data?.total ?? 0);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, isAll, days, phConnected]);

  const toggleCountry = async (code: string) => {
    if (expanded === code) {
      setExpanded(null);
      return;
    }
    setExpanded(code);
    if (regions[code]) return; // cache
    setRegionLoading(code);
    try {
      const { data, error: fnErr } = await supabaseClient.functions.invoke(
        "helm-geo-breakdown",
        { body: { project_id: scope, days, country: code } },
      );
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setRegions((r) => ({ ...r, [code]: (data?.rows as RegionRow[]) ?? [] }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRegionLoading(null);
    }
  };

  if (isAll) {
    return null; // proje seçilince görünür (PostHog proje-bağımlı)
  }
  if (!phConnected) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="size-4" />
          Coğrafi Dağılım - son {days} gün
          <span className="text-xs font-normal text-muted-foreground">
            PostHog · IP tabanlı · izinsiz
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Yükleniyor…
          </div>
        ) : countries.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            PostHog'tan coğrafi veri gelmedi. Event'lerde{" "}
            <code>$geoip_country_code</code> property'si olmalı (autocapture
            varsayılan).
          </div>
        ) : (
          <div className="space-y-1">
            <div className="grid grid-cols-[24px_1fr_80px_60px] gap-2 px-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              <span />
              <span>Ülke</span>
              <span className="text-right">Kullanıcı</span>
              <span className="text-right">Pay</span>
            </div>
            {countries.slice(0, 30).map((c) => {
              const pct = total > 0 ? (c.users / total) * 100 : 0;
              const isOpen = expanded === c.country;
              const sub = regions[c.country];
              return (
                <div key={c.country}>
                  <button
                    type="button"
                    onClick={() => toggleCountry(c.country)}
                    className="grid w-full grid-cols-[24px_1fr_80px_60px] items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    {isOpen ? (
                      <ChevronDown className="size-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-3.5 text-muted-foreground" />
                    )}
                    <span className="flex items-center gap-2 truncate">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {c.country}
                      </span>
                      <span className="truncate font-medium">
                        {c.country_name ?? c.country}
                      </span>
                    </span>
                    <span className="text-right text-sm tabular-nums">
                      {compact(c.users)}
                    </span>
                    <span className="text-right text-xs tabular-nums text-muted-foreground">
                      %{pct.toFixed(1)}
                    </span>
                  </button>

                  {/* Drill-down: eyalet + şehir */}
                  {isOpen && (
                    <div className="ml-6 mb-2 mt-1 rounded-md border bg-muted p-2">
                      {regionLoading === c.country ? (
                        <div className="py-2 text-center text-xs text-muted-foreground">
                          Yükleniyor…
                        </div>
                      ) : !sub || sub.length === 0 ? (
                        <div className="py-2 text-center text-xs text-muted-foreground">
                          Bu ülke için eyalet/şehir verisi yok
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="grid grid-cols-[1fr_1fr_70px] gap-2 px-1 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                            <span>Eyalet</span>
                            <span>Şehir</span>
                            <span className="text-right">Kullanıcı</span>
                          </div>
                          {sub.slice(0, 20).map((r, i) => (
                            <div
                              key={i}
                              className="grid grid-cols-[1fr_1fr_70px] gap-2 px-1 py-0.5 text-xs"
                            >
                              <span className="truncate font-medium">
                                {r.region}
                              </span>
                              <span className="truncate text-muted-foreground">
                                {r.city}
                              </span>
                              <span className="text-right tabular-nums">
                                {compact(r.users)}
                              </span>
                            </div>
                          ))}
                          {sub.length > 20 && (
                            <div className="px-1 pt-1 text-center text-[10px] text-muted-foreground">
                              +{sub.length - 20} satır daha
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {countries.length > 30 && (
              <p className="pt-2 text-center text-xs text-muted-foreground">
                +{countries.length - 30} ülke daha
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/* ───────────────────────── Acquisition Source Card ───────────────────────── */

interface AcqRow {
  source: string;
  type: string;
  users: number;
}

interface UtmSourceRow {
  source: string;
  users: number;
}
interface UtmCampaignRow {
  campaign: string;
  source: string | null;
  medium: string | null;
  users: number;
}
interface UtmBreakdown {
  sources: UtmSourceRow[];
  campaigns: UtmCampaignRow[];
  total: number;
}

// Organik-only uygulamalarda edge function bunu döner; kart boş durumu gösterir.
const EMPTY_UTM: UtmBreakdown = { sources: [], campaigns: [], total: 0 };

const TYPE_LABELS: Record<string, string> = {
  direct: "Doğrudan",
  search: "Arama",
  social: "Sosyal",
  store: "Mağaza",
  referral: "Referans",
};

const TYPE_COLORS: Record<string, string> = {
  direct: "bg-muted text-foreground",
  search: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  social: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  store: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  referral: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

// Veri çekimi tek yerde: aynı edge function yanıtı hem referrer hem UTM
// kartını besliyor, ikinci bir istek atmıyoruz.
const AcquisitionSection = ({
  scope,
  isAll,
  days,
}: {
  scope: string;
  isAll: boolean;
  days: number;
}) => {
  const [rows, setRows] = useState<AcqRow[]>([]);
  const [total, setTotal] = useState(0);
  const [utm, setUtm] = useState<UtmBreakdown>(EMPTY_UTM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { result: integResult } = useList<ProjectIntegration>({
    resource: "project_integrations",
    filters: isAll
      ? []
      : [{ field: "project_id", operator: "eq", value: scope }],
    pagination: { mode: "off" },
  });
  const phConnected = integResult.data.some(
    (i) => i.provider === "posthog" && i.enabled,
  );

  useEffect(() => {
    if (isAll || !phConnected) {
      setRows([]);
      setUtm(EMPTY_UTM);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabaseClient.functions
      .invoke("helm-acquisition", { body: { project_id: scope, days } })
      .then(({ data, error: fnErr }) => {
        if (cancelled) return;
        if (fnErr) throw fnErr;
        if (data?.error) throw new Error(data.error);
        setRows((data?.rows as AcqRow[]) ?? []);
        setTotal(data?.total ?? 0);
        // utm alanı eski deploy'larda yok - eksikse boş kırılım kullanılır.
        setUtm((data?.utm as UtmBreakdown | undefined) ?? EMPTY_UTM);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, isAll, days, phConnected]);

  if (isAll || !phConnected) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <AcquisitionCard
        days={days}
        rows={rows}
        total={total}
        loading={loading}
        error={error}
      />
      <UtmCard days={days} utm={utm} loading={loading} error={error} />
    </div>
  );
};

const AcquisitionCard = ({
  days,
  rows,
  total,
  loading,
  error,
}: {
  days: number;
  rows: AcqRow[];
  total: number;
  loading: boolean;
  error: string | null;
}) => {
  // Tip bazlı topla
  const byType = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      map.set(r.type, (map.get(r.type) ?? 0) + r.users);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4" />
          Edinme Kaynakları - son {days} gün
          <span className="text-xs font-normal text-muted-foreground">
            PostHog · $initial_referrer
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Yükleniyor…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            PostHog'tan referrer verisi yok. Event'lerde{" "}
            <code>$initial_referrer</code> property'si olmalı.
          </div>
        ) : (
          <>
            {/* Tip bazlı özet - yatay bar */}
            <div className="space-y-1">
              <div className="flex h-3 overflow-hidden rounded-full">
                {byType.map(([type, users]) => {
                  const pct = (users / total) * 100;
                  return (
                    <div
                      key={type}
                      className={cn(
                        "flex items-center justify-center",
                        TYPE_COLORS[type] ?? "bg-muted",
                      )}
                      style={{ width: `${pct}%` }}
                      title={`${TYPE_LABELS[type] ?? type}: ${users}`}
                    />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2 text-[10px]">
                {byType.map(([type, users]) => (
                  <span
                    key={type}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 tabular-nums",
                      TYPE_COLORS[type] ?? "bg-muted",
                    )}
                  >
                    {TYPE_LABELS[type] ?? type} {users}
                  </span>
                ))}
              </div>
            </div>

            {/* Top 20 referrer */}
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_80px_60px] gap-2 px-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <span>Kaynak</span>
                <span className="text-right">Kullanıcı</span>
                <span className="text-right">Pay</span>
              </div>
              {rows.slice(0, 20).map((r) => {
                const pct = (r.users / total) * 100;
                return (
                  <div
                    key={r.source}
                    className="grid grid-cols-[1fr_80px_60px] items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px]",
                          TYPE_COLORS[r.type] ?? "bg-muted",
                        )}
                      >
                        {TYPE_LABELS[r.type] ?? r.type}
                      </span>
                      <span className="truncate font-medium">{r.source}</span>
                    </div>
                    <span className="text-right text-sm tabular-nums">
                      {compact(r.users)}
                    </span>
                    <span className="text-right text-xs tabular-nums text-muted-foreground">
                      %{pct.toFixed(1)}
                    </span>
                  </div>
                );
              })}
              {rows.length > 20 && (
                <p className="pt-1 text-center text-[10px] text-muted-foreground">
                  +{rows.length - 20} kaynak daha
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

/* ───────────────────────── UTM Campaign Card ───────────────────────── */

const UTM_TOP_CAMPAIGNS = 10;
const UTM_TOP_SOURCES = 8;

// Kampanya satırının altındaki "google · cpc" etiketi. İkisi de yoksa satır
// altına boş bir satır bırakmamak için null döner.
const utmContext = (row: UtmCampaignRow): string | null => {
  const parts = [row.source, row.medium].filter(
    (p): p is string => p !== null && p.length > 0,
  );
  return parts.length > 0 ? parts.join(" · ") : null;
};

const UtmCard = ({
  days,
  utm,
  loading,
  error,
}: {
  days: number;
  utm: UtmBreakdown;
  loading: boolean;
  error: string | null;
}) => {
  const share = (users: number) =>
    utm.total > 0 ? (users / utm.total) * 100 : 0;
  const isEmpty = utm.campaigns.length === 0 && utm.sources.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="size-4" />
          Kampanya Atıfı - son {days} gün
          <span className="text-xs font-normal text-muted-foreground">
            PostHog · $initial_utm_*
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Yükleniyor…
          </div>
        ) : isEmpty ? (
          // Organik-only uygulamada normal durum - kırık kart yerine ne
          // yapılması gerektiğini anlatıyoruz.
          <div className="space-y-2 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              UTM etiketli trafik bulunamadı.
            </p>
            <p className="text-xs text-muted-foreground">
              Reklam ve kampanya linklerine{" "}
              <code>?utm_source=google&amp;utm_medium=cpc&amp;utm_campaign=…</code>{" "}
              eklersen kampanya kırılımı burada görünür.
            </p>
          </div>
        ) : (
          <>
            {/* Kampanyalar */}
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_80px_60px] gap-2 px-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <span>Kampanya</span>
                <span className="text-right">Kullanıcı</span>
                <span className="text-right">Pay</span>
              </div>
              {utm.campaigns.length === 0 ? (
                <p className="px-2 py-2 text-xs text-muted-foreground">
                  Kampanya etiketi (<code>utm_campaign</code>) olan trafik yok.
                </p>
              ) : (
                utm.campaigns.slice(0, UTM_TOP_CAMPAIGNS).map((c) => {
                  const context = utmContext(c);
                  return (
                    <div
                      key={c.campaign}
                      className="grid grid-cols-[1fr_80px_60px] items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{c.campaign}</div>
                        {context && (
                          <div className="truncate text-[10px] text-muted-foreground">
                            {context}
                          </div>
                        )}
                      </div>
                      <span className="text-right text-sm tabular-nums">
                        {compact(c.users)}
                      </span>
                      <span className="text-right text-xs tabular-nums text-muted-foreground">
                        %{share(c.users).toFixed(1)}
                      </span>
                    </div>
                  );
                })
              )}
              {utm.campaigns.length > UTM_TOP_CAMPAIGNS && (
                <p className="pt-1 text-center text-[10px] text-muted-foreground">
                  +{utm.campaigns.length - UTM_TOP_CAMPAIGNS} kampanya daha
                </p>
              )}
            </div>

            {/* UTM source'ları */}
            <div className="space-y-1 border-t border-border pt-3">
              <div className="grid grid-cols-[1fr_80px_60px] gap-2 px-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <span>UTM source</span>
                <span className="text-right">Kullanıcı</span>
                <span className="text-right">Pay</span>
              </div>
              {utm.sources.length === 0 ? (
                <p className="px-2 py-2 text-xs text-muted-foreground">
                  <code>utm_source</code> etiketi olan trafik yok.
                </p>
              ) : (
                utm.sources.slice(0, UTM_TOP_SOURCES).map((s) => (
                  <div
                    key={s.source}
                    className="grid grid-cols-[1fr_80px_60px] items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <span className="truncate font-medium">{s.source}</span>
                    <span className="text-right text-sm tabular-nums">
                      {compact(s.users)}
                    </span>
                    <span className="text-right text-xs tabular-nums text-muted-foreground">
                      %{share(s.users).toFixed(1)}
                    </span>
                  </div>
                ))
              )}
              {utm.sources.length > UTM_TOP_SOURCES && (
                <p className="pt-1 text-center text-[10px] text-muted-foreground">
                  +{utm.sources.length - UTM_TOP_SOURCES} source daha
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
