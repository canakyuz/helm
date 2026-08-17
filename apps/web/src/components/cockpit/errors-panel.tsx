import { useEffect, useMemo, useState } from "react";
import {
  AlertOctagon,
  ExternalLink,
  RefreshCw,
  Users as UsersIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabaseClient } from "@/providers/supabase-client";
import { compact } from "@/lib/metrics";
import { cn } from "@/lib/utils";

interface SentryIssue {
  id: string;
  short_id: string;
  title: string;
  culprit: string | null;
  level: string;
  count: number;
  user_count: number;
  first_seen: string;
  last_seen: string;
  permalink: string;
  status: string;
  type: string | null;
  value: string | null;
}

interface IssueProject {
  project_id: string;
  ok: boolean;
  issues?: SentryIssue[];
  error?: string;
}

interface ErrorsPanelProps {
  /** Sentry bağlı mı (Cockpit'te zaten bilinen değer; false ise panel gizlenir). */
  hasSentry: boolean;
  /** Proje id → ad eşlemesi (multi-project tabloda gösterilir). */
  projectName: (id: string) => string;
  /** Tek scope mu (true) yoksa tüm projeler mi? */
  isAll: boolean;
}

const fmt = (iso: string) => new Date(iso).toLocaleString("en-US");

const levelColor = (level: string) => {
  if (level === "fatal" || level === "error") return "text-destructive";
  if (level === "warning") return "text-amber-500";
  return "text-muted-foreground";
};

export const ErrorsPanel = ({
  hasSentry,
  projectName,
  isAll,
}: ErrorsPanelProps) => {
  const [issueProjects, setIssueProjects] = useState<IssueProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<
    (SentryIssue & { project_id: string }) | null
  >(null);

  const load = useMemo(
    () => async () => {
      if (!hasSentry) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error: fnErr } = await supabaseClient.functions.invoke(
          "helm-sentry-issues",
          { body: {} },
        );
        if (fnErr) throw fnErr;
        if (data?.error) throw new Error(data.error);
        setIssueProjects((data?.projects as IssueProject[]) ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [hasSentry],
  );

  useEffect(() => {
    if (hasSentry) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSentry]);

  const topIssues = useMemo(() => {
    const all: Array<SentryIssue & { project_id: string }> = [];
    for (const p of issueProjects) {
      if (p.ok && p.issues) {
        for (const i of p.issues) all.push({ ...i, project_id: p.project_id });
      }
    }
    return all.sort((a, b) => b.count - a.count);
  }, [issueProjects]);

  if (!hasSentry) {
    return (
      <Card className="overflow-hidden lg:col-span-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <AlertOctagon className="size-4 text-muted-foreground" />
              Hatalar
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid h-[calc(100%-2.5rem)] place-items-center text-xs text-muted-foreground">
          Sentry bağlı değil
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden lg:col-span-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <AlertOctagon className="size-4" />
              Hatalar
              <span className="text-[10px] font-normal text-muted-foreground">
                son 14g
              </span>
            </span>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-50"
              aria-label="Yenile"
            >
              <RefreshCw
                className={cn("size-3.5", loading && "animate-spin")}
              />
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[calc(100%-2.5rem)] overflow-y-auto p-0">
          {error ? (
            <div className="p-3 text-xs text-destructive">{error}</div>
          ) : loading && topIssues.length === 0 ? (
            <div className="grid h-full place-items-center text-xs text-muted-foreground">
              Yükleniyor…
            </div>
          ) : topIssues.length === 0 ? (
            <div className="grid h-full place-items-center text-xs text-muted-foreground">
              Açık hata yok
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-7 px-2 text-xs">Hata</TableHead>
                  {isAll && (
                    <TableHead className="h-7 px-2 text-xs">Proje</TableHead>
                  )}
                  <TableHead className="h-7 px-2 text-right text-xs">
                    Olay
                  </TableHead>
                  <TableHead className="h-7 px-2 text-right text-xs">
                    Kişi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topIssues.map((i) => (
                  <TableRow
                    key={`${i.project_id}-${i.id}`}
                    className="cursor-pointer"
                    onClick={() => setSelected(i)}
                  >
                    <TableCell className="max-w-0 px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "shrink-0 font-mono text-[10px] uppercase",
                            levelColor(i.level),
                          )}
                        >
                          {i.level.slice(0, 4)}
                        </span>
                        <span className="truncate text-xs font-medium">
                          {i.title}
                        </span>
                      </div>
                    </TableCell>
                    {isAll && (
                      <TableCell className="px-2 py-1.5 text-xs text-muted-foreground">
                        {projectName(i.project_id)}
                      </TableCell>
                    )}
                    <TableCell className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
                      {compact(i.count)}
                    </TableCell>
                    <TableCell className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
                      {compact(i.user_count)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Hata detay dialog'u */}
      <Dialog
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-start gap-2">
                  <Badge
                    variant={
                      selected.level === "fatal" || selected.level === "error"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {selected.level}
                  </Badge>
                  <span className="break-all">{selected.title}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                {selected.culprit && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Kaynak
                    </div>
                    <code className="block break-all rounded-md border bg-muted/50 p-2 text-xs">
                      {selected.culprit}
                    </code>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <KV label="Olay" value={compact(selected.count)} />
                  <KV
                    label="Etkilenen"
                    value={`${compact(selected.user_count)} people`}
                    icon={<UsersIcon className="size-3" />}
                  />
                  <KV label="Short ID" value={selected.short_id} mono />
                  <KV label="Durum" value={selected.status} />
                  <KV label="First seen" value={fmt(selected.first_seen)} />
                  <KV label="Last seen" value={fmt(selected.last_seen)} />
                  <KV
                    label="Proje"
                    value={projectName(selected.project_id)}
                  />
                  {selected.type && <KV label="Tip" value={selected.type} mono />}
                </div>
                {selected.value && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Mesaj
                    </div>
                    <pre className="max-h-48 overflow-auto rounded-md border bg-muted/50 p-2 text-xs">
                      {selected.value}
                    </pre>
                  </div>
                )}
                <div className="flex justify-end pt-2">
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={selected.permalink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="size-4" />
                      <span className="ml-2">Open in Sentry</span>
                    </a>
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

const KV = ({
  label,
  value,
  mono,
  icon,
}: {
  label: string;
  value: string;
  mono?: boolean;
  icon?: React.ReactNode;
}) => (
  <div>
    <div className="text-xs uppercase tracking-wide text-muted-foreground">
      {label}
    </div>
    <div
      className={cn(
        "mt-0.5 flex items-center gap-1 text-sm",
        mono && "font-mono text-xs",
      )}
    >
      {icon}
      {value}
    </div>
  </div>
);
