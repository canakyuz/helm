import { useState } from "react";
import { Link } from "react-router";
import { useCreate, useDelete, useList } from "@refinedev/core";
import { ExternalLink, Plus, Trash2, UserCheck, Users } from "lucide-react";
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
  new: "Yeni — kayıt son N gün içinde",
  active: "Aktif — son giriş son N gün içinde",
  inactive: "Pasif — son giriş N günden eski",
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
      toast.success(`${data.count} kullanıcı eşleşti`, {
        description: data.warning ?? `${data.projects} proje tarandı`,
      });
    } catch (e) {
      toast.error("Hesaplama başarısız", {
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
    id ? (projects.find((p) => p.id === id)?.name ?? "—") : "Tüm Projeler";

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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Segmentler</h1>

      <Card>
        <CardHeader>
          <CardTitle>Kullanıcı Segmentleri</CardTitle>
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
                  <DialogTitle>Kullanıcı segmenti</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Segment adı</Label>
                    <Input
                      placeholder="Yeni oyuncular"
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
                        <SelectItem value="all">Tüm Projeler</SelectItem>
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
                      <Label>Kural</Label>
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
                          <SelectItem value="new">Yeni</SelectItem>
                          <SelectItem value="active">Aktif</SelectItem>
                          <SelectItem value="inactive">Pasif</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Gün</Label>
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
            <div className="py-8 text-center text-sm text-muted-foreground">
              Henüz segment yok
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Segment</TableHead>
                  <TableHead>Proje</TableHead>
                  <TableHead>Kural</TableHead>
                  <TableHead className="text-right">Eşleşen</TableHead>
                  <TableHead className="w-32 text-right">İşlem</TableHead>
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
                            —
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
                              aria-label="Örnek kullanıcılar"
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
                                aria-label="Sil"
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
                                <AlertDialogCancel>Vazgeç</AlertDialogCancel>
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
                ? `${segments.find((s) => s.id === sampleOpen)?.name} — örnek kullanıcılar (ilk 10)`
                : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-posta</TableHead>
                  <TableHead>Proje</TableHead>
                  <TableHead>Son giriş</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(sampleOpen && counts[sampleOpen]?.sample) || sampleOpen
                  ? counts[sampleOpen]?.sample.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          {u.email ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {projectName(u.project_id)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {u.last_sign_in_at
                            ? new Date(u.last_sign_in_at).toLocaleString(
                                "tr-TR",
                              )
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            asChild
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Kullanıcıya git"
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
