// helm - CMS publish action butonu.
// Edge fn `helm-cms-publish` revision + status update + webhook dağıtımı yapar.

import { useState } from "react";
import { Send } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { supabaseClient } from "@/providers/supabase-client";
import type { CmsEntry, CmsPublishResult } from "@/types/cms";

interface Props {
  entry: Pick<CmsEntry, "id" | "data" | "status" | "slug" | "locale">;
  disabled?: boolean;
  onPublished?: () => void;
}

interface PublishResponse {
  tags: string[];
  targets_total: number;
  targets_matched: number;
  results: CmsPublishResult[];
}

export const PublishButton = ({ entry, disabled, onPublished }: Props) => {
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke<PublishResponse>(
        "helm-cms-publish",
        { body: { entry_id: entry.id, action: "publish" } },
      );
      if (error) throw error;
      if (!data) throw new Error("Boş yanıt");

      const okCount = data.results.filter((r) => r.ok).length;
      const failed = data.results.filter((r) => !r.ok);

      if (failed.length === 0) {
        toast.success("Yayınlandı", {
          description:
            data.targets_total === 0
              ? `${entry.slug} (${entry.locale}) - hedef yok, sadece DB`
              : `${entry.slug} (${entry.locale}) - ${okCount}/${data.targets_matched} hedef yayınlandı`,
        });
      } else {
        toast.warning("Yayınlandı, ancak bazı hedefler başarısız", {
          description: failed
            .map((r) => `${r.target}: ${r.status} ${r.error ?? ""}`)
            .join("; "),
        });
      }
      onPublished?.();
    } catch (e) {
      toast.error("Yayınlama başarısız", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" disabled={disabled || busy}>
          <Send className="size-4" />
          {entry.status === "published" ? "Yeniden yayınla" : "Yayınla"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Bu içerik yayınlansın mı?</AlertDialogTitle>
          <AlertDialogDescription>
            Mevcut taslak yayına geçecek ve geri alınabilir bir snapshot oluşturulacak.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>İptal</AlertDialogCancel>
          <AlertDialogAction onClick={handle} disabled={busy}>
            {busy ? "Yayınlanıyor…" : "Yayınla"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
