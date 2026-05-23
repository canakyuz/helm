import { useMemo, useState } from "react";
import { useCreate, useDelete, useList, useUpdate } from "@refinedev/core";
import {
  AlertTriangle,
  Check,
  Play,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabaseClient } from "@/providers/supabase-client";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PROVIDER_LABELS,
  type ProjectIntegration,
  type ProviderName,
} from "@/types";

interface FieldDef {
  key: string;
  label: string;
  secret?: boolean;
  placeholder?: string;
  optional?: boolean;
}

// Her sağlayıcının "bağla" formunda istediği alanlar.
const PROVIDER_FIELDS: Record<ProviderName, FieldDef[]> = {
  revenuecat: [
    {
      key: "rc_project_id",
      label: "RevenueCat Project ID",
      placeholder: "projXXXXXXXX",
    },
    { key: "api_key", label: "v2 Secret API Key", secret: true },
  ],
  admob: [
    {
      key: "publisher_id",
      label: "Publisher ID",
      placeholder: "pub-XXXXXXXXXXXXXXXX",
    },
    { key: "client_id", label: "OAuth Client ID" },
    { key: "client_secret", label: "OAuth Client Secret", secret: true },
    { key: "refresh_token", label: "Refresh Token", secret: true },
    {
      key: "currency",
      label: "Para birimi (ISO kodu — TRY/USD/EUR)",
      placeholder: "USD",
      optional: true,
    },
  ],
  posthog: [
    { key: "project_id", label: "PostHog Project ID", placeholder: "12345" },
    { key: "api_key", label: "Personal API Key", secret: true },
    { key: "host", label: "Host", placeholder: "https://eu.posthog.com" },
  ],
  supabase: [
    {
      key: "project_url",
      label: "Project URL",
      placeholder: "https://xxxx.supabase.co",
    },
    { key: "service_role_key", label: "Service Role Key", secret: true },
  ],
  stripe: [{ key: "secret_key", label: "Stripe Secret Key", secret: true }],
  plausible: [
    { key: "site_id", label: "Site ID (alan adı)", placeholder: "ornek.com" },
    { key: "api_key", label: "API Key", secret: true },
    { key: "host", label: "Host", placeholder: "https://plausible.io" },
  ],
  rest: [
    {
      key: "url",
      label: "Endpoint URL",
      placeholder: "https://api.uygulamam.com/helm-metrics",
    },
    {
      key: "auth_header",
      label: "Authorization header (opsiyonel)",
      secret: true,
      optional: true,
    },
  ],
  sentry: [
    { key: "org_slug", label: "Sentry organizasyon slug" },
    { key: "project_slug", label: "Proje slug" },
    { key: "auth_token", label: "Auth Token", secret: true },
    {
      key: "host",
      label: "Host (self-hosted için)",
      placeholder: "https://sentry.io",
      optional: true,
    },
  ],
};

const PROVIDERS = Object.keys(PROVIDER_LABELS) as ProviderName[];

const SyncBadge = ({ record }: { record: ProjectIntegration }) => {
  if (record.last_sync_status === "ok") {
    return (
      <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-500">
        senkron
      </Badge>
    );
  }
  if (record.last_sync_status === "error") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="destructive" className="cursor-help">
            hata
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">
          {record.last_sync_error ?? "Bilinmeyen hata"}
        </TooltipContent>
      </Tooltip>
    );
  }
  return <Badge variant="secondary">henüz çalışmadı</Badge>;
};

interface TestResult {
  ok?: boolean;
  provider?: string;
  duration_ms?: number;
  count?: number;
  points?: Array<{ date: string; metric: string; value: number }>;
  error?: string;
}

type DiffStatus = "match" | "mismatch" | "missing_stored" | "missing_upstream";

interface DiffRow {
  date: string;
  metric: string;
  upstream: number | null;
  stored: number | null;
  delta: number | null;
  delta_pct: number | null;
  status: DiffStatus;
}

interface VerifyResult {
  ok?: boolean;
  provider?: string;
  duration_ms?: number;
  days?: number;
  counts?: {
    upstream_total: number;
    upstream_in_window: number;
    stored_in_window: number;
  };
  summary?: Record<DiffStatus, number>;
  diffs?: DiffRow[];
  truncated?: boolean;
  error?: string;
}

const fmtNum = (n: number | null) =>
  n === null
    ? "—"
    : Number.isInteger(n)
      ? n.toLocaleString("tr-TR")
      : n.toLocaleString("tr-TR", { maximumFractionDigits: 4 });

