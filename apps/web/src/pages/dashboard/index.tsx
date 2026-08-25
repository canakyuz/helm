import { lazy, Suspense, useMemo, useState } from "react";
import {
  type CrudFilter,
  useGetIdentity,
  useInvalidate,
  useList,
  useNavigation,
} from "@refinedev/core";
import { Link } from "react-router";
import {
  Activity,
  AlertOctagon,
  ArrowDown,
  ArrowUp,
  Bell,
  ChevronsUpDown,
  CreditCard,
  Loader2,
  Pencil,
  RefreshCw,
  TrendingUp,
  Users as UsersIcon,
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
import { type TrendPoint } from "@/components/trend-chart";
import { ErrorsPanel } from "@/components/cockpit/errors-panel";
import { KpiCard } from "@/components/cockpit/kpi-card";
import { BarTrendCard } from "@/components/cockpit/bar-trend";
import { LatestUpdates } from "@/components/cockpit/latest-updates";
import { KpiPlaceholder } from "@/components/kpi-cell";
import { PageStatus } from "@/components/ui/page-status";
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
import { cn, displayName } from "@/lib/utils";
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
  if (!iso) return "hiç";
  const min = (Date.now() - new Date(iso).getTime()) / 60_000;
  if (min < 1) return "az önce";
  if (min < 60) return `${Math.round(min)}dk önce`;
  if (min < 1440) return `${Math.round(min / 60)}sa önce`;
  return `${Math.round(min / 1440)}g önce`;
};

