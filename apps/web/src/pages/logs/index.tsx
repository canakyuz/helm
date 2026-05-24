import { useEffect, useMemo, useState } from "react";
import { useList } from "@refinedev/core";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/stat-card";
import type { Project, SyncRun } from "@/types";

interface RunDetail {
  provider?: string;
  project_id?: string;
  points?: number;
  country_points?: number;
  error?: string;
}

const PAGE = 30;

export const LogsPage = () => {
  const { result, query } = useList<SyncRun>({
    resource: "sync_runs",
    sorters: [{ field: "started_at", order: "desc" }],
    pagination: { mode: "off" },
  });
  const runs = result.data;
  const [selected, setSelected] = useState<SyncRun | null>(null);
  const [triggerFilter, setTriggerFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const { result: projResult } = useList<Project>({
    resource: "projects",
    pagination: { mode: "off" },
  });
  const projectName = (id: string) =>
    projResult.data.find((p) => p.id === id)?.name ?? id.slice(0, 8);

  const duration = (r: SyncRun) => {
    if (!r.finished_at) return "—";
    const ms =
      new Date(r.finished_at).getTime() - new Date(r.started_at).getTime();
    return `${(ms / 1000).toFixed(1)} sn`;
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return runs.filter((r) => {
      if (triggerFilter !== "all" && r.trigger !== triggerFilter) return false;
      if (statusFilter === "error" && r.error_count === 0) return false;
      if (statusFilter === "ok" && r.error_count > 0) return false;
      if (needle) {
        const detStr = JSON.stringify(r.details ?? {}).toLowerCase();
        if (!detStr.includes(needle)) return false;
      }
      return true;
    });
  }, [runs, triggerFilter, statusFilter, q]);

  useEffect(() => setPage(0), [triggerFilter, statusFilter, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageData = filtered.slice(page * PAGE, (page + 1) * PAGE);

  const errorRate =
    runs.length > 0
      ? (runs.filter((r) => r.error_count > 0).length / runs.length) * 100
      : 0;
  const totalIngested = runs.reduce((s, r) => s + r.ingested, 0);
  const avgDuration =
    runs.length > 0
      ? runs
          .filter((r) => r.finished_at)
          .reduce(
            (s, r) =>
              s +
              (new Date(r.finished_at!).getTime() -
                new Date(r.started_at).getTime()),
            0,
          ) / Math.max(1, runs.filter((r) => r.finished_at).length)
      : 0;

  const details = (selected?.details as RunDetail[] | null) ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Loglar</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard title="Çalışma" value={runs.length} />
        <StatCard
          title="Toplam metrik"
          value={totalIngested.toLocaleString("tr-TR")}
        />
        <StatCard
          title="Ortalama süre"
          value={`${(avgDuration / 1000).toFixed(1)} sn`}
        />
        <StatCard title="Hata oranı" value={`%${errorRate.toFixed(1)}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Senkron Çalışmaları</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Sağlayıcı/hata mesajı ara…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={triggerFilter} onValueChange={setTriggerFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm tetikleyici</SelectItem>
                <SelectItem value="cron">Otomatik (cron)</SelectItem>
                <SelectItem value="manual">Manuel</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm durumlar</SelectItem>
                <SelectItem value="ok">Sadece başarılı</SelectItem>
                <SelectItem value="error">Sadece hatalı</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 && !query.isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {runs.length === 0
                ? "Henüz senkron çalışmadı"
                : "Filtreye uyan kayıt yok"}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zaman</TableHead>
                    <TableHead>Tetikleyici</TableHead>
                    <TableHead className="text-right">Süre</TableHead>
                    <TableHead className="text-right">Metrik</TableHead>
                    <TableHead className="text-right">OK / Hata</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageData.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(r)}
                    >
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(r.started_at).toLocaleString("tr-TR")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {r.trigger === "cron" ? "otomatik" : "manuel"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {duration(r)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {r.ingested}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.error_count > 0 ? (
                          <Badge variant="destructive">
                            {r.ok_count}/{r.error_count + r.ok_count}
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

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {page * PAGE + 1}–
                  {Math.min(filtered.length, (page + 1) * PAGE)} /{" "}
                  {filtered.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="px-2 tabular-nums">
                    {page + 1} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={page >= totalPages - 1}
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Senkron detayı —{" "}
              {selected &&
                new Date(selected.started_at).toLocaleString("tr-TR")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {details.length === 0 ? (
              <p className="text-sm text-muted-foreground">Detay yok.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sağlayıcı</TableHead>
                    <TableHead>Proje</TableHead>
                    <TableHead className="text-right">Metrik</TableHead>
                    <TableHead className="text-right">Ülke</TableHead>
                    <TableHead>Sonuç</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {details.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">
                        {d.provider ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {d.project_id ? projectName(d.project_id) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {d.points ?? 0}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {d.country_points ?? 0}
                      </TableCell>
                      <TableCell>
                        {d.error ? (
                          <span className="text-xs text-destructive">
                            {d.error}
                          </span>
                        ) : (
                          <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-500">
                            ok
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
