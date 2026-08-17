import { useMemo, useState } from "react";
import { type CrudFilter, useList } from "@refinedev/core";
import { Bell, Eye, Send, Smartphone } from "lucide-react";
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

const fmt = (iso: string) => new Date(iso).toLocaleString("en-US");

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
        toast.success(`${data.sent} notifications sent`, {
          description:
            data.failed > 0
              ? `${data.failed} failed (the token may be invalid)`
              : `${data.recipients} devices reached`,
        });
        setTitle("");
        setBody("");
        setSegmentId("");
      }
    } catch (e) {
      toast.error("Send failed", {
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
        <ErrorBanner variant="warning">
          Push göndermek için sidebar'dan bir proje seç.
        </ErrorBanner>
      )}

      {!isAll && !supaIntg && (
        <ErrorBanner
          variant="warning"
          title="Supabase entegrasyonu yok"
        >
          Push token'ları proje DB'sinden okunur — Entegrasyonlar →{" "}
          <strong>Supabase</strong> bağla.
        </ErrorBanner>
      )}

      {!isAll && supaIntg && !supaCfg.push_token_table && (
        <ErrorBanner variant="info" title="Default token config">
          Push token tablosu config'i tanımlı değil. Varsayılanlar
          kullanılacak: <code>profiles.expo_push_token</code> (user_col:{" "}
          <code>id</code>). Farklıysa Supabase entegrasyonunu{" "}
          <strong>Edit</strong>.
        </ErrorBanner>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Yeni Bildirim</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4">
          <div className="space-y-2">
            <Label>Hedef segment</Label>
            <Select
              value={segmentId}
              onValueChange={setSegmentId}
              disabled={!pushReady || isAll}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick a segment" />
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
            <Label>Title</Label>
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

          {/* Şablonlar */}
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Hızlı şablon
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {PUSH_TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => {
                    setTitle(t.title);
                    setBody(t.body);
                  }}
                  className="rounded-md border bg-card/40 px-3 py-2 text-left text-xs hover:bg-card/80"
                >
                  <div className="font-medium">{t.label}</div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {t.title}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Telefon mockup preview */}
        <PhonePreview title={title} body={body} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Past notifications</CardTitle>
          <CardAction>
            <Badge variant="secondary">
              <Bell className="size-3" />
              <span className="ml-1">{campaigns.length}</span>
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 && !campQuery.isLoading ? (
            <EmptyState
              icon={<Bell className="size-6" />}
              title="No notifications sent yet"
              description="Use the form above to push to a segment. History and delivery rate collect here."
              compact
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zaman</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-right">Cihaz</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
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

const PUSH_TEMPLATES = [
  {
    label: "New content",
    title: "A new season has started! 🎮",
    body: "We added new content for your favourite characters. Come explore!",
  },
  {
    label: "Win-back",
    title: "We miss you 👋",
    body: "You have not been around for a while. We have a surprise gift for you — come get it!",
  },
  {
    label: "Daily reward",
    title: "Your daily reward is ready 🎁",
    body: "Do not forget today's gift. Keep your streak alive!",
  },
  {
    label: "Discount",
    title: "Today only — 50% off",
    body: "50% off for everyone who starts a premium subscription today.",
  },
];

const PhonePreview = ({ title, body }: { title: string; body: string }) => {
  const now = new Date();
  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="flex justify-center lg:justify-start">
      <div className="relative w-full max-w-[260px]">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 text-center">
          Telefonda nasıl görünür
        </div>
        {/* Telefon çerçevesi */}
        <div className="rounded-[2rem] border-4 border-foreground/20 bg-gradient-to-b from-slate-900 to-slate-800 p-3 shadow-2xl">
          {/* Status bar */}
          <div className="mb-3 flex items-center justify-between text-[9px] text-white/80">
            <span className="font-medium">{time}</span>
            <span>●●● 5G ▮</span>
          </div>
          {/* Bildirim kartı */}
          <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
            <div className="flex items-start gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/80">
                <Smartphone className="size-3.5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase text-white/90">
                    Uygulamanız
                  </span>
                  <span className="text-[9px] text-white/60">now</span>
                </div>
                <div className="mt-0.5 text-[11px] font-semibold leading-tight text-white">
                  {title || (
                    <span className="text-white/40">Title preview</span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] leading-tight text-white/80 line-clamp-3">
                  {body || (
                    <span className="text-white/40">
                      Mesaj burada görünür…
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* Boş alan + home indicator */}
          <div className="mt-12 flex justify-center">
            <div className="h-1 w-12 rounded-full bg-white/30" />
          </div>
        </div>
      </div>
    </div>
  );
};
