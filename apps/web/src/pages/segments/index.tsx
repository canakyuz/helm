import { useState } from "react";
import { useCreate, useDelete, useList } from "@refinedev/core";
import { Plus, Trash2 } from "lucide-react";
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

export const SegmentsPage = () => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("all");
  const [ruleType, setRuleType] =
    useState<UserSegment["rule_type"]>("new");
  const [ruleDays, setRuleDays] = useState("7");

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
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {segments.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {projectName(s.project_id)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {RULE_LABELS[s.rule_type].replace("N", String(s.rule_days))}
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Segmentler kullanıcı listesini filtrelemek için tanımlanır;
        Kullanıcılar ekranına segment filtresi yakında bağlanacak.
      </p>
    </div>
  );
};
