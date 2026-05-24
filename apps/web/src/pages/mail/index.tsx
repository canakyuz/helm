import { useMemo, useState } from "react";
import { type CrudFilter, useList } from "@refinedev/core";
import { Eye, Info, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabaseClient } from "@/providers/supabase-client";
import { useScope } from "@/context/scope";
import type { ProjectIntegration, UserSegment } from "@/types";

interface Campaign {
  id: number;
  project_id: string | null;
  segment_id: string | null;
  channel: "mail" | "push";
  subject: string | null;
  recipients: number;
  sent: number;
  failed: number;
  error: string | null;
  sent_at: string;
}

const fmt = (iso: string) => new Date(iso).toLocaleString("tr-TR");

export const MailPage = () => {
  const { scope, isAll } = useScope();
  const [segmentId, setSegmentId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [dryRun, setDryRun] = useState<{ count: number; sample: string[] } | null>(
    null,
  );

  // Bu projede Resend bağlı mı?
  const { result: integResult } = useList<ProjectIntegration>({
    resource: "project_integrations",
    filters: isAll
      ? []
      : [{ field: "project_id", operator: "eq", value: scope }],
    pagination: { mode: "off" },
  });
  const resendConnected = integResult.data.some(
    (i) => i.provider === "resend" && i.enabled,
  );

  // Segmentler (proje-scoped + tüm projeler)
  const { result: segResult } = useList<UserSegment>({
    resource: "user_segments",
    pagination: { mode: "off" },
  });
  const allSegments = segResult.data;
  const segments = useMemo(() => {
    if (isAll) return allSegments;
    return allSegments.filter(
      (s) => s.project_id === null || s.project_id === scope,
    );
  }, [allSegments, isAll, scope]);

  // Mail geçmişi
  const campFilters: CrudFilter[] = [
    { field: "channel", operator: "eq", value: "mail" },
  ];
  if (!isAll) {
    campFilters.push({ field: "project_id", operator: "eq", value: scope });
  }
  const { result: campResult, query: campQuery } = useList<Campaign>({
    resource: "campaigns",
    filters: campFilters,
    sorters: [{ field: "sent_at", order: "desc" }],
    pagination: { mode: "off" },
  });
  const campaigns = campResult.data;

  const canSend =
    resendConnected &&
    !isAll &&
    segmentId &&
    subject.trim().length > 0 &&
    body.trim().length > 0;

  const send = async (dry: boolean) => {
    if (!canSend) return;
    setSending(true);
    setDryRun(null);
    try {
      const body_html = body
        .split(/\n{2,}/)
        .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
        .join("");
      const { data, error } = await supabaseClient.functions.invoke(
        "helm-send-mail",
        {
          body: {
            project_id: scope,
            segment_id: segmentId,
            subject,
            body_html,
            body_text: body,
            dry_run: dry,
          },
        },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (dry) {
        setDryRun({ count: data.recipients, sample: data.sample ?? [] });
      } else {
        toast.success(`${data.sent} mail gönderildi`, {
          description:
            data.failed > 0
              ? `${data.failed} başarısız — geçmişten incele`
              : `${data.recipients} alıcı`,
        });
        setSubject("");
        setBody("");
        setSegmentId("");
      }
    } catch (e) {
      toast.error("Gönderim başarısız", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Mail</h1>

      {isAll && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <span>
            Mail göndermek için sidebar'dan bir proje seç (segment ve Resend
            entegrasyonu proje düzeyinde).
          </span>
        </div>
      )}

      {!isAll && !resendConnected && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <span>
            Bu projeye Resend bağlanmadı. Entegrasyonlar → "+" → Resend (Mail)
            → API key + from_email.
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Yeni Gönderim</CardTitle>
        </CardHeader>
        <CardContent className="max-w-2xl space-y-4">
          <div className="space-y-2">
            <Label>Alıcı segmenti</Label>
            <Select
              value={segmentId}
              onValueChange={setSegmentId}
              disabled={!resendConnected || isAll}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Bir segment seç" />
              </SelectTrigger>
              <SelectContent>
                {segments.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    Segment yok — Segments sayfasından oluştur
                  </SelectItem>
                ) : (
                  segments.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.rule_type} · {s.rule_days}g)
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Konu</Label>
            <Input
              placeholder="Yeni sezon başladı"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={!resendConnected}
            />
          </div>
          <div className="space-y-2">
            <Label>Mesaj (boş satır paragraf ayırır)</Label>
            <textarea
              className="min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="Selam!\n\nYeni içerikler eklendi…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={!resendConnected}
            />
          </div>

          {dryRun && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
              <div className="font-medium">
                <strong>{dryRun.count}</strong> alıcıya gönderilecek
              </div>
              {dryRun.sample.length > 0 && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Örnek: {dryRun.sample.join(", ")}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => send(true)}
              disabled={!canSend || sending}
            >
              <Eye className="size-4" />
              Önizle (kaç kişi)
            </Button>
            <Button onClick={() => send(false)} disabled={!canSend || sending}>
              <Send className="size-4" />
              Gönder
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Geçmiş Gönderimler</CardTitle>
          <CardAction>
            <Badge variant="secondary">{campaigns.length}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 && !campQuery.isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Henüz mail gönderilmedi
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zaman</TableHead>
                  <TableHead>Konu</TableHead>
                  <TableHead className="text-right">Alıcı</TableHead>
                  <TableHead className="text-right">Gönderildi</TableHead>
                  <TableHead className="text-right">Hata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs">{fmt(c.sent_at)}</TableCell>
                    <TableCell className="font-medium">
                      {c.subject ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {c.recipients}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-500">
                        {c.sent}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {c.failed > 0 ? (
                        <Badge variant="destructive">{c.failed}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
