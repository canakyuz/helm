import { useEffect, useMemo, useState } from "react";
import {
  useCreate,
  useDelete,
  useInvalidate,
  useList,
  useUpdate,
} from "@refinedev/core";
import {
  Activity,
  Bell,
  BellRing,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Zap,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/stat-card";
import { supabaseClient } from "@/providers/supabase-client";
import type {
  AlertCondition,
  AlertEvent,
  AlertRule,
  Project,
} from "@/types";

const METRICS: Record<string, string> = {
  dau: "DAU",
  mau: "MAU",
  ad_revenue: "Reklam Geliri",
  mrr: "MRR",
  total_users: "Total users",
  new_users: "New user",
  errors: "Error count",
  app_revenue: "Store revenue",
};

const CONDITIONS: Record<AlertCondition, string> = {
  drop_pct: "% down",
  rise_pct: "% up",
  below: "dropped below the value",
  above: "rose above the value",
};

const EVENT_PAGE = 20;

export const AlertsPage = () => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("all");
  const [metric, setMetric] = useState("dau");
  const [condition, setCondition] = useState<AlertCondition>("drop_pct");
  const [threshold, setThreshold] = useState("20");
  const [channel, setChannel] = useState<"telegram" | "email">("telegram");

  const [evaluating, setEvaluating] = useState(false);
  const [testingRule, setTestingRule] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [eventChannel, setEventChannel] = useState<string>("all");
  const [eventSearch, setEventSearch] = useState("");
  const [eventPage, setEventPage] = useState(0);
  const [selected, setSelected] = useState<AlertEvent | null>(null);
  const invalidate = useInvalidate();

  const { result, query } = useList<AlertRule>({
    resource: "alert_rules",
    sorters: [{ field: "created_at", order: "desc" }],
    pagination: { mode: "off" },
  });
  const { result: projectsResult } = useList<Project>({
    resource: "projects",
    pagination: { mode: "off" },
  });
  const { result: eventsResult } = useList<AlertEvent>({
    resource: "alert_events",
    sorters: [{ field: "triggered_at", order: "desc" }],
    pagination: { mode: "off" },
  });
  const rules = result.data;
  const projects = projectsResult.data;
  const events = eventsResult.data;

  // Summary stats
  const stats = useMemo(() => {
    const enabled = rules.filter((r) => r.enabled).length;
    const since24h = Date.now() - 24 * 3_600_000;
    const last24h = events.filter(
      (e) => new Date(e.triggered_at).getTime() >= since24h,
    );
    const delivered = events.filter((e) => e.delivered).length;
    const deliveryRate =
      events.length > 0 ? Math.round((delivered / events.length) * 100) : 0;
    return {
      enabled,
      total: rules.length,
      last24h: last24h.length,
      deliveryRate,
    };
  }, [rules, events]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    const needle = eventSearch.trim().toLowerCase();
    return events.filter((e) => {
      if (eventFilter !== "all" && e.rule_id !== eventFilter) return false;
      if (eventChannel === "delivered" && !e.delivered) return false;
      if (eventChannel === "pending" && e.delivered) return false;
      if (needle && !(e.message ?? "").toLowerCase().includes(needle))
        return false;
      return true;
    });
  }, [events, eventFilter, eventChannel, eventSearch]);

  useEffect(() => {
    setEventPage(0);
  }, [eventFilter, eventChannel, eventSearch]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredEvents.length / EVENT_PAGE),
  );
  const pageData = filteredEvents.slice(
    eventPage * EVENT_PAGE,
    (eventPage + 1) * EVENT_PAGE,
  );

  const handleEvaluate = async () => {
    setEvaluating(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke(
        "helm-alert",
        { body: {} },
      );
      if (error) throw error;
      toast.success("Evaluation complete", {
        description: `${data?.evaluated ?? 0} kural kontrol edildi, ${
          data?.triggered ?? 0
        } uyarı tetiklendi.`,
      });
      invalidate({ resource: "alert_events", invalidates: ["list"] });
    } catch (e) {
      toast.error("Evaluation failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setEvaluating(false);
    }
  };

  const handleTestRule = async (ruleId: string) => {
    setTestingRule(ruleId);
    try {
      const { data, error } = await supabaseClient.functions.invoke(
        "helm-alert",
        { body: { rule_id: ruleId } },
      );
      if (error) throw error;
      const rule = rules.find((r) => r.id === ruleId);
      if (data?.triggered > 0) {
        toast.warning(`Kural tetiklendi: ${rule?.name}`, {
          description: "Olaylar tablosunda detay var.",
        });
      } else {
        toast.success(`Rule evaluated: ${rule?.name}`, {
          description: "Threshold not exceeded, nothing triggered.",
        });
      }
      invalidate({ resource: "alert_events", invalidates: ["list"] });
    } catch (e) {
      toast.error("Test failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setTestingRule(null);
    }
  };

  const { mutate: create, mutation: createMutation } = useCreate();
  const { mutate: update } = useUpdate();
  const { mutate: remove } = useDelete();

  const projectName = (id: string | null) =>
    id ? (projects.find((p) => p.id === id)?.name ?? "—") : "All projects";
  const ruleName = (id: string) =>
    rules.find((r) => r.id === id)?.name ?? id.slice(0, 8);

  const reset = () => {
    setName("");
    setProjectId("all");
    setMetric("dau");
    setCondition("drop_pct");
    setThreshold("20");
    setChannel("telegram");
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    create(
      {
        resource: "alert_rules",
        values: {
          name: name.trim(),
          project_id: projectId === "all" ? null : projectId,
          metric,
          condition,
          threshold: Number(threshold) || 0,
          channel,
          enabled: true,
        },
      },
      {
        onSuccess: () => {
          setOpen(false);
          reset();
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
        <Button
          variant="outline"
          onClick={handleEvaluate}
          disabled={evaluating}
        >
          <RefreshCw
            className={evaluating ? "size-4 animate-spin" : "size-4"}
          />
          Şimdi değerlendir
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          title="Aktif Kural"
          value={`${stats.enabled} / ${stats.total}`}
          icon={<Activity />}
        />
        <StatCard
          title="Son 24s Tetik"
          value={stats.last24h}
          icon={<Bell />}
        />
        <StatCard
          title="Toplam Olay"
          value={events.length}
          icon={<Bell />}
        />
        <StatCard
          title="Delivery rate"
          value={`%${stats.deliveryRate}`}
          icon={<CheckCircle2 />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alert rules</CardTitle>
          <CardAction>
            <Dialog
              open={open}
              onOpenChange={(o) => {
                setOpen(o);
                if (!o) reset();
              }}
            >
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="size-4" /> Kural ekle
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New alert rule</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Rule name</Label>
                    <Input
                      placeholder="DAU drop alert"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Proje</Label>
                    <Select value={projectId} onValueChange={setProjectId}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All projects</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id as string}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Metrik</Label>
                      <Select value={metric} onValueChange={setMetric}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(METRICS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Condition</Label>
                      <Select
                        value={condition}
                        onValueChange={(v) =>
                          setCondition(v as AlertCondition)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(CONDITIONS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Threshold</Label>
                      <Input
                        type="number"
                        value={threshold}
                        onChange={(e) => setThreshold(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Kanal</Label>
                    <Select
                      value={channel}
                      onValueChange={(v) =>
                        setChannel(v as "telegram" | "email")
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="telegram">Telegram</SelectItem>
                        <SelectItem value="email">E-posta</SelectItem>
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
                    disabled={!name.trim() || createMutation.isPending}
                  >
                    Kaydet
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardAction>
        </CardHeader>
        <CardContent>
          {rules.length === 0 && !query.isLoading ? (
            <EmptyState
              icon={<Zap className="size-6" />}
              title="No alert rules yet"
              description={
                <>
                  Kural ekle ile başla — örn.{" "}
                  <strong>"DAU down 20% over 7d → Telegram"</strong> veya{" "}
                  <strong>"Error count went above 100 → email"</strong>.
                </>
              }
              compact
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kural</TableHead>
                  <TableHead>Kapsam</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Kanal</TableHead>
                  <TableHead className="text-right">7g</TableHead>
                  <TableHead>Aktif</TableHead>
                  <TableHead className="w-24 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((r) => {
                  const ruleEvents = events.filter((e) => e.rule_id === r.id);
                  const lastWeek = ruleEvents.filter(
                    (e) =>
                      Date.now() - new Date(e.triggered_at).getTime() <=
                      7 * 86_400_000,
                  );
                  return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {projectName(r.project_id)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {METRICS[r.metric] ?? r.metric} {CONDITIONS[r.condition]}{" "}
                      {r.threshold}
                      {r.condition.endsWith("_pct") ? "%" : ""}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.channel === "telegram" ? "Telegram" : "E-posta"}
                    </TableCell>
                    <TableCell className="text-right">
                      {lastWeek.length > 0 ? (
                        <Badge
                          variant="secondary"
                          className="font-mono tabular-nums"
                        >
                          {lastWeek.length}×
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={r.enabled}
                        onCheckedChange={(checked) =>
                          update({
                            resource: "alert_rules",
                            id: r.id,
                            values: { enabled: checked },
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Test et"
                          disabled={testingRule === r.id}
                          onClick={() => handleTestRule(r.id as string)}
                          title="Evaluate this rule now"
                        >
                          <Zap
                            className={cn(
                              "size-4",
                              testingRule === r.id && "animate-pulse",
                            )}
                          />
                        </Button>
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
                                Kural silinsin mi?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {r.name} kuralı kaldırılacak.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  remove({
                                    resource: "alert_rules",
                                    id: r.id,
                                  })
                                }
                              >
                                Sil
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Triggered alerts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Mesaj ara…"
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All rules</SelectItem>
                {rules.map((r) => (
                  <SelectItem key={r.id} value={r.id as string}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={eventChannel} onValueChange={setEventChannel}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="delivered">Sent</SelectItem>
                <SelectItem value="pending">In-panel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredEvents.length === 0 ? (
            <EmptyState
              icon={<BellRing className="size-6" />}
              title={
                events.length === 0
                  ? "No alerts triggered yet"
                  : "Filtreye uyan olay yok"
              }
              description={
                events.length === 0
                  ? "The cron checks the rules hourly; anything over threshold is listed here. Use Evaluate now to trigger it manually."
                  : "Loosen the filter or pick All rules / All statuses."
              }
              compact
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zaman</TableHead>
                    <TableHead>Kural</TableHead>
                    <TableHead>Metrik</TableHead>
                    <TableHead>Mesaj</TableHead>
                    <TableHead>Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageData.map((e) => (
                    <TableRow
                      key={e.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(e)}
                    >
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(e.triggered_at).toLocaleString("en-US")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {ruleName(e.rule_id)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {METRICS[e.metric] ?? e.metric}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md truncate text-xs text-muted-foreground">
                        {e.message}
                      </TableCell>
                      <TableCell>
                        {e.delivered ? (
                          <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-500">
                            gönderildi
                          </Badge>
                        ) : (
                          <Badge variant="secondary">in-panel</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {eventPage * EVENT_PAGE + 1}–
                  {Math.min(
                    filteredEvents.length,
                    (eventPage + 1) * EVENT_PAGE,
                  )}{" "}
                  / {filteredEvents.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={eventPage === 0}
                    onClick={() => setEventPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="px-2 tabular-nums">
                    {eventPage + 1} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={eventPage >= totalPages - 1}
                    onClick={() =>
                      setEventPage((p) => Math.min(totalPages - 1, p + 1))
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

      {/* Event detay dialog */}
      <Dialog
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Bell className="size-4" />
                  {ruleName(selected.rule_id)}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <KV
                    label="Zaman"
                    value={new Date(selected.triggered_at).toLocaleString(
                      "en-US",
                    )}
                  />
                  <KV
                    label="Metrik"
                    value={METRICS[selected.metric] ?? selected.metric}
                  />
                  <KV
                    label="Durum"
                    value={selected.delivered ? "sent" : "in-panel"}
                  />
                  <KV label="ID" value={String(selected.id)} mono />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Mesaj
                  </div>
                  <div className="mt-1 rounded-md border bg-muted/50 p-3 text-sm">
                    {selected.message}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <p className="text-xs text-muted-foreground">
        Kurallar her senkron sonrası otomatik değerlendirilir. Telegram'a ping
        için Edge Function ortamına <code>TELEGRAM_BOT_TOKEN</code> +{" "}
        <code>TELEGRAM_CHAT_ID</code> eklenmeli; eklenene kadar uyarılar
        panel-içi kaydedilir.
      </p>
    </div>
  );
};

const KV = ({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) => (
  <div>
    <div className="text-xs uppercase tracking-wide text-muted-foreground">
      {label}
    </div>
    <div className={`mt-0.5 ${mono ? "font-mono text-xs" : "text-sm"}`}>
      {value}
    </div>
  </div>
);
