// helm — CMS medya kütüphanesi. Upload + grid + alt edit + sil.

import { useRef, useState } from "react";
import { useInvalidate, useList, useUpdate } from "@refinedev/core";
import { Copy, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabaseClient } from "@/providers/supabase-client";
import { assetPublicUrl, deleteAsset, uploadAsset } from "@/lib/cms-assets";
import { useScope } from "@/context/scope";
import type { CmsAsset, Project } from "@/types";

export const AssetsPage = () => {
  const { scope, isAll } = useScope();
  const [uploadProjectId, setUploadProjectId] = useState<string>(
    isAll ? "" : scope,
  );
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const invalidate = useInvalidate();

  const { result: projectsResult } = useList<Project>({
    resource: "projects",
    pagination: { mode: "off" },
  });
  const projects = projectsResult?.data ?? [];

  const { result } = useList<CmsAsset>({
    resource: "cms_assets",
    filters: isAll ? [] : [{ field: "project_id", operator: "eq", value: scope }],
    sorters: [{ field: "created_at", order: "desc" }],
    pagination: { mode: "off" },
  });
  const assets = result?.data ?? [];

  const { mutate: updateAlt } = useUpdate<CmsAsset>();

  const handleFile = async (file: File) => {
    const targetProject = uploadProjectId || (isAll ? "" : scope);
    if (!targetProject) {
      toast.error("Pick a project", { description: "Pick a project before uploading." });
      return;
    }
    setUploading(true);
    try {
      await uploadAsset(supabaseClient, targetProject, file);
      toast.success("Uploaded", { description: file.name });
      invalidate({ resource: "cms_assets", invalidates: ["list"] });
    } catch (e) {
      toast.error("Upload failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCopyUrl = (asset: CmsAsset) => {
    const url = assetPublicUrl(supabaseClient, asset.storage_path);
    navigator.clipboard.writeText(url);
    toast.success("URL copied");
  };

  const handleDelete = async (asset: CmsAsset) => {
    try {
      await deleteAsset(supabaseClient, asset);
      toast.success("Deleted");
      invalidate({ resource: "cms_assets", invalidates: ["list"] });
    } catch (e) {
      toast.error("Could not delete", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="size-5" /> Medya
        </CardTitle>
        <CardAction className="flex items-center gap-2">
          {isAll && (
            <Select value={uploadProjectId} onValueChange={setUploadProjectId}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <input
            ref={inputRef}
            type="file"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <Button
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Yükle
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="flex flex-col gap-2 rounded-md border bg-card p-2"
            >
              <div className="aspect-square overflow-hidden rounded bg-muted">
                <img
                  src={assetPublicUrl(supabaseClient, asset.storage_path)}
                  alt={asset.alt ?? asset.filename}
                  className="size-full object-cover"
                />
              </div>
              <div className="truncate text-xs font-medium">{asset.filename}</div>
              {asset.width && asset.height && (
                <div className="text-[10px] text-muted-foreground">
                  {asset.width}×{asset.height}
                </div>
              )}
              <Label className="text-[10px] text-muted-foreground">Alt text</Label>
              <Input
                defaultValue={asset.alt ?? ""}
                className="h-7 text-xs"
                onBlur={(e) =>
                  updateAlt(
                    { resource: "cms_assets", id: asset.id, values: { alt: e.target.value } },
                    {
                      onSuccess: () => toast.success("Subtitle updated"),
                      onError: (err) =>
                        toast.error("Could not update", {
                          description:
                            err instanceof Error ? err.message : String(err),
                        }),
                    },
                  )
                }
              />
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 h-7"
                  onClick={() => handleCopyUrl(asset)}
                >
                  <Copy className="size-3" /> URL
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-7" aria-label="Delete">
                      <Trash2 className="size-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this media?</AlertDialogTitle>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(asset)}>
                        Sil
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
          {assets.length === 0 && (
            <div className="col-span-full grid place-items-center py-16 text-sm text-muted-foreground">
              Henüz medya yok.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
