import { useMemo, useState } from "react";
import { useCreate, useDelete, useList } from "@refinedev/core";
import { AlertOctagon, Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { TrendChart } from "@/components/trend-chart";
import { compact, deltaPct, latest, series } from "@/lib/metrics";
import {
  PROVIDER_LABELS,
  type Heartbeat,
  type Metric,
  type Project,
  type ProjectIntegration,
  type SyncRun,
} from "@/types";

const HEARTBEAT_BASE = `${
  import.meta.env.VITE_HELM_SUPABASE_URL
}/functions/v1/helm-heartbeat?id=`;

const INTERVALS = [
  { value: "15", label: "15 dakika" },
  { value: "60", label: "Saatlik" },
  { value: "360", label: "6 saat" },
  { value: "1440", label: "Günlük" },
];

const fmt = (value: string | null) =>
  value ? new Date(value).toLocaleString("tr-TR") : "—";

export const SystemPage = () => {
  const since90 = useMemo(
    () => new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10),
    [],
  );

  const { result: runsResult } = useList<SyncRun>({
    resource: "sync_runs",
    sorters: [{ field: "started_at", order: "desc" }],
    pagination: { mode: "off" },
  });
  const { result: integResult } = useList<ProjectIntegration>({
    resource: "project_integrations",
    pagination: { mode: "off" },
  });
  const { result: projectsResult } = useList<Project>({
    resource: "projects",
    pagination: { mode: "off" },
  });
  const { result: hbResult } = useList<Heartbeat>({
    resource: "heartbeats",
    pagination: { mode: "off" },
  });
  const { result: errorsResult } = useList<Metric>({
    resource: "metrics",
    filters: [
      { field: "metric", operator: "eq", value: "errors" },
      { field: "date", operator: "gte", value: since90 },
    ],
    pagination: { mode: "off" },
  });

  const runs = runsResult.data;
  const integrations = integResult.data;
  const heartbeats = hbResult.data;
  const errors = errorsResult.data;
  const projectName = (id: string) =>
    projectsResult.data.find((p) => p.id === id)?.name ?? "—";

  const errorSeries = useMemo(() => series(errors, "errors"), [errors]);
  const errorLatest = latest(errors, "errors");
  const errorDelta = deltaPct(errorSeries);

  // Son 7 gün proje kırılımı — Sentry bağlı projelerin toplam hatası.
  const errorsByProject = useMemo(() => {
    const since7 = new Date(Date.now() - 7 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const totals = new Map<string, number>();
    for (const m of errors) {
      if (m.date < since7) continue;
      totals.set(m.project_id, (totals.get(m.project_id) ?? 0) + Number(m.value));
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [errors]);

  const hasSentry = integrations.some(
    (it) => it.provider === "sentry" && it.enabled,
  );

  const { mutate: create, mutation: createMutation } = useCreate();
  const { mutate: remove } = useDelete();

  const [open, setOpen] = useState(false);
  const [hbName, setHbName] = useState("");
  const [hbInterval, setHbInterval] = useState("1440");

  const handleCreate = () => {
    if (!hbName.trim()) return;
    create(
      {
        resource: "heartbeats",
        values: {
          name: hbName.trim(),
          interval_minutes: Number(hbInterval),
        },
      },
      {
        onSuccess: () => {
          setOpen(false);
          setHbName("");
          setHbInterval("1440");
        },
      },
    );
  };

  const hbStatus = (hb: Heartbeat) => {
    if (!hb.last_ping_at) return "pending";
    const overdueMs = (hb.interval_minutes + 15) * 60_000;
    return Date.now() - new Date(hb.last_ping_at).getTime() > overdueMs
      ? "stale"
      : "ok";
  };

  const statusBadge = (it: ProjectIntegration) => {
    if (it.last_sync_status === "ok") {
      return (
        <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-500">
          sağlıklı
        </Badge>
      );
    }
    if (it.last_sync_status === "error") {
      return <Badge variant="destructive">hata</Badge>;
    }
    return <Badge variant="secondary">beklemede</Badge>;
  };

  const copyUrl = (id: string) => {
    navigator.clipboard.writeText(`${HEARTBEAT_BASE}${id}`);
    toast.success("Ping URL kopyalandı");
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Senkron & Sağlık
      </h1>

      {/* Hatalar (Sentry) — sadece bağlı projeler için göster */}
      {hasSentry && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertOctagon className="size-4" />
              Hatalar — son 90 gün
            </CardTitle>
            <CardAction>
              <div className="text-right text-sm">
                <div className="font-mono text-lg">{compact(errorLatest)}</div>
                <div
                  className={
                    errorDelta === null
                      ? "text-xs text-muted-foreground"
                      : errorDelta > 0
                        ? "text-xs text-destructive"
                        : "text-xs text-emerald-500"
                  }
                >
                  {errorDelta === null
                    ? "son gün"
                    : `${errorDelta > 0 ? "+" : ""}${errorDelta.toFixed(1)}% / 7g`}
                </div>
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <TrendChart
              data={errorSeries}
              color="#ef4444"
              format={compact}
              height={180}
            />
            {errorsByProject.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proje</TableHead>
                    <TableHead className="text-right">Son 7g hata</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errorsByProject.map(([pid, total]) => (
                    <TableRow key={pid}>
                      <TableCell className="font-medium">
                        {projectName(pid)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {compact(total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Veri Kaynağı Sağlığı */}
      <Card>
        <CardHeader>
          <CardTitle>Veri Kaynağı Sağlığı</CardTitle>
        </CardHeader>
        <CardContent>
          {integrations.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Bağlı veri kaynağı yok
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proje</TableHead>
                  <TableHead>Kaynak</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Son senkron</TableHead>
                  <TableHead>Hata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {integrations.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">
                      {projectName(it.project_id)}
                    </TableCell>
                    <TableCell>{PROVIDER_LABELS[it.provider]}</TableCell>
                    <TableCell>{statusBadge(it)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {fmt(it.last_synced_at)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-destructive">
                      {it.last_sync_error ?? ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Heartbeat İzleyiciler */}
      <Card>
        <CardHeader>
          <CardTitle>Heartbeat İzleyiciler</CardTitle>
          <CardAction>
            <Dialog open={open} onOpenChange={setOpen}>
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="size-4" /> Ekle
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Heartbeat izleyici</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Ad</Label>
                    <Input
                      placeholder="push-scheduler cron"
                      value={hbName}
                      onChange={(e) => setHbName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Beklenen aralık</Label>
                    <Select
                      value={hbInterval}
                      onValueChange={setHbInterval}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INTERVALS.map((i) => (
                          <SelectItem key={i.value} value={i.value}>
                            {i.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Vazgeç
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={!hbName.trim() || createMutation.isPending}
                  >
                    Kaydet
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          {heartbeats.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Heartbeat izleyici yok. Bir cron job'unun çalıştığını
              doğrulamak için ekle.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>İzleyici</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Son ping</TableHead>
                  <TableHead>Ping URL</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {heartbeats.map((hb) => {
                  const status = hbStatus(hb);
                  return (
                    <TableRow key={hb.id}>
                      <TableCell className="font-medium">
                        {hb.name}
                      </TableCell>
                      <TableCell>
                        {status === "ok" && (
                          <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-500">
                            canlı
                          </Badge>
                        )}
                        {status === "stale" && (
                          <Badge variant="destructive">gecikti</Badge>
                        )}
                        {status === "pending" && (
                          <Badge variant="secondary">ping bekleniyor</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {fmt(hb.last_ping_at)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => copyUrl(hb.id)}
                        >
                          <Copy className="size-3.5" /> Kopyala
                        </Button>
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Sil"
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {hb.name} silinsin mi?
                              </AlertDialogTitle>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  remove({
                                    resource: "heartbeats",
                                    id: hb.id,
                                  })
                                }
                              >
                                Sil
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <p className="text-xs text-muted-foreground">
            İzlenen cron/job'un sonuna ping URL'ine bir istek ekle. Ping
            beklenen aralık + 15 dk içinde gelmezse durum "gecikti" olur.
          </p>
        </CardContent>
      </Card>

      {/* Senkron Geçmişi */}
      <Card>
        <CardHeader>
          <CardTitle>Senkron Geçmişi</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
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
                {runs.slice(0, 20).map((r) => (
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
