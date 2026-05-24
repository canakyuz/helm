import { useEffect, useMemo, useState } from "react";
import { useInvalidate, useList, useUpdate } from "@refinedev/core";
import {
  AlertTriangle,
  ArrowDown,
  Info,
  Pencil,
  Plus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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

interface PHEvent {
  name: string;
  last_seen_at: string | null;
  volume_30_day: number | null;
  system: boolean;
}

export const FunnelPage = () => {
  const { scope, isAll } = useScope();
  const invalidate = useInvalidate();
  const { mutate: update } = useUpdate();
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FunnelResponse | null>(null);

  const [events, setEvents] = useState<PHEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [pickedEvents, setPickedEvents] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);

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
  const phCfg = (phIntg?.config ?? {}) as {
    funnel_steps?: string;
    [k: string]: unknown;
  };
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

  const loadEvents = useMemo(
    () => async () => {
      if (isAll || !phIntg) {
        setEvents([]);
        return;
      }
      setEventsLoading(true);
      try {
        const { data: res, error: fnErr } =
          await supabaseClient.functions.invoke("helm-posthog-events", {
            body: { project_id: scope },
          });
        if (fnErr) throw fnErr;
        if (res?.error) throw new Error(res.error);
        setEvents((res?.events as PHEvent[]) ?? []);
      } catch (e) {
        toast.error("Event listesi alınamadı", {
          description: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setEventsLoading(false);
      }
    },
    [scope, isAll, phIntg],
  );

  useEffect(() => {
    if (!stepsConfigured && phIntg && !isAll) {
      loadEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepsConfigured, phIntg, isAll, scope]);

  // İlk yüklendiğinde mevcut step'leri pickedEvents'a koy
  useEffect(() => {
    if (phCfg.funnel_steps) {
      setPickedEvents(
        phCfg.funnel_steps
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    } else {
      setPickedEvents([]);
    }
  }, [phCfg.funnel_steps]);

  const toggleEvent = (name: string) => {
    setPickedEvents((prev) =>
      prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name],
    );
  };

  const saveFunnelSteps = () => {
    if (!phIntg) return;
    if (pickedEvents.length < 2) {
      toast.error("En az 2 adım seç");
      return;
    }
    const newConfig = {
      ...(phIntg.config ?? {}),
      funnel_steps: pickedEvents.join(", "),
    };
    update(
      {
        resource: "project_integrations",
        id: phIntg.id,
        values: { config: newConfig },
      },
      {
        onSuccess: () => {
          toast.success("Huni adımları kaydedildi");
          setEditing(false);
          invalidate({
            resource: "project_integrations",
            invalidates: ["list"],
          });
        },
      },
    );
  };

  const showPicker = !stepsConfigured || editing;

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

      {!isAll && phIntg && showPicker && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="size-4" />
              Huni adımlarını seç
            </CardTitle>
            <CardAction>
              <div className="flex items-center gap-2">
                {editing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(false);
                      setPickedEvents(
                        phCfg.funnel_steps
                          ?.split(",")
                          .map((s) => s.trim())
                          .filter(Boolean) ?? [],
                      );
                    }}
                  >
                    Vazgeç
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadEvents}
                  disabled={eventsLoading}
                >
                  <RefreshCw
                    className={`size-4 ${eventsLoading ? "animate-spin" : ""}`}
                  />
                  <span className="ml-2">Yenile</span>
                </Button>
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <div className="space-y-1">
                <div>
                  <strong>İdeal: 3-5 adım.</strong> 6+ adımda her drop küçük
                  görünür, conversion neredeyse hep %0 çıkar. Funnel ≠ event
                  log — kullanıcı yolculuğunun <strong>ana</strong>{" "}
                  kilometre taşlarını seç.
                </div>
                <div className="text-xs text-muted-foreground">
                  Tipik mobil oyun: <code>app_opened</code> →{" "}
                  <code>tutorial_complete</code> → <code>level_5</code> →{" "}
                  <code>first_purchase</code>
                </div>
              </div>
            </div>

            {eventsLoading && events.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Yükleniyor…
              </div>
            ) : events.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Event yok. PostHog'a hiç event geldi mi?
              </div>
            ) : (
              <div className="max-h-96 overflow-auto rounded-md border">
                <div className="grid grid-cols-1 gap-1 p-2 sm:grid-cols-2">
                  {events
                    .filter((e) => !e.system)
                    .slice(0, 60)
                    .map((e) => {
                      const picked = pickedEvents.includes(e.name);
                      const order = pickedEvents.indexOf(e.name) + 1;
                      return (
                        <button
                          key={e.name}
                          type="button"
                          onClick={() => toggleEvent(e.name)}
                          className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition-colors ${
                            picked
                              ? "border-primary/40 bg-primary/10"
                              : "border-transparent hover:bg-muted"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {picked && (
                              <Badge className="border-primary/30 bg-primary/20 text-primary tabular-nums">
                                {order}
                              </Badge>
                            )}
                            <code className="font-mono text-xs">{e.name}</code>
                          </span>
                          {e.volume_30_day !== null && (
                            <span className="font-mono text-xs text-muted-foreground tabular-nums">
                              {compact(e.volume_30_day)} / 30g
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {pickedEvents.length > 0 && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                <div className="mb-2 text-xs text-muted-foreground">
                  Seçim ({pickedEvents.length}):
                </div>
                <div className="flex flex-wrap gap-2">
                  {pickedEvents.map((e, i) => (
                    <Badge
                      key={e}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => toggleEvent(e)}
                      title="Tıkla → kaldır"
                    >
                      <span className="mr-1 font-mono">{i + 1}.</span>
                      <code>{e}</code>
                    </Badge>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={saveFunnelSteps}
                    disabled={pickedEvents.length < 2}
                  >
                    Kaydet ({pickedEvents.length} adım)
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPickedEvents([])}
                  >
                    Temizle
                  </Button>
                </div>
              </div>
            )}

            {events.filter((e) => e.system).length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  Sistem event'leri ($pageview, $autocapture, …)
                </summary>
                <div className="mt-2 flex flex-wrap gap-1">
                  {events
                    .filter((e) => e.system)
                    .slice(0, 30)
                    .map((e) => (
                      <button
                        key={e.name}
                        type="button"
                        onClick={() => toggleEvent(e.name)}
                        className="rounded border px-2 py-0.5 font-mono text-[10px] hover:bg-muted"
                      >
                        {e.name}
                      </button>
                    ))}
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {data && !showPicker && (
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
              icon={
                data.overall_conversion >= 50 ? (
                  <TrendingUp />
                ) : (
                  <TrendingDown />
                )
              }
              loading={loading}
            />
          </div>

          {data.steps.length > 6 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <span>
                <strong>{data.steps.length} adım çok fazla</strong> — her
                küçük adım toplam conversion'u baltalar. Sağ üstteki{" "}
                <strong>Adımları düzenle</strong> ile 3-5 ana kilometre taşına
                indir.
              </span>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                Onboarding Hunisi — son {days} gün
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {data.steps.length} adım · sıralı · unique user
                </span>
              </CardTitle>
              <CardAction>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(true);
                    loadEvents();
                  }}
                >
                  <Pencil className="size-4" />
                  <span className="ml-2">Adımları düzenle</span>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-1">
              {data.steps.map((s, i) => {
                const widthPct =
                  maxCount > 0 ? (s.count / maxCount) * 100 : 0;
                const isFirst = i === 0;
                const stepClass = isFirst
                  ? "bg-primary"
                  : s.step_pct >= 80
                    ? "bg-emerald-500"
                    : s.step_pct >= 40
                      ? "bg-amber-500"
                      : "bg-destructive";
                const stepLabelClass = isFirst
                  ? "text-muted-foreground"
                  : s.step_pct >= 80
                    ? "text-emerald-500"
                    : s.step_pct >= 40
                      ? "text-amber-500"
                      : "text-destructive";

                return (
                  <div key={`${s.event}-${i}`}>
                    {/* Drop indicator — bu adıma giriş oranı */}
                    {i > 0 && (
                      <div className="flex items-center gap-2 py-1.5 pl-6 text-xs">
                        <ArrowDown
                          className={cn("size-3.5", stepLabelClass)}
                        />
                        <span
                          className={cn(
                            "font-mono tabular-nums",
                            stepLabelClass,
                          )}
                        >
                          %{s.step_pct.toFixed(1)} kalan
                        </span>
                        {s.drop > 0 && (
                          <span className="font-mono tabular-nums text-muted-foreground">
                            · −{compact(s.drop)} kişi düştü
                          </span>
                        )}
                      </div>
                    )}

                    {/* Adım kartı */}
                    <div className="rounded-lg border bg-card/50 p-3">
                      <div className="mb-2 flex items-baseline justify-between gap-3">
                        <div className="flex min-w-0 items-baseline gap-2">
                          <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                            #{i + 1}
                          </span>
                          <code className="truncate font-mono text-sm font-medium">
                            {s.event}
                          </code>
                        </div>
                        <div className="flex shrink-0 items-baseline gap-3">
                          <span className="font-mono text-xl font-semibold tabular-nums">
                            {compact(s.count)}
                          </span>
                          <span className="w-14 text-right font-mono text-xs tabular-nums text-muted-foreground">
                            %{s.overall_pct.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "absolute inset-y-0 left-0 rounded-full transition-all",
                            stepClass,
                          )}
                          style={{
                            width: `${Math.max(widthPct, 0.5)}%`,
                          }}
                        />
                      </div>
                    </div>
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
