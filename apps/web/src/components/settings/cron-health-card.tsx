import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabaseClient } from "@/providers/supabase-client";

interface CronRun {
  runid: number;
  job_pid: number | null;
  start_time: string;
  end_time: string | null;
  status: string; // succeeded / failed / running
  return_message: string | null;
}

interface CronJob {
  jobname: string;
  schedule: string;
  active: boolean;
  last_runs: CronRun[];
}

const fmt = (iso: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  const diffMin = (Date.now() - d.getTime()) / 60_000;
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${Math.round(diffMin)}m ago`;
  if (diffMin < 1440) return `${Math.round(diffMin / 60)}h ago`;
  return d.toLocaleString("en-US");
};

export const CronHealthCard = () => {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    setHint(null);
    try {
      const { data, error: fnErr } = await supabaseClient.functions.invoke(
        "helm-cron-health",
        { body: { limit: 10 } },
      );
      if (fnErr) throw fnErr;
      if (data?.error) {
        setError(data.error);
        if (data?.hint) setHint(data.hint);
        return;
      }
      setJobs((data?.jobs as CronJob[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-4" />
          Cron dispatch
        </CardTitle>
        <CardDescription>
          Whether pg_cron fired the job - not whether the ingest worked.{" "}
          <code className="font-mono">net.http_post</code> is asynchronous, so a
          run is marked succeeded the moment the request is queued (note the
          ~40&nbsp;ms durations). The real outcome lives in{" "}
          <code className="font-mono">sync_runs</code>, shown above.
        </CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw
              className={loading ? "size-4 animate-spin" : "size-4"}
            />
            <span className="ml-2">Refresh</span>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="space-y-2">
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
            {hint && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-400">
                {hint}
              </div>
            )}
          </div>
        ) : loading && jobs.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No cron job with a <code>helm-*</code> prefix.
            <br />
            Install <code>helm-ingest-hourly</code> with{" "}
            <code className="text-xs">scripts/p0-cron-bootstrap.sql</code>.
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((j) => {
              const last = j.last_runs[0];
              const isOpen = expanded === j.jobname;
              return (
                <div
                  key={j.jobname}
                  className="rounded-md border bg-card/40"
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : j.jobname)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-2">
                      {isOpen ? (
                        <ChevronDown className="size-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-3.5 text-muted-foreground" />
                      )}
                      <code className="font-mono text-sm font-medium">
                        {j.jobname}
                      </code>
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {j.schedule}
                      </Badge>
                      {j.active ? (
                        <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-500 text-[10px]">
                          active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          inactive
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {last ? (
                        <>
                          {last.status === "succeeded" ? (
                            <CheckCircle2 className="size-3.5 text-emerald-500" />
                          ) : (
                            <AlertCircle className="size-3.5 text-destructive" />
                          )}
                          <span className="text-muted-foreground">
                            {fmt(last.start_time)}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          hiç
                        </span>
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t bg-muted/20 px-3 py-2">
                      {j.last_runs.length === 0 ? (
                        <div className="py-2 text-center text-xs text-muted-foreground">
                          Henüz çalışmadı
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="grid grid-cols-[100px_1fr_70px_60px] gap-2 px-1 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                            <span>Start</span>
                            <span>Result</span>
                            <span className="text-right">Duration</span>
                            <span className="text-right">Status</span>
                          </div>
                          {j.last_runs.map((r) => {
                            const dur =
                              r.end_time && r.start_time
                                ? (new Date(r.end_time).getTime() -
                                    new Date(r.start_time).getTime()) /
                                  1000
                                : null;
                            return (
                              <div
                                key={r.runid}
                                className="grid grid-cols-[100px_1fr_70px_60px] items-center gap-2 px-1 py-1 text-xs"
                              >
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  {new Date(r.start_time).toLocaleString(
                                    "en-US",
                                  )}
                                </span>
                                <span className="truncate text-xs text-muted-foreground">
                                  {r.return_message ?? "-"}
                                </span>
                                <span className="text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                                  {dur !== null ? `${dur.toFixed(1)}s` : "-"}
                                </span>
                                <span className="text-right">
                                  {r.status === "succeeded" ? (
                                    <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-500 text-[10px]">
                                      ✓
                                    </Badge>
                                  ) : r.status === "failed" ? (
                                    <Badge
                                      variant="destructive"
                                      className="text-[10px]"
                                    >
                                      ✗
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px]"
                                    >
                                      {r.status}
                                    </Badge>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
