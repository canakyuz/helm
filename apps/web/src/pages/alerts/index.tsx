import { useState } from "react";
import { useCreate, useDelete, useList, useUpdate } from "@refinedev/core";
import { Plus, Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AlertCondition, AlertRule, Project } from "@/types";

const METRICS: Record<string, string> = {
  dau: "DAU",
  mau: "MAU",
  ad_revenue: "Reklam Geliri",
  mrr: "MRR",
  total_users: "Toplam Kullanıcı",
  new_users: "Yeni Kullanıcı",
};

const CONDITIONS: Record<AlertCondition, string> = {
  drop_pct: "% düştü",
  rise_pct: "% arttı",
  below: "değerin altına indi",
  above: "değerin üstüne çıktı",
};

export const AlertsPage = () => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("all");
  const [metric, setMetric] = useState("dau");
  const [condition, setCondition] = useState<AlertCondition>("drop_pct");
  const [threshold, setThreshold] = useState("20");
  const [channel, setChannel] = useState<"telegram" | "email">("telegram");

  const { result, query } = useList<AlertRule>({
    resource: "alert_rules",
    sorters: [{ field: "created_at", order: "desc" }],
    pagination: { mode: "off" },
  });
  const { result: projectsResult } = useList<Project>({
    resource: "projects",
    pagination: { mode: "off" },
  });
  const rules = result.data;
  const projects = projectsResult.data;

  const { mutate: create, mutation: createMutation } = useCreate();
  const { mutate: update } = useUpdate();
  const { mutate: remove } = useDelete();

  const projectName = (id: string | null) =>
    id ? (projects.find((p) => p.id === id)?.name ?? "—") : "Tüm Projeler";

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
      <h1 className="text-2xl font-semibold tracking-tight">Uyarılar</h1>

      <Card>
        <CardHeader>
          <CardTitle>Uyarı Kuralları</CardTitle>
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
                  <DialogTitle>Uyarı kuralı</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Kural adı</Label>
                    <Input
                      placeholder="Reklam geliri düşüşü"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Kapsam</Label>
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
                      <Label>Koşul</Label>
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
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Eşik</Label>
                      <Input
                        type="number"
                        value={threshold}
                        onChange={(e) => setThreshold(e.target.value)}
                      />
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
            <div className="py-8 text-center text-sm text-muted-foreground">
              Henüz uyarı kuralı yok
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kural</TableHead>
                  <TableHead>Kapsam</TableHead>
                  <TableHead>Koşul</TableHead>
                  <TableHead>Kanal</TableHead>
                  <TableHead>Aktif</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((r) => (
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
                            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Kurallar kaydedilir. Değerlendirme motoru (her senkron sonrası kontrol +
        Telegram/e-posta bildirimi) yakında bağlanacak.
      </p>
    </div>
  );
};
