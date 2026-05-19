import { useMemo, useState } from "react";
import { type CrudFilter, useList } from "@refinedev/core";
import { CalendarDays, Sparkles, UserPlus, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RangeSelect } from "@/components/range-select";
import { StatCard } from "@/components/stat-card";
import { TrendChart } from "@/components/trend-chart";
import { useScope } from "@/context/scope";
import { useHelmTheme } from "@/theme/ThemeProvider";
import { compact, deltaPct, latest, series } from "@/lib/metrics";
import type { Metric } from "@/types";

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
    </div>
  );
};
