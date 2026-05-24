import { useEffect, useMemo, useState } from "react";
import { useList } from "@refinedev/core";
import {
  ChevronDown,
  Info,
  RefreshCw,
  TrendingDown,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RangeSelect } from "@/components/range-select";
import { StatCard } from "@/components/stat-card";
import { supabaseClient } from "@/providers/supabase-client";
import { useScope } from "@/context/scope";
import { compact } from "@/lib/metrics";
import type { ProjectIntegration } from "@/types";

interface FunnelStep {
  event: string;
  order: number;
  count: number;
  overall_pct: number;
  step_pct: number;
  drop: number;
}

interface FunnelResponse {
  days: number;
  steps: FunnelStep[];
  total_entered: number;
  total_converted: number;
  overall_conversion: number;
}

export const FunnelPage = () => {
  const { scope, isAll } = useScope();
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FunnelResponse | null>(null);

  const { result: integResult } = useList<ProjectIntegration>({
    resource: "project_integrations",
    filters: isAll
      ? []
      : [{ field: "project_id", operator: "eq", value: scope }],
    pagination: { mode: "off" },
  });
  const phIntg = integResult.data.find(
    (i) => i.provider === "posthog" && i.enabled,
  );
  const phCfg = (phIntg?.config ?? {}) as { funnel_steps?: string };
  const stepsConfigured =
    !!phCfg.funnel_steps && phCfg.funnel_steps.split(",").length >= 2;

  const load = useMemo(
    () => async () => {
      if (isAll || !phIntg || !stepsConfigured) {
        setData(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data: res, error: fnErr } = await supabaseClient.functions.invoke(
          "helm-funnel",
          { body: { project_id: scope, days } },
        );
        if (fnErr) throw fnErr;
        if (res?.error) throw new Error(res.error);
        setData(res as FunnelResponse);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [scope, isAll, days, phIntg, stepsConfigured],
  );

  useEffect(() => {
    load();
  }, [load]);

  const maxCount = data?.steps[0]?.count ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Huni</h1>
        <div className="flex items-center gap-2">
          <RangeSelect value={days} onChange={setDays} />
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading || isAll || !stepsConfigured}
          >
            <RefreshCw
              className={`size-4 ${loading ? "animate-spin" : ""}`}
            />
            <span className="ml-2">Yenile</span>
          </Button>
        </div>
      </div>

      {isAll && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <span>Huni için sidebar'dan bir proje seç.</span>
        </div>
      )}

      {!isAll && !phIntg && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <span>
            Bu projeye PostHog bağlı değil. Entegrasyonlar → "+" → PostHog.
          </span>
        </div>
      )}

      {!isAll && phIntg && !stepsConfigured && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <span>
            PostHog entegrasyonu var ama <code>funnel_steps</code> tanımlı
            değil. Entegrasyonlar → PostHog satırını Düzenle → "Huni adımları"
            alanına virgülle event'leri yaz (örn.{" "}
            <code>app_opened, signup, purchase</code>).
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              title="Huniye Girenler"
              value={compact(data.total_entered)}
              icon={<Users />}
              loading={loading}
            />
            <StatCard
              title="Sonuna Ulaşanlar"
              value={compact(data.total_converted)}
              icon={<Users />}
              loading={loading}
            />
            <StatCard
              title="Toplam Dönüşüm"
              value={`%${data.overall_conversion.toFixed(1)}`}
              icon={<TrendingDown />}
              loading={loading}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                Onboarding Hunisi — son {days} gün ({data.steps.length} adım)
              </CardTitle>
              <CardAction>
                <span className="text-xs text-muted-foreground">
                  sıralı funnel · unique user
                </span>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.steps.map((s, i) => {
                const widthPct =
                  maxCount > 0 ? (s.count / maxCount) * 100 : 0;
                return (
                  <div key={s.event} className="space-y-1">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">
                        {i + 1}.{" "}
                        <code className="font-mono text-xs">{s.event}</code>
                      </span>
                      <span className="font-mono tabular-nums">
                        <span className="text-base">{compact(s.count)}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          %{s.overall_pct.toFixed(1)} toplam
                        </span>
                      </span>
                    </div>
                    <div className="relative h-8 overflow-hidden rounded-md bg-muted">
                      <div
                        className="absolute inset-y-0 left-0 flex items-center bg-primary/40 px-3 text-xs"
                        style={{ width: `${Math.max(widthPct, 2)}%` }}
                      >
                        {widthPct > 15 && (
                          <span className="font-mono text-xs">
                            {compact(s.count)}
                          </span>
                        )}
                      </div>
                    </div>
                    {i > 0 && (
                      <div className="flex items-center gap-2 pl-3 text-xs text-muted-foreground">
                        <ChevronDown className="size-3" />
                        <span>
                          {s.step_pct >= 100 ? "+" : ""}
                          {s.step_pct.toFixed(1)}% önceki adımdan
                        </span>
                        {s.drop > 0 && (
                          <span className="text-destructive">
                            −{compact(s.drop)} düşüş
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}

      {!data && !loading && !error && !isAll && stepsConfigured && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Veri yok
          </CardContent>
        </Card>
      )}
    </div>
  );
};
