import { useMemo, useState } from "react";
import { type CrudFilter, useList } from "@refinedev/core";
import { Bell, Eye, Info, Send } from "lucide-react";
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

export const PushPage = () => {
  const { scope, isAll } = useScope();
  const [segmentId, setSegmentId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [dryRun, setDryRun] = useState<{
    count: number;
    eligible: number;
    sample: string[];
  } | null>(null);

  // Bu projede Supabase entegrasyonu var mı? Push token tablosu config'i tanımlı mı?
  const { result: integResult } = useList<ProjectIntegration>({
    resource: "project_integrations",
    filters: isAll
      ? []
      : [{ field: "project_id", operator: "eq", value: scope }],
    pagination: { mode: "off" },
  });
  const supaIntg = integResult.data.find(
    (i) => i.provider === "supabase" && i.enabled,
  );
  const supaCfg = (supaIntg?.config ?? {}) as {
    push_token_table?: string;
    push_token_column?: string;
  };
  const pushReady =
    !!supaIntg && (!!supaCfg.push_token_table || true); // varsayılan "profiles" da çalışır

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

  const campFilters: CrudFilter[] = [
    { field: "channel", operator: "eq", value: "push" },
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
    !isAll &&
    pushReady &&
    !!segmentId &&
    title.trim().length > 0 &&
    body.trim().length > 0;

  const send = async (dry: boolean) => {
    if (!canSend) return;
    setSending(true);
    setDryRun(null);
    try {
      const { data, error } = await supabaseClient.functions.invoke(
        "helm-send-push",
        {
          body: {
            project_id: scope,
            segment_id: segmentId,
            title,
            body,
            dry_run: dry,
          },
        },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (dry) {
        setDryRun({
          count: data.recipients,
          eligible: data.eligible_users ?? 0,
          sample: data.sample ?? [],
        });
      } else {
        toast.success(`${data.sent} bildirim gönderildi`, {
          description:
            data.failed > 0
              ? `${data.failed} başarısız (token geçersiz olabilir)`
              : `${data.recipients} cihaza ulaştı`,
        });
        setTitle("");
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
      <h1 className="text-2xl font-semibold tracking-tight">Push</h1>

      {isAll && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <span>
            Push göndermek için sidebar'dan bir proje seç.
          </span>
        </div>
      )}

      {!isAll && !supaIntg && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <span>
            Bu projede Supabase entegrasyonu yok. Push token'ları proje DB'sinden
            okunur — Entegrasyonlar → Supabase bağla.
          </span>
        </div>
      )}

      {!isAll && supaIntg && !supaCfg.push_token_table && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <span>
            Push token tablosu config'i tanımlı değil. Varsayılanlar
            kullanılacak: <code>profiles.expo_push_token</code> (user_col:{" "}
            <code>id</code>). Farklıysa Supabase entegrasyonunu Düzenle.
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Yeni Bildirim</CardTitle>
        </CardHeader>
        <CardContent className="max-w-2xl space-y-4">
          <div className="space-y-2">
            <Label>Hedef segment</Label>
            <Select
              value={segmentId}
              onValueChange={setSegmentId}
              disabled={!pushReady || isAll}
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
            <Label>Başlık</Label>
            <Input
              placeholder="Yeni sezon!"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!pushReady}
            />
          </div>
          <div className="space-y-2">
            <Label>Mesaj</Label>
            <textarea
              className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="Bildirim metni…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={!pushReady}
            />
          </div>

          {dryRun && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
              <div className="font-medium">
                <strong>{dryRun.count}</strong> cihaza ulaşacak
                {dryRun.eligible !== dryRun.count && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({dryRun.eligible} kullanıcı eşleşti, geri kalanın push
                    token'ı yok)
                  </span>
                )}
              </div>
              {dryRun.sample.length > 0 && (
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  Örnek: {dryRun.sample[0]?.slice(0, 30)}…
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
              Önizle
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
          <CardTitle>Geçmiş Bildirimler</CardTitle>
          <CardAction>
            <Badge variant="secondary">
              <Bell className="size-3" />
              <span className="ml-1">{campaigns.length}</span>
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 && !campQuery.isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Henüz bildirim gönderilmedi
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zaman</TableHead>
                  <TableHead>Başlık</TableHead>
                  <TableHead className="text-right">Cihaz</TableHead>
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
