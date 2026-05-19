import { useMemo, useState } from "react";
import { type CrudFilter, useList } from "@refinedev/core";
import { DollarSign, Eye, Gauge, Users, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { RangeSelect } from "@/components/range-select";
import { StatCard } from "@/components/stat-card";
import { TrendChart } from "@/components/trend-chart";
import { useScope } from "@/context/scope";
import { useHelmTheme } from "@/theme/ThemeProvider";
import { compact, deltaPct, latest, series, usd, usd2 } from "@/lib/metrics";
import type { Metric } from "@/types";

export const RevenuePage = () => {
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

  const mrrSeries = useMemo(() => series(metrics, "mrr"), [metrics]);
  const adSeries = useMemo(() => series(metrics, "ad_revenue"), [metrics]);
  const impSeries = useMemo(
    () => series(metrics, "ad_impressions"),
    [metrics],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Gelir & Reklam
        </h1>
        <RangeSelect value={range} onChange={setRange} />
      </div>

      <Tabs defaultValue="subscription" className="space-y-4">
        <TabsList>
          <TabsTrigger value="subscription">
            <DollarSign className="size-4" /> Abonelik
          </TabsTrigger>
          <TabsTrigger value="ads">
            <Wallet className="size-4" /> Reklam
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subscription" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              title="MRR"
              value={usd(latest(metrics, "mrr"))}
              icon={<DollarSign />}
              loading={loading}
            />
            <StatCard
              title="Aktif Abone"
              value={compact(latest(metrics, "active_subs"))}
              icon={<Users />}
              loading={loading}
            />
            <StatCard
              title="Gelir (28 gün)"
              value={usd(latest(metrics, "revenue_28d"))}
              icon={<Wallet />}
              loading={loading}
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{`MRR — son ${range} gün`}</CardTitle>
            </CardHeader>
            <CardContent>
              <TrendChart
                data={mrrSeries}
                color={theme.chart.revenue}
                format={usd}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ads" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              title="Reklam Geliri (son gün)"
              value={usd(latest(metrics, "ad_revenue"))}
              icon={<Wallet />}
              delta={deltaPct(adSeries)}
              loading={loading}
            />
            <StatCard
              title="Gösterim (son gün)"
              value={compact(latest(metrics, "ad_impressions"))}
              icon={<Eye />}
              delta={deltaPct(impSeries)}
              loading={loading}
            />
            <StatCard
              title="eCPM"
              value={usd2(latest(metrics, "ad_ecpm"))}
              icon={<Gauge />}
              loading={loading}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{`Reklam Geliri — son ${range} gün`}</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart
                  data={adSeries}
                  color={theme.chart.revenue}
                  format={usd}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{`Gösterim — son ${range} gün`}</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart
                  data={impSeries}
                  color={theme.chart.users}
                  format={compact}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
