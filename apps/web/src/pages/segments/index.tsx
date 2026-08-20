import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useCreate, useDelete, useList } from "@refinedev/core";
import { ExternalLink, Layers, Plus, Trash2, UserCheck, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { supabaseClient } from "@/providers/supabase-client";
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
import type { Project, UserSegment } from "@/types";

const RULE_LABELS: Record<UserSegment["rule_type"], string> = {
  new: "New - signed up within the last N days",
  active: "Active - last sign-in within the last N days",
  inactive: "Dormant - last sign-in older than N days",
};

interface CountResult {
  count: number;
  sample: Array<{
    id: string;
    email: string | null;
    project_id: string;
    last_sign_in_at: string | null;
    created_at: string;
  }>;
  warning?: string;
}

export const SegmentsPage = () => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("all");
  const [ruleType, setRuleType] =
    useState<UserSegment["rule_type"]>("new");
  const [ruleDays, setRuleDays] = useState("7");

  const [counts, setCounts] = useState<Record<string, CountResult>>({});
  const [computing, setComputing] = useState<string | null>(null);
  const [sampleOpen, setSampleOpen] = useState<string | null>(null);

  const handleCompute = async (segmentId: string) => {
    setComputing(segmentId);
    try {
      const { data, error } = await supabaseClient.functions.invoke(
        "helm-segment-count",
        { body: { segment_id: segmentId } },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCounts((c) => ({
        ...c,
        [segmentId]: {
          count: data.count,
          sample: data.sample ?? [],
          warning: data.warning,
        },
      }));
      toast.success(`${data.count} users matched`, {
        description: data.warning ?? `${data.projects} projects scanned`,
      });
    } catch (e) {
      toast.error("Calculation failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setComputing(null);
    }
  };

  const { result, query } = useList<UserSegment>({
    resource: "user_segments",
    sorters: [{ field: "created_at", order: "desc" }],
    pagination: { mode: "off" },
  });
  const { result: projectsResult } = useList<Project>({
    resource: "projects",
    pagination: { mode: "off" },
  });
  const segments = result.data;
  const projects = projectsResult.data;

  const { mutate: create, mutation: createMutation } = useCreate();
  const { mutate: remove } = useDelete();

  const projectName = (id: string | null) =>
    id ? (projects.find((p) => p.id === id)?.name ?? "-") : "All projects";

  const reset = () => {
    setName("");
    setProjectId("all");
    setRuleType("new");
    setRuleDays("7");
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    create(
      {
        resource: "user_segments",
        values: {
          name: name.trim(),
          project_id: projectId === "all" ? null : projectId,
          rule_type: ruleType,
          rule_days: Number(ruleDays) || 7,
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

  // KPI hesapları - sadece hesaplanmış segmentleri kapsar
  const stats = useMemo(() => {
    const computed = Object.values(counts).map((c) => c.count);
    const total = computed.reduce((s, n) => s + n, 0);
    const max = computed.length > 0 ? Math.max(...computed) : 0;
    const min = computed.length > 0 ? Math.min(...computed) : 0;
    return {
      total: segments.length,
      computed: computed.length,
      matchedSum: total,
      largest: max,
      smallest: min,
    };
  }, [counts, segments]);

  const handleCreateFromTemplate = (tpl: typeof SEGMENT_TEMPLATES[number]) => {
    create({
      resource: "user_segments",
      values: {
        name: tpl.name,
        project_id: null,
        rule_type: tpl.rule_type,
        rule_days: tpl.rule_days,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Segmentler</h1>
        <div className="text-xs text-muted-foreground">
          {stats.total > 0 && (
            <>
              <span className="font-mono tabular-nums">{stats.total}</span>{" "}
              segment ·{" "}
              <span className="font-mono tabular-nums">
                {stats.computed}
              </span>{" "}
              hesaplandı
            </>
          )}
        </div>
      </div>

      {/* KPI cluster */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SegKpi label="Total segments" value={stats.total} icon={<Layers />} />
        <SegKpi
          label="Calculated"
          value={`${stats.computed} / ${stats.total}`}
          icon={<UserCheck />}
          tone={stats.computed === stats.total ? "emerald" : undefined}
        />
        <SegKpi
          label="Total matched"
          value={stats.matchedSum}
          icon={<Users />}
          tone="primary"
        />
        <SegKpi
          label="Max / Min"
          value={
            stats.computed > 0
              ? `${stats.largest} / ${stats.smallest}`
              : "-"
          }
          icon={<Layers />}
        />
      </div>

      {/* Şablonlar - segment hiç yoksa veya az ise göster */}
      {segments.length < 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick start</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {SEGMENT_TEMPLATES.map((t) => {
                const exists = segments.some(
                  (s) =>
                    s.name === t.name ||
                    (s.rule_type === t.rule_type && s.rule_days === t.rule_days),
                );
                return (
                  <button
                    key={t.name}
                    type="button"
                    disabled={exists}
                    onClick={() => handleCreateFromTemplate(t)}
                    className="rounded-md border bg-card/40 p-3 text-left text-xs hover:bg-card/80 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="font-medium text-sm">{t.name}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {t.description}
                    </div>
                    {exists && (
                      <div className="mt-2 text-[10px] text-emerald-500">
                        ✓ tanımlı
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>User segments</CardTitle>
          <CardAction>
            <Dialog
              open={open}
              onOpenChange={(o) => {
                setOpen(o);
                if (!o) reset();
              }}
            >
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="size-4" /> Segment ekle
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>User segment</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Segment name</Label>
                    <Input
                      placeholder="New players"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Project</Label>
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
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Rule</Label>
                      <Select
                        value={ruleType}
                        onValueChange={(v) =>
                          setRuleType(v as UserSegment["rule_type"])
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="active">Aktif</SelectItem>
                          <SelectItem value="inactive">Pasif</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Day</Label>
                      <Input
                        type="number"
                        value={ruleDays}
                        onChange={(e) => setRuleDays(e.target.value)}
                      />
                    </div>
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
          {segments.length === 0 && !query.isLoading ? (
            <EmptyState
              icon={<Layers className="size-6" />}
              title="No segments yet"
              description="A segment is a rule-defined group of users. It becomes a target for Mail and Push. Start with + above - e.g. Active users (signed in within 7d)."
              compact
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Segment</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead className="text-right">Matched</TableHead>
                  <TableHead className="w-32 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segments.map((s) => {
                  const c = counts[s.id];
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {projectName(s.project_id)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {RULE_LABELS[s.rule_type].replace(
                          "N",
                          String(s.rule_days),
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {c ? (
                          <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-500">
                            {c.count} kullanıcı
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            -
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Hesapla"
                            disabled={computing === s.id}
                            onClick={() => handleCompute(s.id)}
                          >
                            <UserCheck className="size-4" />
                          </Button>
                          {c && c.sample.length > 0 && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Sample users"
                              onClick={() => setSampleOpen(s.id)}
                            >
                              <Users className="size-4" />
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Delete"
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {s.name} silinsin mi?
                                </AlertDialogTitle>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    remove({
                                      resource: "user_segments",
                                      id: s.id,
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

      <p className="text-xs text-muted-foreground">
        Segmentler kullanıcı listesini filtrelemek için tanımlanır. "Hesapla"
        butonu Auth listUsers'i tarayıp kuralı uygular (ilk hesap birkaç saniye
        sürebilir).
      </p>

      <Dialog
        open={sampleOpen !== null}
        onOpenChange={(o) => !o && setSampleOpen(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {sampleOpen
                ? `${segments.find((s) => s.id === sampleOpen)?.name} - sample users (ilk 10)`
                : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Last sign-in</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(sampleOpen && counts[sampleOpen]?.sample) || sampleOpen
                  ? counts[sampleOpen]?.sample.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          {u.email ?? "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {projectName(u.project_id)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {u.last_sign_in_at
                            ? new Date(u.last_sign_in_at).toLocaleString(
                                "en-US",
                              )
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            asChild
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Go to user"
                          >
                            <Link to={`/users/${u.id}`}>
                              <ExternalLink className="size-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  : null}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SEGMENT_TEMPLATES: Array<{
  name: string;
  description: string;
  rule_type: UserSegment["rule_type"];
  rule_days: number;
}> = [
  {
    name: "New users (7d)",
    description: "Signed up within 7 days - optimise onboarding",
    rule_type: "new",
    rule_days: 7,
  },
  {
    name: "Active users (30d)",
    description: "Signed in within 30 days - campaign target",
    rule_type: "active",
    rule_days: 30,
  },
  {
    name: "At risk (14d)",
    description: "Inactive for 14 days - win-back email",
    rule_type: "inactive",
    rule_days: 14,
  },
  {
    name: "Lost users (60d)",
    description: "Gone for 60 days - last-chance campaign",
    rule_type: "inactive",
    rule_days: 60,
  },
];

const SegKpi = ({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: "emerald" | "primary";
}) => {
  const toneCls =
    tone === "emerald"
      ? "text-emerald-500"
      : tone === "primary"
        ? "text-primary"
        : "text-foreground";
  return (
    <div className="rounded-lg border bg-card/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span className="[&>svg]:size-3.5">{icon}</span>
        {label}
      </div>
      <div className={`mt-1 font-mono text-2xl tabular-nums ${toneCls}`}>
        {value}
      </div>
    </div>
  );
};