/** Bir projenin connector sağlığı: ok / error / pending. */
const projectHealth = (
  integrations: ProjectIntegration[],
): "ok" | "error" | "pending" => {
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

  // Bu sayfanin GERCEKTEN okudugu metrikler. Tabloda 30 metrik var; filtresiz
  // sorgu 90 gunluk pencerede 3.102 satir istiyordu ve PostgREST 1.000'de
  // kesiyordu. Kesilen sorguda ORDER BY da yoktu, yani hangi 1.000 satirin
  // gelecegi belirsizdi - en guncel gunler disarida kalinca "NOW · REKLAM"
  // £0.00 gorunurken ayni sayfadaki proje tablosu £0.61 diyordu. Bu yavaslik
  // degil, SESSIZ VERI KAYBIYDI.
  //
  // Yeni metrik eklerken bu listeye de ekle; unutulursa o kart bos kalir ama
  // sayfa bozulmaz.
  const DASHBOARD_METRICS = [
    "ad_revenue", "mrr", "dau", "errors",
    "wau", "ad_ecpm", "active_subs", "total_users",
  ];

  const metricFilters: CrudFilter[] = [
    { field: "date", operator: "gte", value: since },
    { field: "metric", operator: "in", value: DASHBOARD_METRICS },
  ];
  if (!isAll) {
    metricFilters.push({ field: "project_id", operator: "eq", value: scope });
  }
  const { result: metricsResult, query: metricsQuery } = useList<Metric>({
    resource: "metrics",
    filters: metricFilters,
    // ORDER BY date DESC: tavan yine de asilirsa kaybedilen EN ESKI gunler
    // olur, rastgele gunler degil. Grafik kisalir ama bugunun rakami durur.
    sorters: [{ field: "date", order: "desc" }],
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

  // 7 gün: Latest Updates panelinin "Bu hafta" sekmesi için yeterli pencere.
  const since7d = useMemo(
    () => new Date(Date.now() - 7 * 86_400_000).toISOString(),
    [],
  );
  const { result: alertsResult } = useList<AlertEvent>({
    resource: "alert_events",
    filters: [
      { field: "triggered_at", operator: "gte", value: since7d },
    ],
    pagination: { mode: "off" },
  });
  // Üst şerit rozetinde eski davranış korunur: son 48 saatteki alertler.
  const openAlerts = useMemo(() => {
    const cutoff = Date.now() - 48 * 3_600_000;
    return alertsResult.data.filter(
      (a) => new Date(a.triggered_at).getTime() >= cutoff,
    ).length;
  }, [alertsResult.data]);

  const okCount = integrations.filter(
    (i) => i.last_sync_status === "ok",
  ).length;
  const errCount = integrations.filter(
    (i) => i.last_sync_status === "error",
  ).length;

  const activeProject = isAll
    ? null
    : projects.find((p) => p.id === scope);

  // AdMob raporlama para birimi - entegrasyon config'inden okunur.
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

  // RevenueCat raporlama para birimi - config'ten (genelde USD).
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

  // Ekran para birimi - Ayarlar'dan. Tüm para değerleri buna çevrilir.
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
  // Sadece ad_revenue (kart "REKLAM" - app/mağaza geliri Gelir & Reklam sayfasında).
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

  // MRR sparkline serisi - display ccy converted (USD * rate).
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

  const { data: identity } = useGetIdentity<{ name?: string }>();
  const firstName = displayName(identity?.name);

  // Bugünün reklam geliri delta'sı - düne göre (Kravio "vs last week" satırı).
  const adTodayDelta =
    adTotals.yesterday > 0
      ? ((adTotals.today - adTotals.yesterday) / adTotals.yesterday) * 100
      : null;

  // Bar chart penceresi: son 14 gün. Delta: son 7 gün vs önceki 7 gün.
  const barData = useMemo(
    () => adRevenueSeriesDisplay.slice(-14),
    [adRevenueSeriesDisplay],
  );
  const barTotal = useMemo(
    () => barData.reduce((s, p) => s + p.value, 0),
    [barData],
  );
  const barDelta = useMemo(() => {
    if (barData.length < 4) return null;
    const half = Math.floor(barData.length / 2);
    const prev = barData.slice(0, half).reduce((s, p) => s + p.value, 0);
    const curr = barData.slice(half).reduce((s, p) => s + p.value, 0);
    return prev > 0 ? ((curr - prev) / prev) * 100 : null;
  }, [barData]);

  // Projects tablosu: satırlar önceden hesap + sıralanabilir başlıklar.
  // latestByProject artık satır başına değil, tablo başına 1 kez çağrılır:
  // O(projects × metrics) → O(metrics + projects log projects).
  type SortKey = "name" | "mrr" | "ad" | "dau";
  const [sortKey, setSortKey] = useState<SortKey>("ad");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const projectRows = useMemo(() => {
    const mrrMap = latestByProject(metrics, "mrr");
    const adMap = latestByProject(metrics, "ad_revenue");
    const dauMap = latestByProject(metrics, "dau");
    const rows = projects.map((p) => ({
      project: p,
      mrr:
        withMrrCents(mrrMap.get(p.id as string)?.value ?? 0, mrrCents) *
        rateOf(rcCurrency),
      ad:
        (adMap.get(p.id as string)?.value ?? 0) *
        rateOf(projAdCurrency(p.id as string)),
      dau: dauMap.get(p.id as string)?.value ?? 0,
      health: projectHealth(
        integrations.filter((i) => i.project_id === p.id),
      ),
    }));
    const dir = sortDir === "asc" ? 1 : -1;
    return rows.sort((a, b) =>
      sortKey === "name"
        ? a.project.name.localeCompare(b.project.name) * dir
        : (a[sortKey] - b[sortKey]) * dir,
    );
  }, [projects, metrics, integrations, mrrCents, fxRates, rcCurrency, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4">
      {/* ════════ GREETING + KONTROLLER (Kravio üst blok) ════════ */}
      <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">
            Merhaba, {firstName} 👋
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isAll
              ? "Tüm projelerinden son metrikler ve içgörüler."
              : `${activeProject?.name ?? "Proje"} için son metrikler.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusStrip
            okCount={okCount}
            total={integrations.length}
            errCount={errCount}
            syncStale={syncStale}
            lastRunAt={lastRun?.started_at ?? null}
            openAlerts={openAlerts}
            errorLatest={hasSentry ? errorLatest : null}
          />
          <RangeSelect value={range} onChange={setRange} />
          {!isAll && activeProject && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => edit("projects", scope)}
            >
              <Pencil className="size-3" /> Düzenle
            </Button>
          )}
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw
              className={syncing ? "size-3 animate-spin" : "size-3"}
            />
            Senkronize et
          </Button>
        </div>
      </div>

      {metricsQuery.isError && (
        <PageStatus
          tone="error"
          label="Metrikler yüklenemedi - rakamlar eksik olabilir, sayfayı yenile"
          className="min-h-0 py-4"
        />
      )}

      {/* ════════ KPI + BAR CHART (sol) · LATEST UPDATES (sağ ray) ════════ */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard
              title="Reklam · Bugün"
              icon={<TrendingUp />}
              value={formatMoney(adTotals.today, displayCcy)}
              delta={adTodayDelta}
              deltaLabel="vs dün"
              spark={barData}
              loading={loading}
            />
            {subsEnabled ? (
              <KpiCard
                title={isAll ? "Total MRR" : "MRR"}
                icon={<CreditCard />}
                value={formatMoney(mrrDisplay, displayCcy)}
                delta={deltaPct(mrrSpark)}
                deltaLabel="vs 7 gün"
                spark={mrrSpark.slice(-14)}
                loading={loading}
              />
            ) : (
              <KpiPlaceholder
                label={isAll ? "Total MRR" : "MRR"}
                module="Abonelik"
              />
            )}
            {analyticsEnabled ? (
              <KpiCard
                title={isAll ? "Total DAU" : "DAU"}
                icon={<UsersIcon />}
                value={compact(latest(metrics, "dau"))}
                delta={deltaPct(dauSeries)}
                deltaLabel="vs 7 gün"
                spark={dauSeries.slice(-14)}
                loading={loading}
              />
            ) : (
              <KpiPlaceholder
                label={isAll ? "Total DAU" : "DAU"}
                module="Analitik"
              />
            )}
          </div>

          <BarTrendCard
            title="Reklam Geliri Trend"
            data={barData}
            total={formatMoney(barTotal, displayCcy)}
            delta={barDelta}
            deltaLabel="vs önceki 7 gün"
            format={(v) => formatMoney(v, displayCcy)}
            loading={loading}
          />

          <Suspense
            fallback={
              <Card className="grid h-[380px] place-items-center py-0 text-muted-foreground">
                <Loader2 className="size-6 animate-spin" />
              </Card>
            }
          >
            <UsersGeoMap scope={scope} isAll={isAll} days={range} mapHeight={300} />
          </Suspense>
        </div>

        <LatestUpdates
          alerts={alertsResult.data}
          runs={runsResult.data.slice(0, 20)}
          // Kart kendi icerigi kadar: sabit yukseklik verilirse az aktivite
          // oldugunda kartin ICINDE olu bosluk kaliyordu.
          className="flex flex-col"
        />
      </div>

      {/* ════ PROJELER TABLOSU (Kravio SLA Monitoring karşılığı) + HATALAR ════ */}
      <div className="grid gap-4 pb-4 lg:grid-cols-12">
        <Card className="py-0 lg:col-span-8">
          <CardHeader className="flex flex-row items-center justify-between px-5 pt-5 pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Projects
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {projects.length} proje
            </span>
          </CardHeader>
          <CardContent className="px-2 pb-3 pt-2">
            {projectRows.length === 0 ? (
              <div className="grid place-items-center py-10 text-xs text-muted-foreground">
                Henüz proje yok
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-9 w-8 px-3" />
                    <TableHead className="h-9 px-3">
                      <SortHead
                        label="Project"
                        active={sortKey === "name"}
                        dir={sortDir}
                        onClick={() => toggleSort("name")}
                      />
                    </TableHead>
                    <TableHead className="h-9 px-3 text-xs">Sağlık</TableHead>
                    <TableHead className="h-9 px-3">
                      <SortHead
                        label="MRR"
                        align="right"
                        active={sortKey === "mrr"}
                        dir={sortDir}
                        onClick={() => toggleSort("mrr")}
                      />
                    </TableHead>
                    <TableHead className="h-9 px-3">
                      <SortHead
                        label="Reklam"
                        align="right"
                        active={sortKey === "ad"}
                        dir={sortDir}
                        onClick={() => toggleSort("ad")}
                      />
                    </TableHead>
                    <TableHead className="h-9 px-3">
                      <SortHead
                        label="DAU"
                        align="right"
                        active={sortKey === "dau"}
                        dir={sortDir}
                        onClick={() => toggleSort("dau")}
                      />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectRows.map((row) => {
                    const p = row.project;
                    const isCurrent = !isAll && p.id === scope;
                    return (
                      <TableRow
                        key={p.id}
                        className={cn(
                          "h-11 cursor-pointer",
                          isCurrent && "bg-muted/60",
                        )}
                        onClick={() => setScope(p.id as string)}
                      >
                        <TableCell className="px-3">
                          <span
                            className={cn(
                              "block size-2 rounded-full",
                              row.health === "ok" &&
                                "bg-[rgb(var(--bento-pos))]",
                              row.health === "error" && "bg-destructive",
                              row.health === "pending" &&
                                "bg-muted-foreground/40",
                            )}
                          />
                        </TableCell>
                        <TableCell
                          className={cn(
                            "truncate px-3 text-[13px]",
                            isCurrent ? "font-semibold" : "font-medium",
                          )}
                        >
                          {p.name}
                        </TableCell>
                        <TableCell className="px-3">
                          <HealthBadge health={row.health} />
                        </TableCell>
                        <TableCell className="px-3 text-right text-[13px] tabular-nums">
                          {formatMoney(row.mrr, displayCcy)}
                        </TableCell>
                        <TableCell className="px-3 text-right text-[13px] tabular-nums">
                          {formatMoney(row.ad, displayCcy)}
                        </TableCell>
                        <TableCell className="px-3 text-right text-[13px] tabular-nums">
                          {compact(row.dau)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <ErrorsPanel
          hasSentry={hasSentry}
          projectName={(id) =>
            projects.find((p) => p.id === id)?.name ?? id.slice(0, 8)
          }
          isAll={isAll}
        />
      </div>
    </div>
  );
};

/** Sıralanabilir tablo başlığı - tıkla → sırala, tekrar tıkla → yön değiştir. */
const SortHead = ({
  label,
  active,
  dir,
  align,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  align?: "right";
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "inline-flex w-full items-center gap-1 text-xs transition-colors hover:text-foreground",
      align === "right" && "justify-end",
      active ? "font-semibold text-foreground" : "text-muted-foreground",
    )}
  >
    {label}
    {active ? (
      dir === "asc" ? (
        <ArrowUp className="size-3" />
      ) : (
        <ArrowDown className="size-3" />
      )
    ) : (
      <ChevronsUpDown className="size-3 opacity-40" />
    )}
  </button>
);

/** Sağlık pill'leri - eski status strip'in kompakt hali. */
const StatusStrip = ({
  okCount,
  total,
  errCount,
  syncStale,
  lastRunAt,
  openAlerts,
  errorLatest,
}: {
  okCount: number;
  total: number;
  errCount: number;
  syncStale: boolean;
  lastRunAt: string | null;
  openAlerts: number;
  errorLatest: number | null;
}) => (
  <div className="flex items-center gap-1.5 text-[11px]">
    <Link
      to="/system"
      className={cn(
        "flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 transition-colors hover:text-foreground",
        errCount > 0
          ? "text-destructive"
          : okCount === total && total > 0
            ? "text-[rgb(var(--bento-pos))]"
            : "text-muted-foreground",
      )}
    >
      <Activity className="size-3" />
      <span className="tabular-nums">
        {okCount}/{total}
      </span>
    </Link>
    <Link
      to="/system"
      className={cn(
        "flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 transition-colors hover:text-foreground",
        syncStale ? "text-destructive" : "text-muted-foreground",
      )}
      title={
        syncStale
          ? "Gece cron'u çalışmıyor olabilir - Vault secret'larını kontrol et"
          : undefined
      }
    >
      <RefreshCw className="size-3" />
      <span className="tabular-nums">{timeAgo(lastRunAt)}</span>
    </Link>
    <Link
      to="/alerts"
      className={cn(
        "flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 transition-colors hover:text-foreground",
        openAlerts > 0 ? "text-destructive" : "text-muted-foreground",
      )}
    >
      <Bell className="size-3" />
      <span className="tabular-nums">{openAlerts}</span>
    </Link>
    {errorLatest !== null && (
      <Link
        to="/system"
        className={cn(
          "flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 transition-colors hover:text-foreground",
          errorLatest > 0 ? "text-destructive" : "text-muted-foreground",
        )}
      >
        <AlertOctagon className="size-3" />
        <span className="tabular-nums">{compact(errorLatest)}</span>
      </Link>
    )}
  </div>
);

/** Kravio Status kolonu karşılığı - connector sağlığı rozeti. */
const HealthBadge = ({
  health,
}: {
  health: "ok" | "error" | "pending";
}) => {
  const map = {
    ok: { label: "Sağlıklı", cls: "text-[rgb(var(--bento-pos))]" },
    error: { label: "Hata", cls: "text-destructive" },
    pending: { label: "Bekliyor", cls: "text-[rgb(var(--bento-warn))]" },
  } as const;
  const { label, cls } = map[health];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", cls)}>
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
};