const StatusCell = ({ status }: { status: DiffStatus }) => {
  if (status === "match") {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-500">
        <Check className="size-3.5" />
      </span>
    );
  }
  if (status === "mismatch") {
    return (
      <span className="inline-flex items-center gap-1 text-destructive">
        <X className="size-3.5" /> sapma
      </span>
    );
  }
  if (status === "missing_stored") {
    return (
      <span className="inline-flex items-center gap-1 text-amber-500">
        <AlertTriangle className="size-3.5" /> DB'de yok
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-amber-500">
      <AlertTriangle className="size-3.5" /> upstream'de yok
    </span>
  );
};

export const IntegrationsPanel = ({ projectId }: { projectId: string }) => {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<ProviderName | "">("");
  const [config, setConfig] = useState<Record<string, string>>({});

  const [testing, setTesting] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const [verifying, setVerifying] = useState<string | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  const handleTest = async (integrationId: string) => {
    setTesting(integrationId);
    setTestResult(null);
    setTestOpen(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke(
        "helm-test",
        { body: { integration_id: integrationId } },
      );
      if (error) throw error;
      setTestResult(data as TestResult);
    } catch (e) {
      setTestResult({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
      toast.error("Test başarısız");
    } finally {
      setTesting(null);
    }
  };

  const handleVerify = async (integrationId: string) => {
    setVerifying(integrationId);
    setVerifyResult(null);
    setVerifyOpen(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke(
        "helm-verify",
        { body: { integration_id: integrationId, days: 7 } },
      );
      if (error) throw error;
      setVerifyResult(data as VerifyResult);
    } catch (e) {
      setVerifyResult({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
      toast.error("Doğrulama başarısız");
    } finally {
      setVerifying(null);
    }
  };

  const { result, query } = useList<ProjectIntegration>({
    resource: "project_integrations",
    filters: [{ field: "project_id", operator: "eq", value: projectId }],
    pagination: { mode: "off" },
  });

  const { mutate: create, mutation: createMutation } = useCreate();
  const { mutate: update } = useUpdate();
  const { mutate: remove } = useDelete();

  const integrations = result.data;
  const fields = provider ? PROVIDER_FIELDS[provider] : [];
  const valid =
    provider !== "" &&
    fields.every(
      (f) => f.optional || (config[f.key] ?? "").trim() !== "",
    );

  const resetForm = () => {
    setProvider("");
    setConfig({});
  };

  const handleAdd = () => {
    if (!valid) return;
    create(
      {
        resource: "project_integrations",
        values: { project_id: projectId, provider, config, enabled: true },
      },
      {
        onSuccess: () => {
          setOpen(false);
          resetForm();
        },
      },
    );
  };

  const usedProviders = useMemo(
    () => new Set(integrations.map((i) => i.provider)),
    [integrations],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Veri Kaynakları</CardTitle>
        <CardAction>
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) resetForm();
            }}
          >
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Bağla
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Veri kaynağı bağla</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Sağlayıcı</Label>
                  <Select
                    value={provider}
                    onValueChange={(v) => {
                      setProvider(v as ProviderName);
                      setConfig({});
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="RevenueCat / AdMob / PostHog / Supabase" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map((p) => (
                        <SelectItem
                          key={p}
                          value={p}
                          disabled={usedProviders.has(p)}
                        >
                          {PROVIDER_LABELS[p]}
                          {usedProviders.has(p) ? " (bağlı)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {fields.map((f) => (
                  <div key={f.key} className="space-y-2">
                    <Label>{f.label}</Label>
                    <Input
                      type={f.secret ? "password" : "text"}
                      placeholder={f.placeholder}
                      value={config[f.key] ?? ""}
                      onChange={(e) =>
                        setConfig((c) => ({ ...c, [f.key]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    resetForm();
                  }}
                >
                  Vazgeç
                </Button>
                <Button
                  onClick={handleAdd}
                  disabled={!valid || createMutation.isPending}
                >
                  Kaydet
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardAction>
      </CardHeader>

      <CardContent>
        {integrations.length === 0 && !query.isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Henüz veri kaynağı bağlanmadı
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kaynak</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Son senkron</TableHead>
                <TableHead>Aktif</TableHead>
                <TableHead className="w-32 text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {integrations.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">
                    {PROVIDER_LABELS[it.provider]}
                  </TableCell>
                  <TableCell>
                    <SyncBadge record={it} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {it.last_synced_at
                      ? new Date(it.last_synced_at).toLocaleString("tr-TR")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={it.enabled}
                      onCheckedChange={(checked) =>
                        update({
                          resource: "project_integrations",
                          id: it.id,
                          values: { enabled: checked },
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Test"
                      disabled={testing === it.id}
                      onClick={() => handleTest(it.id)}
                    >
                      <Play className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Doğrula"
                      disabled={verifying === it.id}
                      onClick={() => handleVerify(it.id)}
                    >
                      <ShieldCheck className="size-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Sil"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Entegrasyon silinsin mi?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {PROVIDER_LABELS[it.provider]} bağlantısı
                            kaldırılacak. Bu işlem geri alınamaz.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              remove({
                                resource: "project_integrations",
                                id: it.id,
                              })
                            }
                          >
                            Sil
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entegrasyon testi</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {!testResult && (
              <div className="py-4 text-center text-sm text-muted-foreground">
                Connector çalışıyor…
              </div>
            )}
            {testResult && testResult.ok && (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-500">
                    başarılı
                  </Badge>
                  <span className="text-muted-foreground">
                    {testResult.duration_ms}ms · {testResult.count} metrik
                  </span>
                </div>
                <div className="max-h-72 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tarih</TableHead>
                        <TableHead>Metrik</TableHead>
                        <TableHead className="text-right">Değer</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(testResult.points ?? []).slice(0, 50).map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">
                            {p.date}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {p.metric}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {p.value}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {(testResult.points?.length ?? 0) > 50 && (
                  <p className="text-xs text-muted-foreground">
                    İlk 50 satır gösteriliyor (toplam {testResult.count}).
                  </p>
                )}
              </>
            )}
            {testResult && !testResult.ok && (
              <>
                <Badge variant="destructive">hata</Badge>
                <pre className="max-h-72 overflow-auto rounded-md border bg-muted p-3 text-xs">
                  {testResult.error ?? "Bilinmeyen hata"}
                </pre>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Doğrulama — upstream vs DB</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {!verifyResult && (
              <div className="py-4 text-center text-sm text-muted-foreground">
                Connector koşuyor + son 7 günü çekiliyor…
              </div>
            )}
            {verifyResult && verifyResult.ok && verifyResult.summary && (
              <>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-500">
                    {verifyResult.summary.match} eşleşme
                  </Badge>
                  {verifyResult.summary.mismatch > 0 && (
                    <Badge variant="destructive">
                      {verifyResult.summary.mismatch} sapma
                    </Badge>
                  )}
                  {verifyResult.summary.missing_stored > 0 && (
                    <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-500">
                      {verifyResult.summary.missing_stored} DB'de yok
                    </Badge>
                  )}
                  {verifyResult.summary.missing_upstream > 0 && (
                    <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-500">
                      {verifyResult.summary.missing_upstream} upstream'de yok
                    </Badge>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {verifyResult.duration_ms}ms · son {verifyResult.days}g ·
                    upstream {verifyResult.counts?.upstream_in_window}/
                    {verifyResult.counts?.upstream_total} · DB{" "}
                    {verifyResult.counts?.stored_in_window}
                  </span>
                </div>
                <div className="max-h-96 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tarih</TableHead>
                        <TableHead>Metrik</TableHead>
                        <TableHead className="text-right">Upstream</TableHead>
                        <TableHead className="text-right">DB</TableHead>
                        <TableHead className="text-right">Δ%</TableHead>
                        <TableHead>Durum</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(verifyResult.diffs ?? []).map((d, i) => (
                        <TableRow
                          key={i}
                          className={
                            d.status === "mismatch"
                              ? "bg-destructive/5"
                              : d.status === "missing_stored" ||
                                  d.status === "missing_upstream"
                                ? "bg-amber-500/5"
                                : undefined
                          }
                        >
                          <TableCell className="font-mono text-xs">
                            {d.date}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {d.metric}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {fmtNum(d.upstream)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {fmtNum(d.stored)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {d.delta_pct === null
                              ? "—"
                              : `${d.delta_pct > 0 ? "+" : ""}${d.delta_pct.toFixed(1)}%`}
                          </TableCell>
                          <TableCell>
                            <StatusCell status={d.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {verifyResult.truncated && (
                  <p className="text-xs text-muted-foreground">
                    İlk 200 satır gösteriliyor.
                  </p>
                )}
              </>
            )}
            {verifyResult && !verifyResult.ok && (
              <>
                <Badge variant="destructive">hata</Badge>
                <pre className="max-h-72 overflow-auto rounded-md border bg-muted p-3 text-xs">
                  {verifyResult.error ?? "Bilinmeyen hata"}
                </pre>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
