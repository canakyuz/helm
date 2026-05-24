import { useMemo, useState } from "react";
import { type CrudFilter, useList } from "@refinedev/core";
import {
  Download,
  DollarSign,
  Eye,
  Gauge,
  Store,
  Users,
  Wallet,
} from "lucide-react";
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
import { useDisplayCurrency } from "@/context/currency";
import { useHelmTheme } from "@/theme/ThemeProvider";
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
import type { Metric, ProjectIntegration } from "@/types";

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

  // App Store Connect proceeds currency. Vendor varsayılanı çoğu hesapta USD.
  const appCurrency = useMemo(() => {
    const apps = integrations.filter((i) => i.provider === "app_store_connect");
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

  const hasAppStore = integrations.some(
    (i) => i.provider === "app_store_connect" && i.enabled,
  );

  const mrrSeries = useMemo(() => series(metrics, "mrr"), [metrics]);
  const adSeries = useMemo(() => series(metrics, "ad_revenue"), [metrics]);
  const impSeries = useMemo(
    () => series(metrics, "ad_impressions"),
    [metrics],
  );
  const appRevSeries = useMemo(
    () => series(metrics, "app_revenue"),
    [metrics],
  );
  const downloadsSeries = useMemo(
    () => series(metrics, "app_downloads"),
    [metrics],
  );

  const { currency: displayCcy } = useDisplayCurrency();
  const sourceCurrencies = useMemo(() => {
    const set = new Set<string>(["USD"]);
    for (const i of integrations) {
      if (i.provider === "admob" || i.provider === "app_store_connect") {
        const c = (i.config as { currency?: string })?.currency || "USD";
        set.add(c);
      }
    }
    return Array.from(set);
  }, [integrations]);
  const fxRates = useFxRates(sourceCurrencies, displayCcy);
  const rateOf = (ccy: string) => fxRates[ccy] ?? 1;

  const adRevenueDisplay = latest(metrics, "ad_revenue") * rateOf(adCurrency);
  const adSeriesDisplay = useMemo(
    () =>
      adSeries.map((p) => ({
        date: p.date,
        value: p.value * rateOf(adCurrency),
      })),
    [adSeries, fxRates, adCurrency],
  );
  const mrrDisplay = latest(metrics, "mrr") * rateOf("USD");
  const revenue28d = latest(metrics, "revenue_28d") * rateOf("USD");

  // AdMob konsolundaki "Bugün / Dün / Bu ay / Geçen ay" paneline paralel
  // toplamlar (display currency'ye çevrilmiş).
  const ranges = useMemo(() => moneyRanges(), []);
  const adTotals = useMemo(() => {
    const rate = rateOf(adCurrency);
    return {
      today: valueOnDate(metrics, "ad_revenue", ranges.today) * rate,
      yesterday: valueOnDate(metrics, "ad_revenue", ranges.yesterday) * rate,
      thisMonth:
        sumInRange(metrics, "ad_revenue", ranges.thisMonthStart, ranges.thisMonthEnd) *
        rate,
      prevMonth:
        sumInRange(metrics, "ad_revenue", ranges.prevMonthStart, ranges.prevMonthEnd) *
        rate,
    };
  }, [metrics, ranges, fxRates, adCurrency]);
  const appTotals = useMemo(() => {
    const rate = rateOf(appCurrency);
    return {
      today: valueOnDate(metrics, "app_revenue", ranges.today) * rate,
      yesterday: valueOnDate(metrics, "app_revenue", ranges.yesterday) * rate,
      thisMonth:
        sumInRange(metrics, "app_revenue", ranges.thisMonthStart, ranges.thisMonthEnd) *
        rate,
      prevMonth:
        sumInRange(metrics, "app_revenue", ranges.prevMonthStart, ranges.prevMonthEnd) *
        rate,
    };
  }, [metrics, ranges, fxRates, appCurrency]);

  const hasRevenueCat = integrations.some(
    (i) => i.provider === "revenuecat" && i.enabled,
  );

  const appRevDisplay = latest(metrics, "app_revenue") * rateOf(appCurrency);
  const appRevSeriesDisplay = useMemo(
    () =>
      appRevSeries.map((p) => ({
        date: p.date,
        value: p.value * rateOf(appCurrency),
      })),
    [appRevSeries, fxRates, appCurrency],
  );
  const downloadsLatest = latest(metrics, "app_downloads");

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
          {hasAppStore && (
            <TabsTrigger value="store">
              <Store className="size-4" /> Mağaza
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="subscription" className="space-y-4">
          {!hasRevenueCat && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="py-4 text-sm text-amber-600 dark:text-amber-400">
                RevenueCat bağlanmadı. Abonelik geliri akmıyor — Entegrasyonlar
                sekmesinden RevenueCat'i bağla (v2 secret key + project_id).
              </CardContent>
            </Card>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              title="MRR"
              value={formatMoney(mrrDisplay, displayCcy)}
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
              value={formatMoney(revenue28d, displayCcy)}
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
                data={mrrSeries.map((p) => ({
                  date: p.date,
                  value: p.value * rateOf("USD"),
                }))}
                color={theme.chart.revenue}
                format={(v) => formatMoney(v, displayCcy)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ads" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Toplam Tahmini Kazanç (AdMob)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <div className="text-xs text-muted-foreground">Bugün şimdiye kadar</div>
                  <div className="mt-1 font-mono text-2xl">
                    {formatMoney(adTotals.today, displayCcy)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Dün</div>
                  <div className="mt-1 font-mono text-2xl">
                    {formatMoney(adTotals.yesterday, displayCcy)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Bu ay şimdiye kadar</div>
                  <div className="mt-1 font-mono text-2xl">
                    {formatMoney(adTotals.thisMonth, displayCcy)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Geçen ay</div>
                  <div className="mt-1 font-mono text-2xl">
                    {formatMoney(adTotals.prevMonth, displayCcy)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              title="Reklam Geliri (son gün)"
              value={formatMoney(adRevenueDisplay, displayCcy)}
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
              value={formatMoney2(
                latest(metrics, "ad_ecpm") * rateOf(adCurrency),
                displayCcy,
              )}
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
                  data={adSeriesDisplay}
                  color={theme.chart.revenue}
                  format={(v) => formatMoney(v, displayCcy)}
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

        {hasAppStore && (
          <TabsContent value="store" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Toplam Mağaza Kazancı</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Bugün şimdiye kadar</div>
                    <div className="mt-1 font-mono text-2xl">
                      {formatMoney(appTotals.today, displayCcy)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Dün</div>
                    <div className="mt-1 font-mono text-2xl">
                      {formatMoney(appTotals.yesterday, displayCcy)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Bu ay şimdiye kadar</div>
                    <div className="mt-1 font-mono text-2xl">
                      {formatMoney(appTotals.thisMonth, displayCcy)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Geçen ay</div>
                    <div className="mt-1 font-mono text-2xl">
                      {formatMoney(appTotals.prevMonth, displayCcy)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                title="Mağaza Geliri (son gün)"
                value={formatMoney(appRevDisplay, displayCcy)}
                icon={<DollarSign />}
                delta={deltaPct(appRevSeries)}
                loading={loading}
              />
              <StatCard
                title="İndirme (son gün)"
                value={compact(downloadsLatest)}
                icon={<Download />}
                delta={deltaPct(downloadsSeries)}
                loading={loading}
              />
              <StatCard
                title="Gelir/İndirme"
                value={
                  downloadsLatest > 0
                    ? formatMoney2(appRevDisplay / downloadsLatest, displayCcy)
                    : "—"
                }
                icon={<Gauge />}
                loading={loading}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{`Mağaza Geliri — son ${range} gün`}</CardTitle>
                </CardHeader>
                <CardContent>
                  <TrendChart
                    data={appRevSeriesDisplay}
                    color={theme.chart.revenue}
                    format={(v) => formatMoney(v, displayCcy)}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{`İndirme — son ${range} gün`}</CardTitle>
                </CardHeader>
                <CardContent>
                  <TrendChart
                    data={downloadsSeries}
                    color={theme.chart.users}
                    format={compact}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
