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
  Globe2,
  Loader2,
  Pencil,
  RefreshCw,
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
import { TrendChart, type TrendPoint } from "@/components/trend-chart";
import { HeroGhost } from "@/components/hero-ghost";
import { ErrorsPanel } from "@/components/cockpit/errors-panel";
import { KpiCell, KpiPlaceholder } from "@/components/kpi-cell";
import { useIsModuleEnabled } from "@/hooks/use-enabled-modules";
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
  parseMrrCents,
  series,
  sumInRange,
  valueOnDate,
  withMrrCents,
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
  if (!iso) return "never";
  const min = (Date.now() - new Date(iso).getTime()) / 60_000;
  if (min < 1) return "just now";
  if (min < 60) return `${Math.round(min)}m ago`;
  if (min < 1440) return `${Math.round(min / 60)}h ago`;
  return `${Math.round(min / 1440)}d ago`;
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
  const subsEnabled = useIsModuleEnabled("subscriptions");
  const adsEnabled = useIsModuleEnabled("ads");
  const usersEnabled = useIsModuleEnabled("users");
  const analyticsEnabled = useIsModuleEnabled("analytics");
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

  // RevenueCat raporlama para birimi — config'ten (genelde USD).
  const rcCurrency = useMemo(() => {
    const rc = integrations.find(
      (i) =>
        i.provider === "revenuecat" && (isAll || i.project_id === scope),
    );
    return ((rc?.config as { currency?: string })?.currency) || "USD";
  }, [integrations, scope, isAll]);

  // RC MRR'ı kuruşu yuvarlar; config'te .99 verildiyse gösterimde geri ekle.
  const mrrCents = useMemo(() => {
    const rc = integrations.find(
      (i) => i.provider === "revenuecat" && (isAll || i.project_id === scope),
    );
    return parseMrrCents((rc?.config as { mrr_cents?: string })?.mrr_cents);
  }, [integrations, scope, isAll]);

  // Ekran para birimi — Ayarlar'dan. Tüm para değerleri buna çevrilir.
  const { currency: displayCcy } = useDisplayCurrency();
  const sourceCurrencies = useMemo(() => {
    const set = new Set<string>(["USD"]);
    for (const i of integrations) {
      if (["admob", "app_store_connect", "revenuecat"].includes(i.provider)) {
        set.add((i.config as { currency?: string })?.currency || "USD");
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

  const mrrDisplay = withMrrCents(latest(metrics, "mrr"), mrrCents) * rateOf(rcCurrency);

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


  // AdMob konsoluna paralel: Bugün / Dün / Bu ay / Geçen ay REKLAM geliri.
  // Sadece ad_revenue (kart "REKLAM" — app/mağaza geliri Gelir & Reklam sayfasında).
  const ranges = useMemo(() => moneyRanges(), []);
  const adTotals = useMemo(() => {
    const ar = rateOf(adCurrency);
    const pick = (date: string) => valueOnDate(metrics, "ad_revenue", date) * ar;
    const pickRange = (s: string, e: string) =>
      sumInRange(metrics, "ad_revenue", s, e) * ar;
    return {
      today: pick(ranges.today),
      yesterday: pick(ranges.yesterday),
      thisMonth: pickRange(ranges.thisMonthStart, ranges.thisMonthEnd),
      prevMonth: pickRange(ranges.prevMonthStart, ranges.prevMonthEnd),
    };
  }, [metrics, ranges, fxRates, adCurrency]);

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
        description: `${data?.ingested ?? 0} metrics updated.`,
      });
      invalidate({ resource: "metrics", invalidates: ["list"] });
      invalidate({ resource: "sync_runs", invalidates: ["list"] });
      invalidate({ resource: "project_integrations", invalidates: ["list"] });
    } catch (e) {
      toast.error("Sync failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSyncing(false);
    }
  };

  // MRR sparkline serisi — display ccy converted (USD * rate).
  const mrrSpark: TrendPoint[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of metrics) {
      if (m.metric !== "mrr") continue;
      map.set(m.date, (map.get(m.date) ?? 0) + Number(m.value));
    }
    const rate = rateOf(rcCurrency);
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, value]) => ({ date, value: withMrrCents(value, mrrCents) * rate }));
  }, [metrics, fxRates, rcCurrency, mrrCents]);

  return (
    <div className="absolute inset-0 grid grid-rows-[36px_112px_minmax(0,1fr)_220px] gap-3 overflow-hidden p-3">
      {/* ════════ STATUS STRIP — 36px ════════ */}
      <div className="flex items-center gap-2 px-1 text-[11px]">
        <div className="flex flex-1 items-center gap-3">
          <div>
            <span className="text-muted-foreground">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}{" "}
              ·{" "}
            </span>
            <span className="font-semibold">
              {isAll ? "Cockpit" : (activeProject?.name ?? "Proje")}
            </span>
          </div>
        </div>
        <Link
          to="/system"
          className={cn(
            "flex items-center gap-1 rounded-full border border-foreground/10 px-2 py-0.5 transition-colors hover:bg-accent",
            errCount > 0 && "text-destructive",
            okCount === integrations.length &&
              integrations.length > 0 &&
              "text-emerald-400",
          )}
        >
          <Activity className="size-3" />
          <span className="font-mono tabular-nums">
            {okCount}/{integrations.length}
          </span>
        </Link>
        <Link
          to="/system"
          className={cn(
            "flex items-center gap-1 rounded-full border border-foreground/10 px-2 py-0.5 transition-colors hover:bg-accent",
            syncStale && "text-destructive",
          )}
          title={
            syncStale
              ? "The nightly cron may not be running — check the Vault secrets"
              : undefined
          }
        >
          <RefreshCw className="size-3" />
          <span className="font-mono tabular-nums">
            {timeAgo(lastRun?.started_at ?? null)}
          </span>
        </Link>
        <Link
          to="/alerts"
          className={cn(
            "flex items-center gap-1 rounded-full border border-foreground/10 px-2 py-0.5 transition-colors hover:bg-accent",
            openAlerts > 0 && "text-destructive",
          )}
        >
          <Bell className="size-3" />
          <span className="font-mono tabular-nums">{openAlerts}</span>
        </Link>
        {hasSentry && (
          <Link
            to="/system"
            className={cn(
              "flex items-center gap-1 rounded-full border border-foreground/10 px-2 py-0.5 transition-colors hover:bg-accent",
              errorLatest > 0 && "text-destructive",
            )}
          >
            <AlertOctagon className="size-3" />
            <span className="font-mono tabular-nums">
              {compact(errorLatest)}
            </span>
          </Link>
        )}
        <span className="h-3 w-px bg-foreground/10" />
        <RangeSelect value={range} onChange={setRange} />
        {!isAll && activeProject && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => edit("projects", scope)}
          >
            <Pencil className="size-3" /> Düzenle
          </Button>
        )}
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={handleSync}
          disabled={syncing}
        >
          <RefreshCw
            className={syncing ? "size-3 animate-spin" : "size-3"}
          />
          Senkronize et
        </Button>
      </div>

      {/* ════════ ZONE A — KPI Cluster (220px) ════════ */}
      <div
        className={cn(
          "grid gap-3 min-h-0",
          isAll
            ? "grid-cols-2 md:grid-cols-4 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr]"
            : "grid-cols-2 md:grid-cols-4 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr]",
        )}
      >
        {/* Cell 1: Hero ₺ (col-span-2 for prominence) — yatay layout */}
        <Card className="relative xl:col-span-1 col-span-2 overflow-hidden mt-0 pt-0">
          <HeroSpark
            data={adRevenueSeriesDisplay}
            color={theme.chart.revenue}
          />
          <CardContent className="relative px-4 mt-0 py-4">
            <div className="flex flex-wrap justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Now ·{" "} Reklam
                </div>
                <div className="mt-1 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                  <div className="helm-hero-number text-[clamp(1.875rem,4cqw,2.5rem)] leading-none">
                    {formatMoney(adTotals.today, displayCcy)}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-0 mt-0 flex-wrap align-top">
                <SubStat
                    label="Yesterday"
                    value={formatMoney(adTotals.yesterday, displayCcy)}
                />
                <SubStat
                    label="Bu ay"
                    value={formatMoney(adTotals.thisMonth, displayCcy)}
                />
                <SubStat
                    label="Last month"
                    value={formatMoney(adTotals.prevMonth, displayCcy)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cell 2: MRR — subscriptions */}
        {subsEnabled ? (
          <KpiCell
            label={isAll ? "Toplam MRR" : "MRR"}
            value={formatMoney(mrrDisplay, displayCcy)}
            hint="Monthly recurring revenue"
            loading={loading}
          />
        ) : (
          <KpiPlaceholder label={isAll ? "Toplam MRR" : "MRR"} module="Abonelik" />
        )}

        {/* Cell 3: DAU — analytics */}
        {analyticsEnabled ? (
          <KpiCell
            label={isAll ? "Toplam DAU" : "DAU"}
            value={compact(latest(metrics, "dau"))}
            delta={deltaPct(dauSeries)}
            hint="Daily active"
            loading={loading}
          />
        ) : (
          <KpiPlaceholder label={isAll ? "Toplam DAU" : "DAU"} module="Analitik" />
        )}

        {/* Cell 4: isAll → Aktif Abone (subscriptions) | proje → eCPM (ads) */}
        {isAll ? (
          subsEnabled ? (
            <KpiCell
              label="Aktif Abone"
              value={compact(latest(metrics, "active_subs"))}
              hint="RevenueCat"
              loading={loading}
            />
          ) : (
            <KpiPlaceholder label="Aktif Abone" module="Abonelik" />
          )
        ) : adsEnabled ? (
          <KpiCell
            label="eCPM"
            value={formatMoney2(
              latest(metrics, "ad_ecpm") * rateOf(adCurrency),
              displayCcy,
            )}
            hint="Etkili CPM"
            loading={loading}
          />
        ) : (
          <KpiPlaceholder label="eCPM" module="Reklam" />
        )}

        {/* Cell 5: isAll → Toplam Kullanıcı | proje → WAU (users) */}
        {usersEnabled ? (
          isAll ? (
            <KpiCell
              label="Total users"
              value={compact(latest(metrics, "total_users"))}
              delta={deltaPct(series(metrics, "total_users"))}
              hint="Supabase"
              loading={loading}
            />
          ) : (
            <KpiCell
              label="WAU"
              value={compact(latest(metrics, "wau"))}
              hint="Weekly active"
              loading={loading}
            />
          )
        ) : (
          <KpiPlaceholder
            label={isAll ? "Total users" : "WAU"}
            module="Customers"
          />
        )}

      </div>

      {/* ════════ ZONE B — Living Canvas (map full) ════════ */}
      {/* ZONE B grid: map 8 col + Projeler tablo 4 col yan */}
      <div className="grid min-h-0 gap-3 lg:grid-cols-12">
        {/* Map — 8 col */}
        <Card className="relative overflow-hidden lg:col-span-8">
          <Suspense
            fallback={
              <div className="absolute inset-0 grid place-items-center text-muted-foreground">
                <Loader2 className="size-6 animate-spin" />
              </div>
            }
          >
            <UsersGeoMap
              scope={scope}
              isAll={isAll}
              days={range}
              fullCanvas
            />
          </Suspense>
        </Card>
        {/* Side panel — 4 col: Hatalar tablo (tıklayınca detay dialog) */}
        <ErrorsPanel
          hasSentry={hasSentry}
          projectName={(id) =>
            projects.find((p) => p.id === id)?.name ?? id.slice(0, 8)
          }
          isAll={isAll}
        />
      </div>

      {/* ════════ ZONE C — 3 trend chart (Projeler ZONE B yan'a taşındı) ════════ */}
      <div className="grid min-h-0 grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Reklam Geliri · {range}g
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[calc(100%-2.5rem)] p-2">
            <TrendChart
              data={adRevenueSeriesDisplay}
              color={theme.chart.revenue}
              height={150}
              format={(v) => formatMoney(v, displayCcy)}
            />
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">DAU · {range}g</CardTitle>
          </CardHeader>
          <CardContent className="h-[calc(100%-2.5rem)] p-2">
            <TrendChart
              data={dauSeries}
              color={theme.chart.users}
              height={150}
              format={compact}
            />
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <span>Projeler</span>
              <span className="text-[10px] font-normal text-muted-foreground">
                {projects.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[calc(100%-2.5rem)] overflow-y-auto p-0">
            {projects.length === 0 ? (
              <div className="grid h-full place-items-center text-xs text-muted-foreground">
                Henüz proje yok
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-7 w-6 px-2" />
                    <TableHead className="h-7 px-2 text-xs">Proje</TableHead>
                    <TableHead className="h-7 px-2 text-right text-xs">
                      MRR
                    </TableHead>
                    <TableHead className="h-7 px-2 text-right text-xs">
                      Reklam
                    </TableHead>
                    <TableHead className="h-7 px-2 text-right text-xs">
                      DAU
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((p) => {
                    const mrrMap = latestByProject(metrics, "mrr");
                    const ad = latestByProject(metrics, "ad_revenue");
                    const dau = latestByProject(metrics, "dau");
                    const mrrConverted =
                      withMrrCents(mrrMap.get(p.id as string)?.value ?? 0, mrrCents) *
                      rateOf(rcCurrency);
                    const adConverted =
                      (ad.get(p.id as string)?.value ?? 0) *
                      rateOf(projAdCurrency(p.id as string));
                    const health = projectHealth(
                      integrations.filter((i) => i.project_id === p.id),
                    );
                    const isCurrent = !isAll && p.id === scope;
                    return (
                      <TableRow
                        key={p.id}
                        className={cn(
                          "cursor-pointer",
                          isCurrent && "bg-primary/10",
                        )}
                        onClick={() => setScope(p.id as string)}
                      >
                        <TableCell className="px-2 py-1.5">
                          <span
                            className={cn(
                              "block size-1.5 rounded-full",
                              health === "ok" &&
                                "bg-emerald-500 shadow-[0_0_6px_-1px_rgb(16,185,129)]",
                              health === "error" &&
                                "bg-red-500 shadow-[0_0_6px_-1px_rgb(239,68,68)]",
                              health === "pending" &&
                                "bg-muted-foreground/40",
                            )}
                          />
                        </TableCell>
                        <TableCell
                          className={cn(
                            "truncate px-2 py-1.5 text-xs",
                            isCurrent ? "font-semibold" : "font-medium",
                          )}
                        >
                          {p.name}
                        </TableCell>
                        <TableCell className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
                          {formatMoney(mrrConverted, displayCcy)}
                        </TableCell>
                        <TableCell className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
                          {formatMoney(adConverted, displayCcy)}
                        </TableCell>
                        <TableCell className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
                          {compact(dau.get(p.id as string)?.value ?? 0)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const SubStat = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
      {label}
    </div>
    <div className="truncate font-mono text-sm font-medium tabular-nums text-foreground">
      {value}
    </div>
  </div>
);

/** Hero kart arka planında ghost sparkline. */
const HeroSpark = ({
  data,
  color,
}: {
  data: { date: string; value: number }[];
  color: string;
}) => {
  if (!data || data.length < 2) return null;
  const W = 100;
  const H = 30;
  const values = data.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const dx = W / (data.length - 1);
  const pts = data
    .map((p, i) => {
      const x = i * dx;
      const y = H - ((p.value - min) / span) * H;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const area = `${pts} L${W},${H} L0,${H} Z`;
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] w-full opacity-[0.25]"
    >
      <defs>
        <linearGradient id="hero-spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.7} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#hero-spark-grad)" />
      <path
        d={pts}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};
