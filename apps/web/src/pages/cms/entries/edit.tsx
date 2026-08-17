// helm — CMS içerik editor. FormRenderer + LocaleSwitcher + PublishButton + revisions rail.
// Create + edit aynı sayfada; /cms/entries/create ya da /cms/entries/edit/:id.

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
  useCreate,
  useInvalidate,
  useList,
  useOne,
  useUpdate,
} from "@refinedev/core";
import { ArrowLeft, History, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { SectionedForm } from "@/components/cms/sectioned-form";
import { LocaleSwitcher, DEFAULT_LOCALES } from "@/components/cms/locale-switcher";
import { PublishButton } from "@/components/cms/publish-button";
import { defaultEntryData } from "@/lib/cms-schema";
import { revertToRevision } from "@/lib/cms-publish";
import { supabaseClient } from "@/providers/supabase-client";
import { slugify } from "@/pages/projects/schema";
import type { CmsCollection, CmsEntry, CmsRevision } from "@/types";

export const EntryEditPage = () => {
  const { id } = useParams<{ id?: string }>();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const isCreate = !id;

  const initialCollectionId = params.get("collection") ?? "";
  const initialLocale = params.get("locale") ?? "en";

  const { result: entryResult } = useOne<CmsEntry>({
    resource: "cms_entries",
    id: id ?? "",
    queryOptions: { enabled: !isCreate },
  });
  const entry = entryResult;

  const collectionId = entry?.collection_id ?? initialCollectionId;

  const { result: collectionResult } = useOne<CmsCollection>({
    resource: "cms_collections",
    id: collectionId,
    queryOptions: { enabled: !!collectionId },
  });
  const collection = collectionResult;

  const [slug, setSlug] = useState("");
  const [locale, setLocale] = useState(initialLocale);
  const [data, setData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (entry) {
      setSlug(entry.slug);
      setLocale(entry.locale);
      setData(entry.data ?? {});
    } else if (collection && isCreate) {
      setData(defaultEntryData(collection.schema));
      if (collection.kind === "singleton") setSlug("default");
    }
  }, [entry, collection, isCreate]);

  const { mutate: create, mutation: createMutation } = useCreate<CmsEntry>();
  const { mutate: update, mutation: updateMutation } = useUpdate<CmsEntry>();
  const saving = createMutation.isPending || updateMutation.isPending;

  // Revisions (sağ rail)
  const { result: revisionsResult } = useList<CmsRevision>({
    resource: "cms_revisions",
    filters: id ? [{ field: "entry_id", operator: "eq", value: id }] : [],
    sorters: [{ field: "created_at", order: "desc" }],
    pagination: { mode: "off" },
    queryOptions: { enabled: !isCreate },
  });
  const revisions = revisionsResult?.data ?? [];

  const handleSwitchLocale = async (next: string) => {
    if (!collection) return;
    if (isCreate) {
      setLocale(next);
      setParams({ collection: collection.id, locale: next });
      return;
    }
    // Aynı slug + farklı locale entry'sini bul
    const { data: rows, error } = await supabaseClient
      .from("cms_entries")
      .select("id")
      .eq("collection_id", collection.id)
      .eq("slug", slug)
      .eq("locale", next)
      .maybeSingle();
    if (error) {
      toast.error("Could not change the locale", { description: error.message });
      return;
    }
    if (rows?.id) {
      navigate(`/cms/entries/edit/${rows.id}`);
    } else {
      // Yoksa create yoluna geç
      navigate(`/cms/entries/create?collection=${collection.id}&locale=${next}&slug=${slug}`);
    }
  };

  const handleSave = () => {
    if (!collection || !slug) {
      toast.error("Eksik alan", { description: "Slug is required." });
      return;
    }
    const values = {
      collection_id: collection.id,
      project_id: collection.project_id,
      slug,
      locale,
      data,
      status: "draft" as const,
    };
    if (isCreate) {
      create(
        { resource: "cms_entries", values },
        {
          onSuccess: (res) => {
            toast.success("Draft saved");
            navigate(`/cms/entries/edit/${res.data.id}`);
          },
          onError: (e) =>
            toast.error("Kaydedilemedi", {
              description: e instanceof Error ? e.message : String(e),
            }),
        },
      );
    } else if (id) {
      update(
        {
          resource: "cms_entries",
          id,
          values: { slug, locale, data, status: entry?.status ?? "draft" },
        },
        {
          onSuccess: () => toast.success("Updated"),
          onError: (e) =>
            toast.error("Kaydedilemedi", {
              description: e instanceof Error ? e.message : String(e),
            }),
        },
      );
    }
  };

  const handleRevert = async (rev: CmsRevision) => {
    if (!id) return;
    try {
      await revertToRevision(supabaseClient, id, rev);
      toast.success("Undone");
      invalidate({ resource: "cms_entries", invalidates: ["detail"] });
    } catch (e) {
      toast.error("Could not undo", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const headerSlug = useMemo(() => {
    const title = (data?.title as unknown) ?? slug;
    return typeof title === "string" && title ? title : slug || "New content";
  }, [data, slug]);

  if (!collection) {
    return <p className="text-muted-foreground">No collection selected.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/cms/entries">
              <ArrowLeft className="size-4" /> İçerikler
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={saving}
            >
              <Save className="size-4" />
              {saving ? "Kaydediliyor…" : "Save draft"}
            </Button>
            {!isCreate && entry && (
              <PublishButton
                entry={{
                  id: entry.id,
                  data,
                  status: entry.status,
                  slug: entry.slug,
                  locale: entry.locale,
                }}
                onPublished={() =>
                  invalidate({ resource: "cms_entries", invalidates: ["detail", "list"] })
                }
              />
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="truncate">{headerSlug}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {collection.label}{" "}
                  <Badge variant="secondary" className="ml-1">
                    {collection.kind}
                  </Badge>
                </p>
              </div>
              <LocaleSwitcher value={locale} onChange={handleSwitchLocale} />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-1.5 md:max-w-sm">
              <Label>Slug</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                disabled={collection.kind === "singleton"}
                placeholder={collection.kind === "singleton" ? "default" : "ornek-yazi"}
              />
            </div>
            <Separator />
            <SectionedForm
              projectId={collection.project_id}
              schema={collection.schema}
              value={data}
              onChange={setData}
            />
          </CardContent>
        </Card>
      </div>

      <aside className="flex flex-col gap-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4" /> Geçmiş
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revisions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No revisions yet.</p>
            ) : (
              <ScrollArea className="max-h-[420px] pr-2">
                <ul className="flex flex-col gap-2">
                  {revisions.map((rev) => (
                    <li key={rev.id} className="rounded-md border p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {new Date(rev.created_at).toLocaleString("en-US")}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {rev.status_at_snapshot ?? "?"}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-7 px-2"
                        onClick={() => handleRevert(rev)}
                      >
                        <RotateCcw className="size-3" /> Geri al
                      </Button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Diller</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-1">
              {DEFAULT_LOCALES.map((l) => (
                <Button
                  key={l}
                  variant={l === locale ? "secondary" : "ghost"}
                  size="sm"
                  className="justify-start"
                  onClick={() => handleSwitchLocale(l)}
                >
                  {l.toUpperCase()}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
};
