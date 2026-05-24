import { lazy, Suspense, useMemo, useState } from "react";
import {
  type CrudFilter,
  useInvalidate,
  useList,
  useNavigation,
} from "@refinedev/core";
import { Link } from "react-router";
import {
  Activity,
  AlertOctagon,
  Bell,
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
// Leaflet ağır (~150KB gzip); ayrı chunk'a koy, ilk dashboard renderı bloklamasın.
const UsersGeoMap = lazy(() =>
  import("@/components/users-geo-map").then((m) => ({
    default: m.UsersGeoMap,
  })),
);
import { supabaseClient } from "@/providers/supabase-client";
import { useScope } from "@/context/scope";
import { useDisplayCurrency } from "@/context/currency";
import { useHelmTheme } from "@/theme/ThemeProvider";
import { cn } from "@/lib/utils";
import { useFxRates } from "@/lib/fx";
import {
  compact,
  deltaPct,
  formatMoney,
  formatMoney2,
  latest,
  moneyRanges,
  series,
  sumInRange,
  valueOnDate,
} from "@/lib/metrics";
import type {
  AlertEvent,
  Metric,
  Project,
  ProjectIntegration,
  SyncRun,
} from "@/types";

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

const timeAgo = (iso: string | null) => {
  if (!iso) return "hiç";
  const min = (Date.now() - new Date(iso).getTime()) / 60_000;
  if (min < 1) return "az önce";
  if (min < 60) return `${Math.round(min)} dk önce`;
  if (min < 1440) return `${Math.round(min / 60)} sa önce`;
  return `${Math.round(min / 1440)} gün önce`;
};

/** Bir projenin connector sağlığı: ok / error / pending. */
const projectHealth = (integrations: ProjectIntegration[]) => {
  if (integrations.length === 0) return "pending";
  if (integrations.some((i) => i.last_sync_status === "error")) return "error";
  if (integrations.every((i) => i.last_sync_status === "ok")) return "ok";
  return "pending";
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

  // Sağlık şeridi verileri.
  const integFilters: CrudFilter[] = [];
  if (!isAll) {
    integFilters.push({ field: "project_id", operator: "eq", value: scope });
  }
  const { result: integResult } = useList<ProjectIntegration>({
    resource: "project_integrations",
    filters: integFilters,
    pagination: { mode: "off" },
  });
  const integrations = integResult.data;

  const { result: runsResult } = useList<SyncRun>({
    resource: "sync_runs",
    sorters: [{ field: "started_at", order: "desc" }],
    pagination: { mode: "off" },
  });
  const lastRun = runsResult.data[0];
  const syncStale =
    !lastRun?.started_at ||
    Date.now() - new Date(lastRun.started_at).getTime() > 36 * 3_600_000;

  const since48h = useMemo(
    () => new Date(Date.now() - 48 * 3_600_000).toISOString(),
    [],
  );
  const { result: alertsResult } = useList<AlertEvent>({
    resource: "alert_events",
    filters: [
      { field: "triggered_at", operator: "gte", value: since48h },
    ],
    pagination: { mode: "off" },
  });
  const openAlerts = alertsResult.data.length;

  const okCount = integrations.filter(
    (i) => i.last_sync_status === "ok",
  ).length;
  const errCount = integrations.filter(
    (i) => i.last_sync_status === "error",
  ).length;

  const activeProject = isAll
    ? null
    : projects.find((p) => p.id === scope);

  // AdMob raporlama para birimi — entegrasyon config'inden okunur.
  const adCurrency = useMemo(() => {
    const admobs = integrations.filter((i) => i.provider === "admob");
    if (!isAll) {
      const cfg = admobs.find((i) => i.project_id === scope)?.config as
        | { currency?: string }
        | undefined;
      return cfg?.currency || "USD";
    }
    const codes = new Set(
      admobs.map(
        (i) => ((i.config as { currency?: string })?.currency) || "USD",
      ),
    );
    return codes.size === 1 ? [...codes][0] : "USD";
  }, [integrations, scope, isAll]);

  const projAdCurrency = (pid: string) => {
    const cfg = integrations.find(
      (i) => i.project_id === pid && i.provider === "admob",
    )?.config as { currency?: string } | undefined;
    return cfg?.currency || "USD";
  };

  // Ekran para birimi — Ayarlar'dan. Tüm para değerleri buna çevrilir.
  const { currency: displayCcy } = useDisplayCurrency();
  const sourceCurrencies = useMemo(() => {
    const set = new Set<string>(["USD"]); // MRR/RevenueCat default
    for (const i of integrations) {
      if (i.provider === "admob") {
        const c = (i.config as { currency?: string })?.currency || "USD";
        set.add(c);
      }
    }
    return Array.from(set);
  }, [integrations]);
  const fxRates = useFxRates(sourceCurrencies, displayCcy);
  const rateOf = (ccy: string) => fxRates[ccy] ?? 1;

  // Para birimi-duyarlı toplam ad_revenue (her projeyi kendi kaynak ccy'sinden
  // çevirip topla).
  const adRevenueDisplay = useMemo(() => {
    if (!isAll) {
      return latest(metrics, "ad_revenue") * rateOf(adCurrency);
    }
    let total = 0;
    for (const [pid, { value }] of latestByProject(metrics, "ad_revenue")) {
      total += value * rateOf(projAdCurrency(pid));
    }
    return total;
  }, [metrics, isAll, fxRates, adCurrency]);

  const adRevenueSeriesDisplay = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const m of metrics) {
      if (m.metric !== "ad_revenue") continue;
      const ccy = isAll ? projAdCurrency(m.project_id) : adCurrency;
      byDate.set(
        m.date,
        (byDate.get(m.date) ?? 0) + Number(m.value) * rateOf(ccy),
      );
    }
    return [...byDate.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, value]) => ({ date, value }));
  }, [metrics, isAll, fxRates, adCurrency]);

  const mrrDisplay = latest(metrics, "mrr") * rateOf("USD");

  const adRevenueSeries = useMemo(
    () => series(metrics, "ad_revenue"),
    [metrics],
  );
  const dauSeries = useMemo(() => series(metrics, "dau"), [metrics]);
  const errorSeries = useMemo(() => series(metrics, "errors"), [metrics]);
  const errorLatest = latest(metrics, "errors");
  const errorDelta = deltaPct(errorSeries);
  const hasSentry = integrations.some(
    (i) => i.provider === "sentry" && i.enabled,
  );
  const hasAppStore = integrations.some(
    (i) => i.provider === "app_store_connect" && i.enabled,
  );

  // App Store Connect proceeds currency (Revenue sayfasındaki aynı mantık).
  const appCurrency = useMemo(() => {
    const apps = integrations.filter(
      (i) => i.provider === "app_store_connect",
    );
    if (!isAll) {
      const cfg = apps.find((i) => i.project_id === scope)?.config as
        | { currency?: string }
        | undefined;
      return cfg?.currency || "USD";
    }
    const codes = new Set(
      apps.map(
        (i) => ((i.config as { currency?: string })?.currency) || "USD",
      ),
    );
    return codes.size === 1 ? [...codes][0] : "USD";
  }, [integrations, scope, isAll]);

  // AdMob konsoluna paralel: Bugün / Dün / Bu ay / Geçen ay toplam kazanç
  // (Reklam + Mağaza, display currency).
  const ranges = useMemo(() => moneyRanges(), []);
  const totalEarnings = useMemo(() => {
    const ar = rateOf(adCurrency);
    const apr = rateOf(appCurrency);
    const pick = (date: string) =>
      valueOnDate(metrics, "ad_revenue", date) * ar +
      valueOnDate(metrics, "app_revenue", date) * apr;
    const pickRange = (s: string, e: string) =>
      sumInRange(metrics, "ad_revenue", s, e) * ar +
      sumInRange(metrics, "app_revenue", s, e) * apr;
    return {
      today: pick(ranges.today),
      yesterday: pick(ranges.yesterday),
      thisMonth: pickRange(ranges.thisMonthStart, ranges.thisMonthEnd),
      prevMonth: pickRange(ranges.prevMonthStart, ranges.prevMonthEnd),
    };
  }, [metrics, ranges, fxRates, adCurrency, appCurrency]);

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
      invalidate({ resource: "project_integrations", invalidates: ["list"] });
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

      {/* Durum şeridi — 30 saniyelik sağlık bakışı */}
      <div
        className={cn(
          "grid grid-cols-1 gap-3 sm:grid-cols-3",
          hasSentry && "lg:grid-cols-4",
        )}
      >
        <Link
          to="/system"
          className={cn(
            "flex items-center gap-2 rounded-lg border bg-card p-3 text-sm ring-1 ring-foreground/5 transition-colors hover:ring-foreground/20",
            errCount > 0 && "text-destructive",
          )}
        >
          <Activity className="size-4" />
          <span>
            Kaynak sağlığı:{" "}
            <strong>
              {okCount}/{integrations.length}
            </strong>
            {errCount > 0 ? ` · ${errCount} hata` : ""}
          </span>
        </Link>
        <Link
          to="/system"
          className={cn(
            "flex items-center gap-2 rounded-lg border bg-card p-3 text-sm ring-1 ring-foreground/5 transition-colors hover:ring-foreground/20",
            syncStale && "text-destructive",
          )}
          title={
            syncStale
              ? "Gece cron'u çalışmıyor olabilir — Vault secret'larını kontrol et"
              : undefined
          }
        >
          <RefreshCw className="size-4" />
          <span>
            Son senkron: <strong>{timeAgo(lastRun?.started_at ?? null)}</strong>
            {syncStale ? " · cron?" : ""}
          </span>
        </Link>
        <Link
          to="/alerts"
          className={cn(
            "flex items-center gap-2 rounded-lg border bg-card p-3 text-sm ring-1 ring-foreground/5 transition-colors hover:ring-foreground/20",
            openAlerts > 0 && "text-destructive",
          )}
        >
          <Bell className="size-4" />
          <span>
            Açık uyarı (48s): <strong>{openAlerts}</strong>
          </span>
        </Link>
        {hasSentry && (
          <Link
            to="/system"
            className={cn(
              "flex items-center gap-2 rounded-lg border bg-card p-3 text-sm ring-1 ring-foreground/5 transition-colors hover:ring-foreground/20",
              errorLatest > 0 && "text-destructive",
            )}
          >
            <AlertOctagon className="size-4" />
            <span>
              Hatalar (son gün): <strong>{compact(errorLatest)}</strong>
              {errorDelta !== null && (
                <span className="ml-1 text-xs">
                  ({errorDelta > 0 ? "+" : ""}
                  {errorDelta.toFixed(0)}% / 7g)
                </span>
              )}
            </span>
          </Link>
        )}
      </div>

      {/* Toplam Tahmini Kazanç — AdMob konsoluna paralel detay */}
      <Card>
        <CardHeader>
          <CardTitle>
            Toplam Tahmini Kazanç
            {hasAppStore ? " (Reklam + Mağaza)" : " (Reklam)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Bugün şimdiye kadar
              </div>
              <div className="mt-1 font-mono text-3xl font-semibold tabular-nums">
                {formatMoney(totalEarnings.today, displayCcy)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Dün
              </div>
              <div className="mt-1 font-mono text-3xl font-semibold tabular-nums">
                {formatMoney(totalEarnings.yesterday, displayCcy)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Bu ay şimdiye kadar
              </div>
              <div className="mt-1 font-mono text-3xl font-semibold tabular-nums">
                {formatMoney(totalEarnings.thisMonth, displayCcy)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Geçen ay
              </div>
              <div className="mt-1 font-mono text-3xl font-semibold tabular-nums">
                {formatMoney(totalEarnings.prevMonth, displayCcy)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MarineX 12-col: solda 4 stat (2x2), sağda büyük harita */}
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="grid grid-cols-2 gap-4 xl:col-span-5 self-start">
          <StatCard
            title={isAll ? "Toplam MRR" : "MRR"}
            value={formatMoney(mrrDisplay, displayCcy)}
            icon={<DollarSign />}
            loading={loading}
          />
          <StatCard
            title="Reklam Geliri (son gün)"
            value={formatMoney(adRevenueDisplay, displayCcy)}
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
              delta={deltaPct(series(metrics, "total_users"))}
              loading={loading}
            />
          )}
        </div>
        <div className="xl:col-span-7">
          <Suspense
            fallback={
              <Card>
                <CardHeader>
                  <CardTitle>Kullanıcı Dağılımı — Ülkelere Göre</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[320px] animate-pulse rounded-lg bg-muted/40" />
                </CardContent>
              </Card>
            }
          >
            <UsersGeoMap scope={scope} isAll={isAll} days={range} />
          </Suspense>
        </div>
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
            value={formatMoney2(
              latest(metrics, "ad_ecpm") * rateOf(adCurrency),
              displayCcy,
            )}
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
      <div
        className={cn(
          "grid grid-cols-1 gap-4 lg:grid-cols-2",
          hasSentry && "xl:grid-cols-3",
        )}
      >
        <Card>
          <CardHeader>
            <CardTitle>{`Reklam Geliri — son ${range} gün`}</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={adRevenueSeriesDisplay}
              color={theme.chart.revenue}
              format={(v) => formatMoney(v, displayCcy)}
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
        {hasSentry && (
          <Card>
            <CardHeader>
              <CardTitle>{`Hatalar — son ${range} gün`}</CardTitle>
            </CardHeader>
            <CardContent>
              <TrendChart
                data={errorSeries}
                color="#ef4444"
                format={compact}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tüm Projeler: operasyon tablosu (MarineX referansı) */}
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Proje</TableHead>
                    <TableHead className="text-right">MRR</TableHead>
                    <TableHead className="text-right">Reklam</TableHead>
                    <TableHead className="text-right">DAU</TableHead>
                    <TableHead className="w-20 text-right">Detay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((p) => {
                    const mrrMap = latestByProject(metrics, "mrr");
                    const ad = latestByProject(metrics, "ad_revenue");
                    const dau = latestByProject(metrics, "dau");
                    const mrrConverted =
                      (mrrMap.get(p.id as string)?.value ?? 0) * rateOf("USD");
                    const adConverted =
                      (ad.get(p.id as string)?.value ?? 0) *
                      rateOf(projAdCurrency(p.id as string));
                    const health = projectHealth(
                      integrations.filter((i) => i.project_id === p.id),
                    );
                    return (
                      <TableRow
                        key={p.id}
                        className="cursor-pointer"
                        onClick={() => setScope(p.id as string)}
                      >
                        <TableCell>
                          <span
                            className={cn(
                              "block size-2 rounded-full",
                              health === "ok" && "bg-emerald-500 shadow-[0_0_8px_-1px_rgb(16,185,129)]",
                              health === "error" && "bg-red-500 shadow-[0_0_8px_-1px_rgb(239,68,68)]",
                              health === "pending" && "bg-muted-foreground/40",
                            )}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatMoney(mrrConverted, displayCcy)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatMoney(adConverted, displayCcy)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {compact(dau.get(p.id as string)?.value ?? 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Link to={`/users`} onClick={() => setScope(p.id as string)}>
                              Aç
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
