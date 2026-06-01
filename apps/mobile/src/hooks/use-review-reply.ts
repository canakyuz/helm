import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "~/lib/supabase";
import { toast } from "~/lib/toast";

interface ReplyInput {
  review_id: number;
  body: string;
}

export function useReviewReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ review_id, body }: ReplyInput) => {
      const { data, error } = await supabase.functions.invoke("helm-review-reply", {
        body: { review_id, body },
      });
      if (error) throw error;
      if ((data as { ok?: boolean })?.ok !== true) {
        throw new Error((data as { error?: string })?.error ?? "Bilinmeyen hata");
      }
      return data as { ok: true; responded_at: string };
    },
    onSuccess: () => {
      toast.success("Yanıt gönderildi");
      qc.invalidateQueries({ queryKey: ["reviews"] });
    },
    onError: (e: Error) => {
      toast.error("Yanıt gönderilemedi", e.message);
    },
  });
}
