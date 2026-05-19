import { useMemo, useState } from "react";
import {
  type CrudFilter,
  useInvalidate,
  useList,
  useNavigation,
} from "@refinedev/core";
import {
  CalendarDays,
  DollarSign,
  Eye,
  Gauge,
  Pencil,
  RefreshCw,
  Users,
  UserPlus,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RangeSelect } from "@/components/range-select";
import { StatCard } from "@/components/stat-card";
import { TrendChart } from "@/components/trend-chart";
import { supabaseClient } from "@/providers/supabase-client";
import { useScope } from "@/context/scope";
import { useHelmTheme } from "@/theme/ThemeProvider";
import { compact, deltaPct, latest, series, usd, usd2 } from "@/lib/metrics";
import type { Metric, Project } from "@/types";

/** Bir metrik için her projenin en güncel tarihli değeri. */
const latestByProject = (metrics: Metric[], metricName: string) => {
  const map = new Map<string, { value: number; date: string }>();
  for (const m of metrics) {
    if (m.metric !== metricName) continue;
    const current = map.get(m.project_id);
    if (!current || m.date > current.date) {
      map.set(m.project_id, { value: Number(m.value), date: m.date });
    }
  }
  return map;
};

export const DashboardPage = () => {
  const { scope, setScope, isAll } = useScope();
  const { theme } = useHelmTheme();
  const { edit } = useNavigation();
  const invalidate = useInvalidate();
  const [range, setRange] = useState(90);
  const [syncing, setSyncing] = useState(false);

  const since = useMemo(
    () =>
      new Date(Date.now() - range * 86_400_000).toISOString().slice(0, 10),
    [range],
  );

  const { result: projectsResult } = useList<Project>({
    resource: "projects",
    pagination: { mode: "off" },
  });
  const projects = projectsResult.data;

  const metricFilters: CrudFilter[] = [
    { field: "date", operator: "gte", value: since },
  ];
  if (!isAll) {
    metricFilters.push({ field: "project_id", operator: "eq", value: scope });
  }
  const { result: metricsResult, query: metricsQuery } = useList<Metric>({
    resource: "metrics",
    filters: metricFilters,
    pagination: { mode: "off" },
  });
  const metrics = metricsResult.data;
  const loading = metricsQuery.isLoading;

  const activeProject = isAll
    ? null
    : projects.find((p) => p.id === scope);

  const adRevenueSeries = useMemo(
    () => series(metrics, "ad_revenue"),
    [metrics],
  );
  const dauSeries = useMemo(() => series(metrics, "dau"), [metrics]);
  const usersSeries = useMemo(
    () => series(metrics, "total_users"),
    [metrics],
  );

  const handleSync = async () => {
    setSyncing(true);
    try {
      const body = isAll
        ? { trigger: "manual" }
        : { trigger: "manual", project_id: scope };
      const { data, error } = await supabaseClient.functions.invoke(
        "helm-ingest",
        { body },
      );
      if (error) throw error;
      toast.success("Senkronizasyon tamam", {
        description: `${data?.ingested ?? 0} metrik güncellendi.`,
      });
      invalidate({ resource: "metrics", invalidates: ["list"] });
      invalidate({ resource: "sync_runs", invalidates: ["list"] });
    } catch (e) {
      toast.error("Senkronizasyon başarısız", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isAll ? "Cockpit" : (activeProject?.name ?? "Proje")}
        </h1>
        <div className="flex items-center gap-2">
          <RangeSelect value={range} onChange={setRange} />
          {!isAll && activeProject && (
            <Button
              variant="outline"
              onClick={() => edit("projects", scope)}
            >
              <Pencil className="size-4" /> Düzenle
            </Button>
          )}
          <Button onClick={handleSync} disabled={syncing}>
            <RefreshCw
              className={syncing ? "size-4 animate-spin" : "size-4"}
            />
            Senkronize et
          </Button>
        </div>
      </div>

      {/* İstatistik kartları */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={isAll ? "Toplam MRR" : "MRR"}
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
          title={isAll ? "Toplam DAU" : "DAU"}
          value={compact(latest(metrics, "dau"))}
          icon={<Users />}
          delta={deltaPct(dauSeries)}
          loading={loading}
        />
        {isAll ? (
          <StatCard
            title="Aktif Abone"
            value={compact(latest(metrics, "active_subs"))}
            loading={loading}
          />
        ) : (
          <StatCard
            title="Toplam Kullanıcı"
            value={compact(latest(metrics, "total_users"))}
            icon={<UserPlus />}
            delta={deltaPct(usersSeries)}
            loading={loading}
          />
        )}
      </div>

      {/* Projeye özel ek kartlar */}
      {!isAll && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Reklam Gösterimi (son gün)"
            value={compact(latest(metrics, "ad_impressions"))}
            icon={<Eye />}
            delta={deltaPct(series(metrics, "ad_impressions"))}
            loading={loading}
          />
          <StatCard
            title="eCPM"
            value={usd2(latest(metrics, "ad_ecpm"))}
            icon={<Gauge />}
            loading={loading}
          />
          <StatCard
            title="WAU"
            value={compact(latest(metrics, "wau"))}
            icon={<CalendarDays />}
            loading={loading}
          />
        </div>
      )}

      {/* Grafikler */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{`Reklam Geliri — son ${range} gün`}</CardTitle>
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
      </div>

      {/* Tüm Projeler: proje kartları ızgarası */}
      {isAll && (
        <Card>
          <CardHeader>
            <CardTitle>Projeler</CardTitle>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Henüz proje yok — sidebar'dan "Proje ekle".
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((p) => {
                  const mrr = latestByProject(metrics, "mrr");
                  const ad = latestByProject(metrics, "ad_revenue");
                  const dau = latestByProject(metrics, "dau");
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => setScope(p.id as string)}
                      className="rounded-lg border bg-card p-4 text-left ring-1 ring-foreground/5 transition-colors hover:ring-foreground/20"
                    >
                      <div className="font-medium">{p.name}</div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div>
                          <div className="text-xs text-muted-foreground">
                            MRR
                          </div>
                          <div className="text-sm font-medium">
                            {usd(mrr.get(p.id as string)?.value ?? 0)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">
                            Reklam
                          </div>
                          <div className="text-sm font-medium">
                            {usd(ad.get(p.id as string)?.value ?? 0)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">
                            DAU
                          </div>
                          <div className="text-sm font-medium">
                            {compact(dau.get(p.id as string)?.value ?? 0)}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
