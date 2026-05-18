import { useMemo, useState } from "react";
import { useInvalidate, useList } from "@refinedev/core";
import { DollarSign, RefreshCw, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { supabaseClient } from "@/providers/supabase-client";
import { useHelmTheme } from "@/theme/ThemeProvider";
import { compact, deltaPct, latest, series, usd } from "@/lib/metrics";
import type { Metric, Project, SyncRun } from "@/types";

/** Bir metrik için her projenin en güncel tarihli değerini döndürür. */
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

interface ProjectRow {
  id: string;
  name: string;
  mrr: number;
  adRevenue: number;
  dau: number;
  totalUsers: number;
}

export const DashboardPage = () => {
  const [syncing, setSyncing] = useState(false);
  const [range, setRange] = useState(90);
  const invalidate = useInvalidate();
  const { theme } = useHelmTheme();

  const since = useMemo(
    () =>
      new Date(Date.now() - range * 86_400_000).toISOString().slice(0, 10),
    [range],
  );

  const { result: projectsResult, query: projectsQuery } = useList<Project>({
    resource: "projects",
    pagination: { mode: "off" },
  });

  const { result: metricsResult, query: metricsQuery } = useList<Metric>({
    resource: "metrics",
    filters: [{ field: "date", operator: "gte", value: since }],
    pagination: { mode: "off" },
  });

  const { result: syncResult } = useList<SyncRun>({
    resource: "sync_runs",
    sorters: [{ field: "started_at", order: "desc" }],
    pagination: { mode: "off" },
  });

  const projects = projectsResult.data;
  const metrics = metricsResult.data;
  const syncRuns = syncResult.data;
  const loading = projectsQuery.isLoading || metricsQuery.isLoading;

  const adRevenueSeries = useMemo(
    () => series(metrics, "ad_revenue"),
    [metrics],
  );
  const dauSeries = useMemo(() => series(metrics, "dau"), [metrics]);

  const rows: ProjectRow[] = useMemo(() => {
    const mrr = latestByProject(metrics, "mrr");
    const adRevenue = latestByProject(metrics, "ad_revenue");
    const dau = latestByProject(metrics, "dau");
    const totalUsers = latestByProject(metrics, "total_users");
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      mrr: mrr.get(p.id)?.value ?? 0,
      adRevenue: adRevenue.get(p.id)?.value ?? 0,
      dau: dau.get(p.id)?.value ?? 0,
      totalUsers: totalUsers.get(p.id)?.value ?? 0,
    }));
  }, [metrics, projects]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke(
        "helm-ingest",
        { body: { trigger: "manual" } },
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Cockpit</h1>
        <div className="flex items-center gap-2">
          <RangeSelect value={range} onChange={setRange} />
          <Button onClick={handleSync} disabled={syncing}>
            <RefreshCw
              className={syncing ? "size-4 animate-spin" : "size-4"}
            />
            Şimdi senkronize et
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Toplam MRR"
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
          title="Toplam DAU"
          value={compact(latest(metrics, "dau"))}
          icon={<Users />}
          delta={deltaPct(dauSeries)}
          loading={loading}
        />
        <StatCard
          title="Aktif Abone"
          value={compact(latest(metrics, "active_subs"))}
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

      <Card>
        <CardHeader>
          <CardTitle>Proje Kırılımı</CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 && !loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Henüz proje eklenmedi
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proje</TableHead>
                  <TableHead>MRR</TableHead>
                  <TableHead>Reklam Geliri</TableHead>
                  <TableHead>DAU</TableHead>
                  <TableHead>Toplam Kullanıcı</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{usd(r.mrr)}</TableCell>
                    <TableCell>{usd(r.adRevenue)}</TableCell>
                    <TableCell>{compact(r.dau)}</TableCell>
                    <TableCell>{compact(r.totalUsers)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Son Senkronlar</CardTitle>
        </CardHeader>
        <CardContent>
          {syncRuns.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Henüz senkron çalışmadı
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zaman</TableHead>
                  <TableHead>Tetikleyici</TableHead>
                  <TableHead>Metrik</TableHead>
                  <TableHead>Sonuç</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncRuns.slice(0, 8).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {new Date(r.started_at).toLocaleString("tr-TR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {r.trigger === "cron" ? "otomatik" : "manuel"}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.ingested}</TableCell>
                    <TableCell>
                      {r.error_count > 0 ? (
                        <Badge variant="destructive">
                          {r.error_count} hata
                        </Badge>
                      ) : (
                        <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-500">
                          {r.ok_count} ok
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
