import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reviewsKeys } from "@helm/queries";
import { submitReviewReply } from "@helm/api";

import { supabase } from "~/lib/supabase";
import { toast } from "~/lib/toast";

export function useReviewReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { review_id: number; body: string }) =>
      submitReviewReply(supabase, input),
    onSuccess: () => {
      toast.success("Yanıt gönderildi");
      qc.invalidateQueries({ queryKey: reviewsKeys.all });
    },
    onError: (e: Error) => {
      toast.error("Yanıt gönderilemedi", e.message);
    },
  });
}
