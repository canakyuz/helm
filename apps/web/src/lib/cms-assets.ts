// helm — CMS medya yükleme + public URL üretimi.
// Bucket: 'cms-assets' (migration 0017). Path: <projectId>/<uuid>.<ext>.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CmsAsset } from "@/types/cms";

const BUCKET = "cms-assets";

const inferExt = (filename: string): string => {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot) : "";
};

const imageDims = (file: File): Promise<{ width: number; height: number } | null> =>
  new Promise((resolve) => {
    if (!file.type.startsWith("image/")) return resolve(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });

export const uploadAsset = async (
  supabase: SupabaseClient,
  projectId: string,
  file: File,
): Promise<CmsAsset> => {
  const id = crypto.randomUUID();
  const ext = inferExt(file.name);
  const storage_path = `${projectId}/${id}${ext}`;

  const dims = await imageDims(file);

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storage_path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("cms_assets")
    .insert({
      id,
      project_id: projectId,
      storage_path,
      filename: file.name,
      mime: file.type || null,
      bytes: file.size,
      width: dims?.width ?? null,
      height: dims?.height ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CmsAsset;
};

export const assetPublicUrl = (
  supabase: SupabaseClient,
  storagePath: string,
): string => supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;

export const deleteAsset = async (
  supabase: SupabaseClient,
  asset: Pick<CmsAsset, "id" | "storage_path">,
): Promise<void> => {
  const { error: storageErr } = await supabase.storage
    .from(BUCKET)
    .remove([asset.storage_path]);
  if (storageErr) throw storageErr;

  const { error } = await supabase.from("cms_assets").delete().eq("id", asset.id);
  if (error) throw error;
};
