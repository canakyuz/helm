import { useMemo, useState } from "react";
import { useInvalidate, useList, useShow } from "@refinedev/core";
import {
  BarChart3,
  Boxes,
  DollarSign,
  RefreshCw,
  Users,
  UserPlus,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { IntegrationsPanel } from "@/components/integrations-panel";
import { StatCard } from "@/components/stat-card";
import { TrendChart } from "@/components/trend-chart";
import { supabaseClient } from "@/providers/supabase-client";
import { useHelmTheme } from "@/theme/ThemeProvider";
import { compact, deltaPct, latest, series, usd } from "@/lib/metrics";
import type { Metric, Project } from "@/types";

export const ProjectShow = () => {
  const { query } = useShow<Project>();
  const record = query.data?.data;
  const { theme } = useHelmTheme();
  const invalidate = useInvalidate();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    if (!record?.id) return;
    setSyncing(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke(
        "helm-ingest",
        { body: { trigger: "manual", project_id: record.id } },
      );
      if (error) throw error;
      toast.success("Senkronizasyon tamam", {
        description: `${data?.ingested ?? 0} metrik güncellendi.`,
      });
      invalidate({ resource: "metrics", invalidates: ["list"] });
      invalidate({ resource: "project_integrations", invalidates: ["list"] });
    } catch (e) {
      toast.error("Senkronizasyon başarısız", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSyncing(false);
    }
  };

  const since = useMemo(
    () => new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10),
    [],
  );

  const { result: metricsResult, query: metricsQuery } = useList<Metric>({
    resource: "metrics",
    filters: [
      { field: "project_id", operator: "eq", value: record?.id },
      { field: "date", operator: "gte", value: since },
    ],
    pagination: { mode: "off" },
    queryOptions: { enabled: !!record?.id },
  });

  const metrics = metricsResult.data;
  const loading = query.isLoading || metricsQuery.isLoading;

  const adRevenueSeries = useMemo(
    () => series(metrics, "ad_revenue"),
    [metrics],
  );
  const dauSeries = useMemo(() => series(metrics, "dau"), [metrics]);
  const usersSeries = useMemo(
    () => series(metrics, "total_users"),
    [metrics],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {record?.name ?? "Proje"}
        </h1>
        <Button onClick={handleSync} disabled={syncing}>
          <RefreshCw className={syncing ? "size-4 animate-spin" : "size-4"} />
          Senkronla
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="size-4" /> Genel Bakış
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Boxes className="size-4" /> Entegrasyonlar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="MRR"
              value={usd(latest(metrics, "mrr"))}
              icon={<DollarSign />}
              loading={loading}
            />
            <StatCard
              title="Reklam Geliri (son gün)"
              value={usd(latest(metrics, "ad_revenue"))}
              icon={<Wallet />}
              delta={deltaPct(adRevenueSeries)}
              loading={loading}
            />
            <StatCard
              title="DAU"
              value={compact(latest(metrics, "dau"))}
              icon={<Users />}
              delta={deltaPct(dauSeries)}
              loading={loading}
            />
            <StatCard
              title="Toplam Kullanıcı"
              value={compact(latest(metrics, "total_users"))}
              icon={<UserPlus />}
              delta={deltaPct(usersSeries)}
              loading={loading}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Reklam Geliri — son 90 gün</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart
                  data={adRevenueSeries}
                  color={theme.chart.revenue}
                  format={usd}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Günlük Aktif Kullanıcı — son 90 gün</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart
                  data={dauSeries}
                  color={theme.chart.users}
                  format={compact}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Kullanıcı Büyümesi — son 90 gün</CardTitle>
            </CardHeader>
            <CardContent>
              <TrendChart
                data={usersSeries}
                color={theme.chart.revenue}
                format={compact}
                height={200}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          {record?.id && <IntegrationsPanel projectId={record.id} />}
        </TabsContent>
      </Tabs>
    </div>
  );
};
