import { useMemo, useState } from "react";
import { type CrudFilter, useList } from "@refinedev/core";
import { Eye, Mail as MailIcon, Send } from "lucide-react";
import { toast } from "sonner";
import { ErrorBanner } from "@/components/error-banner";
import { EmptyState } from "@/components/empty-state";
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
        toast.success(`${data.sent} e-posta gönderildi`, {
          description:
            data.failed > 0
              ? `${data.failed} başarısız - geçmişi kontrol et`
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
        <ErrorBanner variant="warning">
          Mail göndermek için sidebar'dan bir proje seç (segment ve Resend
          entegrasyonu proje düzeyinde).
        </ErrorBanner>
      )}

      {!isAll && !resendConnected && (
        <ErrorBanner variant="warning" title="Resend bağlı değil">
          Entegrasyonlar → <strong>+</strong> → <strong>Resend (Mail)</strong>{" "}
          → API key + from_email.
        </ErrorBanner>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Yeni gönderim</CardTitle>
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
                <SelectValue placeholder="Segment seç" />
              </SelectTrigger>
              <SelectContent>
                {segments.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    Segment yok - Segmentler sayfasından oluştur
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
              placeholder="Merhaba!\n\nYeni içerikler eklendi…"
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

          {/* Hızlı şablonlar */}
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Hızlı şablon
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {MAIL_TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => {
                    setSubject(t.subject);
                    setBody(t.body);
                  }}
                  className="rounded-md border bg-card px-3 py-2 text-left text-xs hover:bg-accent"
                >
                  <div className="font-medium">{t.label}</div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {t.subject}
                  </div>
                </button>
              ))}
            </div>
          </div>

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
          <CardTitle>Geçmiş gönderimler</CardTitle>
          <CardAction>
            <Badge variant="secondary">{campaigns.length}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 && !campQuery.isLoading ? (
            <EmptyState
              icon={<MailIcon className="size-6" />}
              title="Henüz e-posta gönderilmedi"
              description="Yukarıda segment, konu ve mesajı doldur; Önizle ile alıcı sayısını gör, sonra Gönder. Geçmiş burada birikir."
              compact
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zaman</TableHead>
                  <TableHead>Konu</TableHead>
                  <TableHead className="text-right">Alıcı</TableHead>
                  <TableHead className="text-right">Gönderildi</TableHead>
                  <TableHead className="text-right">Hatalar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs">{fmt(c.sent_at)}</TableCell>
                    <TableCell className="font-medium">
                      {c.subject ?? "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.recipients}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Badge className="border-emerald-600/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                        {c.sent}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
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

const MAIL_TEMPLATES = [
  {
    label: "Hoş geldin",
    subject: "Aramıza hoş geldin! 👋",
    body: "Merhaba,\n\nEmpire Inc'e katıldığın için teşekkürler. Başlarken yardıma ihtiyacın olursa bize yazman yeterli - buradayız.\n\nSevgiler,\nEmpire ekibi",
  },
  {
    label: "Geri kazanım",
    subject: "Seni özledik 💙",
    body: "Merhaba,\n\nBir süredir uğramıyorsun. Seni bekleyen sürpriz bir hediye var - hesabına gir ve göz at.\n\nGörüşmek üzere!",
  },
  {
    label: "Ödeme hatası",
    subject: "Aboneliğinde bir sorun var",
    body: "Merhaba,\n\nSon aylık abonelik ödemen işlenirken bir sorun oluştu. Premium içeriğe erişimini kaybetmemek için ödeme yöntemini güncellemen yeterli.\n\nDesteğe ihtiyacın olursa buradayız.",
  },
  {
    label: "Yeni özellik",
    subject: "🎉 Yeni özellik: …",
    body: "Merhaba,\n\nBugün yepyeni bir özellik yayınladık. Hemen güncelle ve dene.\n\nİyi eğlenceler!",
  },
];
