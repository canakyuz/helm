import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabaseClient } from "@/providers/supabase-client";
import type { Review } from "@/types";

interface Props {
  review: Review | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReplied: () => void;
}

const MAX = 350;

export function ReplyModal({ review, open, onOpenChange, onReplied }: Props) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open && review) {
      setBody(review.developer_response ?? "");
    }
  }, [open, review]);

  const handleSubmit = async () => {
    if (!review) return;
    const trimmed = body.trim();
    if (trimmed.length === 0) {
      toast.error("The reply cannot be empty");
      return;
    }
    if (trimmed.length > MAX) {
      toast.error(`The reply must be at most ${MAX} characters`);
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke(
        "helm-review-reply",
        { body: { review_id: review.id, body: trimmed } },
      );
      if (error) throw error;
      if ((data as { ok?: boolean })?.ok !== true) {
        throw new Error((data as { error?: string })?.error ?? "Bilinmeyen hata");
      }
      toast.success("Reply sent");
      onReplied();
      onOpenChange(false);
      setBody("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Could not send the reply", { description: msg });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {review?.developer_response ? "Edit reply" : "Write a reply"}
          </DialogTitle>
        </DialogHeader>
        {review && (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="font-medium">{review.title ?? "-"}</div>
              <div className="mt-1 text-muted-foreground">{review.body ?? "-"}</div>
            </div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Your reply…"
              rows={4}
              maxLength={MAX}
            />
            <div className="text-right text-xs text-muted-foreground tabular-nums">
              {body.length} / {MAX}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            İptal
          </Button>
          <Button onClick={handleSubmit} disabled={sending}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
