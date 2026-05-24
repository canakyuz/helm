import { useMemo, useState } from "react";
import { type CrudFilter, useList } from "@refinedev/core";
import { CalendarDays, Globe, Sparkles, UserPlus, Users } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

  const filters: CrudFilter[] = [
    { field: "date", operator: "gte", value: since },
  ];
  if (!isAll) {
    filters.push({ field: "project_id", operator: "eq", value: scope });
  }
  const { result, query } = useList<Metric>({
    resource: "metrics",
    filters,
    pagination: { mode: "off" },
  });
  const metrics = result.data;
  const loading = query.isLoading;

  // Ülke kırılımı
  const [geoMetric, setGeoMetric] = useState<string>("app_downloads");
  const { result: countryResult } = useList<MetricCountry>({
    resource: "metrics_country",
    filters: [
      ...filters,
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

  // Harita marker'ları — koordinatlı ülkeler
  const geoMarkers = useMemo(() => {
    return byCountry
      .map(([code, value]) => {
        const info = getCountryGeo(code);
        if (!info) return null;
        // Marker yarıçapı sıklığa göre — radius 6-22 arası
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
          title="Yapışkanlık (DAU/MAU)"
          value={`%${stickiness.toFixed(0)}`}
          icon={<Sparkles />}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{`Günlük Aktif Kullanıcı — son ${range} gün`}</CardTitle>
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
            <CardTitle>{`Yeni Kullanıcı — son ${range} gün`}</CardTitle>
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
          <CardTitle>{`Toplam Kullanıcı Büyümesi — son ${range} gün`}</CardTitle>
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

      {/* Ülke kırılımı — metrics_country tablosundan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="size-4" />
            Ülke Kırılımı — son {range} gün
          </CardTitle>
          <CardAction>
            <Select value={geoMetric} onValueChange={setGeoMetric}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="app_downloads">İndirmeler</SelectItem>
                <SelectItem value="app_revenue">Mağaza Geliri</SelectItem>
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>
        <CardContent>
          {byCountry.length === 0 ? (
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
                        <TableCell className="text-right font-mono tabular-nums">
                          {compact(value)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-xs text-muted-foreground">
                          {grandTotal > 0
                            ? `${((value / grandTotal) * 100).toFixed(1)}%`
                            : "—"}
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
