// helm — CMS şema editor. label/slug/kind + SchemaDesigner.

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useOne, useUpdate } from "@refinedev/core";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SchemaDesigner } from "@/components/cms/schema-designer";
import { slugify } from "@/pages/projects/schema";
import type { CmsCollection, CollectionKind, CollectionSchema } from "@/types";

export const CollectionEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { result, query } = useOne<CmsCollection>({
    resource: "cms_collections",
    id: id ?? "",
    queryOptions: { enabled: !!id },
  });
  const collection = result;

  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [kind, setKind] = useState<CollectionKind>("collection");
  const [schema, setSchema] = useState<CollectionSchema>({ fields: [] });

  useEffect(() => {
    if (!collection) return;
    setLabel(collection.label);
    setSlug(collection.slug);
    setKind(collection.kind);
    setSchema(collection.schema ?? { fields: [] });
  }, [collection]);

  const { mutate: update, mutation } = useUpdate<CmsCollection>();

  const handleSave = () => {
    if (!id) return;
    update(
      {
        resource: "cms_collections",
        id,
        values: { label, slug, kind, schema },
      },
      {
        onSuccess: () => toast.success("Schema updated"),
        onError: (e) =>
          toast.error("Kaydedilemedi", {
            description: e instanceof Error ? e.message : String(e),
          }),
      },
    );
  };

  if (query.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!collection) return <p className="text-muted-foreground">Schema not found.</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/cms/collections")}>
          <ArrowLeft className="size-4" /> Şemalar
        </Button>
        <Button size="sm" onClick={handleSave} disabled={mutation.isPending}>
          <Save className="size-4" />
          {mutation.isPending ? "Kaydediliyor…" : "Save"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Temel bilgi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-1.5">
              <Label>Etiket</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Slug</Label>
              <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as CollectionKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="collection">Collection</SelectItem>
                  <SelectItem value="singleton">Singleton</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fields</CardTitle>
        </CardHeader>
        <CardContent>
          <SchemaDesigner value={schema} onChange={setSchema} />
        </CardContent>
      </Card>
    </div>
  );
};
