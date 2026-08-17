// helm — CMS asset seçici (dialog + grid + inline upload).
// FormRenderer'ın `kind: 'asset'` alanlarında kullanılır.

import { useRef, useState } from "react";
import { useList, useInvalidate } from "@refinedev/core";
import { ImageIcon, Loader2, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabaseClient } from "@/providers/supabase-client";
import { assetPublicUrl, uploadAsset } from "@/lib/cms-assets";
import type { CmsAsset } from "@/types/cms";

interface Props {
  projectId: string;
  value: string | null;
  onChange: (assetId: string | null) => void;
}

export const AssetPicker = ({ projectId, value, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const invalidate = useInvalidate();

  const { result } = useList<CmsAsset>({
    resource: "cms_assets",
    filters: [{ field: "project_id", operator: "eq", value: projectId }],
    sorters: [{ field: "created_at", order: "desc" }],
    pagination: { mode: "off" },
    queryOptions: { enabled: open },
  });
  const assets = result?.data ?? [];

  const { result: currentResult } = useList<CmsAsset>({
    resource: "cms_assets",
    filters: value ? [{ field: "id", operator: "eq", value }] : [],
    pagination: { mode: "off" },
    queryOptions: { enabled: !!value },
  });
  const current = currentResult?.data?.[0];

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const asset = await uploadAsset(supabaseClient, projectId, file);
      toast.success("Uploaded", { description: file.name });
      invalidate({ resource: "cms_assets", invalidates: ["list"] });
      onChange(asset.id);
      setOpen(false);
    } catch (e) {
      toast.error("Upload failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {current ? (
        <div className="flex items-center gap-3 rounded-md border p-2">
          <img
            src={assetPublicUrl(supabaseClient, current.storage_path)}
            alt={current.alt ?? current.filename}
            className="size-14 rounded object-cover"
          />
          <div className="text-sm">
            <div className="font-medium truncate max-w-[160px]">{current.filename}</div>
            {current.width && current.height && (
              <div className="text-muted-foreground text-xs">
                {current.width}×{current.height}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onChange(null)}
            aria-label="Clear"
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="flex size-14 items-center justify-center rounded-md border bg-muted/30 text-muted-foreground">
          <ImageIcon className="size-5" />
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            {current ? "Change" : "Select"}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Pick media</DialogTitle>
          </DialogHeader>

          <ScrollArea className="h-[420px] pr-2">
            <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
              {assets.map((asset) => {
                const isSelected = value === asset.id;
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => {
                      onChange(asset.id);
                      setOpen(false);
                    }}
                    className={`group relative overflow-hidden rounded-md border ${
                      isSelected ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    <img
                      src={assetPublicUrl(supabaseClient, asset.storage_path)}
                      alt={asset.alt ?? asset.filename}
                      className="aspect-square w-full object-cover"
                    />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-background/80 px-2 py-1 text-xs">
                      {asset.filename}
                    </span>
                  </button>
                );
              })}
              {assets.length === 0 && (
                <div className="col-span-full grid place-items-center py-12 text-sm text-muted-foreground">
                  Henüz medya yok. Sağ üstten yükleyebilirsin.
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2">
            <input
              ref={inputRef}
              type="file"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="secondary"
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
            {value && (
              <Button
                variant="ghost"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <Trash2 className="size-4" /> Seçimi kaldır
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
