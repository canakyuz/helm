// helm - CMS içerik listesi. Collection + status + locale filter.

import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useDelete, useList } from "@refinedev/core";
import { FileText, Plus, Trash2 } from "lucide-react";
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
import { DEFAULT_LOCALES } from "@/components/cms/locale-switcher";
import { useScope } from "@/context/scope";
import type { CmsCollection, CmsEntry, EntryStatus } from "@/types";

export const EntriesListPage = () => {
  const navigate = useNavigate();
  const { scope, isAll } = useScope();
  const [collectionId, setCollectionId] = useState<string>("all");
  const [status, setStatus] = useState<EntryStatus | "all">("all");
  const [locale, setLocale] = useState<string>("all");

  const { result: collectionsResult } = useList<CmsCollection>({
    resource: "cms_collections",
    filters: isAll ? [] : [{ field: "project_id", operator: "eq", value: scope }],
    pagination: { mode: "off" },
  });
  const collections = collectionsResult?.data ?? [];

  const filters = [
    ...(isAll
      ? []
      : [{ field: "project_id", operator: "eq" as const, value: scope }]),
    ...(collectionId !== "all"
      ? [{ field: "collection_id", operator: "eq" as const, value: collectionId }]
      : []),
    ...(status !== "all"
      ? [{ field: "status", operator: "eq" as const, value: status }]
      : []),
    ...(locale !== "all"
      ? [{ field: "locale", operator: "eq" as const, value: locale }]
      : []),
  ];

  const { result } = useList<CmsEntry>({
    resource: "cms_entries",
    filters,
    sorters: [{ field: "updated_at", order: "desc" }],
    pagination: { mode: "off" },
  });
  const entries = result?.data ?? [];

  const { mutate: remove } = useDelete();

  const collectionLabel = (id: string) =>
    collections.find((c) => c.id === id)?.label ?? id.slice(0, 8);

  const entryTitle = (entry: CmsEntry): string => {
    const t = (entry.data?.title ?? entry.data?.name) as unknown;
    if (typeof t === "string" && t) return t;
    return entry.slug;
  };

  const handleCreate = () => {
    if (collectionId === "all") {
      toast.error("Pick a collection", {
        description: "Filter by a collection first to create new content.",
      });
      return;
    }
    const lc = locale === "all" ? "en" : locale;
    navigate(`/cms/entries/create?collection=${collectionId}&locale=${lc}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="size-5" /> İçerikler
        </CardTitle>
        <CardAction>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="size-4" /> Yeni İçerik
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Select value={collectionId} onValueChange={setCollectionId}>
            <SelectTrigger>
              <SelectValue placeholder="Collection" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All collections</SelectItem>
              {collections.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as EntryStatus | "all")}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Live</SelectItem>
            </SelectContent>
          </Select>
          <Select value={locale} onValueChange={setLocale}>
            <SelectTrigger>
              <SelectValue placeholder="Dil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All languages</SelectItem>
              {DEFAULT_LOCALES.map((l) => (
                <SelectItem key={l} value={l}>
                  {l.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Collection</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Dil</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Update</TableHead>
              <TableHead className="w-24">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">
                  <Link
                    to={`/cms/entries/edit/${entry.id}`}
                    className="hover:underline"
                  >
                    {entryTitle(entry)}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {collectionLabel(entry.collection_id)}
                </TableCell>
                <TableCell>
                  <code className="text-xs">{entry.slug}</code>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{entry.locale.toUpperCase()}</Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={entry.status === "published" ? "default" : "secondary"}
                  >
                    {entry.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(entry.updated_at).toLocaleString("en-US")}
                </TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Delete">
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this content?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {entryTitle(entry)} ({entry.locale}) silinecek.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            remove(
                              { resource: "cms_entries", id: entry.id },
                              {
                                onSuccess: () => toast.success("Deleted"),
                                onError: (e) =>
                                  toast.error("Could not delete", {
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
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  Filtreye uyan içerik yok.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
