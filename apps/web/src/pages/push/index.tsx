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
              : `${data.recipients} cihaza ulaşıldı`,
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
        <ErrorBanner variant="warning">
          Push göndermek için sidebar'dan bir proje seç.
        </ErrorBanner>
      )}

      {!isAll && !supaIntg && (
        <ErrorBanner
          variant="warning"
          title="Supabase entegrasyonu yok"
        >
          Push token'ları proje DB'sinden okunur - Entegrasyonlar →{" "}
          <strong>Supabase</strong> bağla.
        </ErrorBanner>
      )}

      {!isAll && supaIntg && !supaCfg.push_token_table && (
        <ErrorBanner variant="info" title="Varsayılan token config">
          Push token tablosu config'i tanımlı değil. Varsayılanlar
          kullanılacak: <code>profiles.expo_push_token</code> (user_col:{" "}
          <code>id</code>). Farklıysa Supabase entegrasyonunu{" "}
          <strong>Düzenle</strong>.
        </ErrorBanner>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Yeni bildirim</CardTitle>
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
                  className="rounded-md border bg-card px-3 py-2 text-left text-xs hover:bg-accent"
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
          <CardTitle>Geçmiş bildirimler</CardTitle>
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
              title="Henüz bildirim gönderilmedi"
              description="Yukarıdaki formla bir segmente push gönder. Geçmiş ve teslim oranı burada birikir."
              compact
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zaman</TableHead>
                  <TableHead>Başlık</TableHead>
                  <TableHead className="text-right">Cihaz</TableHead>
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

const PUSH_TEMPLATES = [
  {
    label: "Yeni içerik",
    title: "Yeni sezon başladı! 🎮",
    body: "Favori karakterlerin için yeni içerikler ekledik. Gel, keşfet!",
  },
  {
    label: "Geri kazanım",
    title: "Seni özledik 👋",
    body: "Bir süredir uğramıyorsun. Sana sürpriz bir hediyemiz var - gel, al!",
  },
  {
    label: "Günlük ödül",
    title: "Günlük ödülün hazır 🎁",
    body: "Bugünkü hediyeni unutma. Serini canlı tut!",
  },
  {
    label: "İndirim",
    title: "Sadece bugün - %50 indirim",
    body: "Bugün premium aboneliğe başlayan herkese %50 indirim.",
  },
];

const PhonePreview = ({ title, body }: { title: string; body: string }) => {
  const now = new Date();
  const time = now.toLocaleTimeString("tr-TR", {
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
        <div className="rounded-[2.2rem] border border-border bg-card p-3 shadow-sm">
          {/* Status bar */}
          <div className="mb-3 flex items-center justify-between text-[9px] text-muted-foreground">
            <span className="font-medium">{time}</span>
            <span>●●● 5G ▮</span>
          </div>
          {/* Bildirim kartı */}
          <div className="rounded-2xl bg-muted p-3">
            <div className="flex items-start gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary">
                <Smartphone className="size-3.5 text-primary-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Uygulamanız
                  </span>
                  <span className="text-[9px] text-muted-foreground">şimdi</span>
                </div>
                <div className="mt-0.5 text-[11px] font-semibold leading-tight text-foreground">
                  {title || (
                    <span className="text-muted-foreground">
                      Başlık önizlemesi
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground line-clamp-3">
                  {body || (
                    <span className="text-muted-foreground">
                      Mesaj burada görünür…
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* Boş alan + home indicator */}
          <div className="mt-12 flex justify-center">
            <div className="h-1 w-12 rounded-full bg-foreground/20" />
          </div>
        </div>
      </div>
    </div>
  );
};
