// helm - CMS şemalar listesi. Proje filtresi (useScope) + yeni şema dialog.

import { useState } from "react";
import { Link } from "react-router";
import { useCreate, useDelete, useList } from "@refinedev/core";
import { Layers, Plus, Trash2 } from "lucide-react";
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
  DialogTrigger,
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
import { PageStatus } from "@/components/ui/page-status";
import { slugify } from "@/pages/projects/schema";
import { useScope } from "@/context/scope";
import type { CmsCollection, CollectionKind, Project } from "@/types";

export const CollectionsListPage = () => {
  const { scope, isAll } = useScope();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [kind, setKind] = useState<CollectionKind>("collection");
  const [projectId, setProjectId] = useState<string>(isAll ? "" : scope);

  const { result, query } = useList<CmsCollection>({
    resource: "cms_collections",
    filters: isAll ? [] : [{ field: "project_id", operator: "eq", value: scope }],
    sorters: [{ field: "created_at", order: "desc" }],
    pagination: { mode: "off" },
  });
  const collections = result?.data ?? [];

  const { result: projectsResult } = useList<Project>({
    resource: "projects",
    pagination: { mode: "off" },
  });
  const projects = projectsResult?.data ?? [];

  const { mutate: create, mutation } = useCreate<CmsCollection>();
  const { mutate: remove } = useDelete();

  const handleCreate = () => {
    const targetProject = projectId || (isAll ? "" : scope);
    if (!label || !slug || !targetProject) {
      toast.error("Eksik alan", { description: "Proje, etiket ve slug zorunlu." });
      return;
    }
    create(
      {
        resource: "cms_collections",
        values: {
          project_id: targetProject,
          label,
          slug,
          kind,
          schema: { fields: [] },
        },
      },
      {
        onSuccess: () => {
          toast.success("Şema oluşturuldu");
          setOpen(false);
          setLabel("");
          setSlug("");
        },
        onError: (e) =>
          toast.error("Oluşturma başarısız", {
            description: e instanceof Error ? e.message : String(e),
          }),
      },
    );
  };

  const projectName = (id: string) =>
    projects.find((p) => p.id === id)?.name ?? id.slice(0, 8);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="size-5" /> İçerik şemaları
        </CardTitle>
        <CardAction>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="size-4" /> Yeni şema
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yeni şema</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label>Proje</Label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seç…" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Etiket</Label>
                  <Input
                    value={label}
                    onChange={(e) => {
                      setLabel(e.target.value);
                      if (!slug) setSlug(slugify(e.target.value));
                    }}
                    placeholder="örn. Blog yazıları"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Slug</Label>
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(slugify(e.target.value))}
                    placeholder="blog"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Tip</Label>
                  <Select value={kind} onValueChange={(v) => setKind(v as CollectionKind)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="collection">
                        Koleksiyon (çoklu kayıt)
                      </SelectItem>
                      <SelectItem value="singleton">
                        Tekil (tek kayıt - sayfa içeriği gibi)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  disabled={mutation.isPending}
                >
                  İptal
                </Button>
                <Button onClick={handleCreate} disabled={mutation.isPending}>
                  {mutation.isPending ? "Oluşturuluyor…" : "Oluştur"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardAction>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <PageStatus tone="loading" label="Şemalar yükleniyor…" />
        ) : query.isError ? (
          <PageStatus tone="error" label="Şemalar yüklenemedi - tekrar dene" />
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Etiket</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Tip</TableHead>
              <TableHead>Proje</TableHead>
              <TableHead>Alan sayısı</TableHead>
              <TableHead className="w-24">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {collections.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  <Link to={`/cms/collections/edit/${c.id}`} className="hover:underline">
                    {c.label}
                  </Link>
                </TableCell>
                <TableCell>
                  <code className="text-xs">{c.slug}</code>
                </TableCell>
                <TableCell>
                  <Badge variant={c.kind === "singleton" ? "secondary" : "outline"}>
                    {c.kind === "singleton" ? "Tekil" : "Koleksiyon"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {projectName(c.project_id)}
                </TableCell>
                <TableCell className="tabular-nums">{c.schema?.fields?.length ?? 0}</TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Sil">
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Bu şema silinsin mi?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {c.label} ve bağlı tüm içerikler silinecek (cascade).
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            remove(
                              { resource: "cms_collections", id: c.id },
                              {
                                onSuccess: () => toast.success("Şema silindi"),
                                onError: (e) =>
                                  toast.error("Silme başarısız", {
                                    description:
                                      e instanceof Error ? e.message : String(e),
                                  }),
                              },
                            )
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
            {collections.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  Henüz şema yok. Sağ üstten oluştur.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        )}
      </CardContent>
    </Card>
  );
};
