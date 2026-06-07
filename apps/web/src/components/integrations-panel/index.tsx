import { useMemo, useState } from "react";
import { useCreate, useDelete, useList, useUpdate } from "@refinedev/core";
import {
  AlertTriangle,
  Check,
  Pencil,
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
import { Textarea } from "@/components/ui/textarea";
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
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  PROVIDER_META,
  type ProviderCategory,
} from "@/lib/integrations";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldDef {
  key: string;
  label: string;
  secret?: boolean;
  placeholder?: string;
  optional?: boolean;
  multiline?: boolean;
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
    {
      key: "currency",
      label: "Para birimi (ISO kodu — RC raporlama, genelde USD)",
      placeholder: "USD",
      optional: true,
    },
    {
      key: "mrr_cents",
      label: "Fiyat ondalığı (hep .99 ise — MRR kuruşunu RC yuvarlamasına rağmen ekler)",
      placeholder: "0.99",
      optional: true,
    },
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
    {
      key: "funnel_steps",
      label: "Huni adımları (virgülle ayır, event adları)",
      placeholder: "app_opened, signup, onboarding_complete, purchase",
      optional: true,
    },
  ],
  supabase: [
    {
      key: "project_url",
      label: "Project URL",
      placeholder: "https://xxxx.supabase.co",
    },
    { key: "service_role_key", label: "Service Role Key", secret: true },
    {
      key: "crm_tables",
      label: "CRM tabloları (virgülle ayır, opsiyonel `tablo:kolon`)",
      placeholder: "profiles:id, gems, subscriptions",
      optional: true,
    },
    {
      key: "push_token_table",
      label: "Push token tablosu (Expo)",
      placeholder: "profiles",
      optional: true,
    },
    {
      key: "push_token_column",
      label: "Push token kolonu",
      placeholder: "expo_push_token",
      optional: true,
    },
    {
      key: "push_user_column",
      label: "Push tablosunda user UUID kolonu",
      placeholder: "id",
      optional: true,
    },
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
  resend: [
    {
      key: "api_key",
      label: "Resend API Key",
      placeholder: "re_xxxxxxxxxxxxxxxxxxxxxxxx",
      secret: true,
    },
    {
      key: "from_email",
      label: "Gönderen e-posta (Resend'de doğrulanmış domain)",
      placeholder: "no-reply@helm.app",
    },
    {
      key: "from_name",
      label: "Gönderen adı",
      placeholder: "Helm",
      optional: true,
    },
  ],
  app_store_connect: [
    {
      key: "app_store_id",
      label: "App Store ID (App Store URL'inde id sonrası rakam — yorumlar için)",
      placeholder: "6451234567",
      optional: true,
    },
    {
      key: "app_store_country",
      label: "App Store ülke kodları (virgülle ayır — yorumlar için)",
      placeholder: "tr,us,gb,de",
      optional: true,
    },
    {
      key: "issuer_id",
      label: "Issuer ID (Team Key için — Individual API Key'de BOŞ bırak)",
      placeholder: "57246542-96fe-1a63-e053-0824d011072a",
      optional: true,
    },
    {
      key: "key_id",
      label: "Key ID",
      placeholder: "2X9R4HXF34",
    },
    {
      key: "private_key",
      label: "Private Key (.p8 içeriği — BEGIN/END dahil)",
      secret: true,
      multiline: true,
      placeholder: "-----BEGIN PRIVATE KEY-----\nMIGT...\n-----END PRIVATE KEY-----",
    },
    {
      key: "vendor_number",
      label: "Vendor Number (Payments and Financial Reports)",
      placeholder: "85123456",
    },
    {
      key: "currency",
      label: "Proceeds para birimi (ISO kodu)",
      placeholder: "USD",
      optional: true,
    },
  ],
  google_play_developer: [
    {
      key: "service_account_json",
      label: "Service Account JSON (Google Cloud → IAM → Service Accounts → Keys → CREATE → JSON; içeriğin TAMAMINI yapıştır)",
      placeholder: '{\n  "type": "service_account",\n  "project_id": "...",\n  "private_key_id": "...",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n",\n  "client_email": "helm@your-project.iam.gserviceaccount.com",\n  ...\n}',
      secret: true,
      multiline: true,
    },
    {
      key: "package_name",
      label: "Package Name (opsiyonel — boşsa properties.google_play_id'den okunur)",
      placeholder: "com.example.app",
      optional: true,
    },
    {
      key: "language_codes",
      label: "Yorum çeviri dilleri (virgülle, opsiyonel — reviews için, versions etkilenmez)",
      placeholder: "en,tr",
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
  const [editingId, setEditingId] = useState<string | null>(null);
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
  const { mutate: update, mutation: updateMutation } = useUpdate();
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
    setEditingId(null);
  };

  const handleEdit = (it: ProjectIntegration) => {
    setEditingId(it.id);
    setProvider(it.provider);
    setConfig((it.config ?? {}) as Record<string, string>);
    setOpen(true);
  };

  const handleSave = () => {
    if (!valid) return;
    if (editingId) {
      update(
        {
          resource: "project_integrations",
          id: editingId,
          values: { config },
        },
        {
          onSuccess: () => {
            setOpen(false);
            resetForm();
          },
        },
      );
    } else {
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
    }
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
            <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
              <DialogHeader>
                <DialogTitle>
                  {editingId
                    ? `${PROVIDER_LABELS[provider as ProviderName]} düzenle`
                    : "Veri kaynağı bağla"}
                </DialogTitle>
              </DialogHeader>

              <div className="flex-1 space-y-4 overflow-y-auto py-2 pr-1">
                <div className="space-y-2">
                  <Label>Sağlayıcı</Label>
                  <Select
                    value={provider}
                    disabled={!!editingId}
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
                          disabled={usedProviders.has(p) && !editingId}
                        >
                          {PROVIDER_LABELS[p]}
                          {usedProviders.has(p) && !editingId ? " (bağlı)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {fields.map((f) => (
                  <div key={f.key} className="space-y-2">
                    <Label>{f.label}</Label>
                    {f.multiline ? (
                      <Textarea
                        placeholder={f.placeholder}
                        rows={f.secret ? 8 : 4}
                        value={config[f.key] ?? ""}
                        onChange={(e) =>
                          setConfig((c) => ({ ...c, [f.key]: e.target.value }))
                        }
                        wrap="soft"
                        className={cn(
                          "w-full max-w-full resize-y break-all whitespace-pre-wrap [field-sizing:fixed]",
                          f.secret ? "font-mono text-xs" : undefined,
                        )}
                      />
                    ) : (
                      <Input
                        type={f.secret ? "password" : "text"}
                        placeholder={f.placeholder}
                        value={config[f.key] ?? ""}
                        onChange={(e) =>
                          setConfig((c) => ({ ...c, [f.key]: e.target.value }))
                        }
                      />
                    )}
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
                  onClick={handleSave}
                  disabled={
                    !valid ||
                    createMutation.isPending ||
                    updateMutation.isPending
                  }
                >
                  Kaydet
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-6">
        {CATEGORY_ORDER.map((cat) => {
          // Bu kategorideki tüm provider'lar (bağlı + bağlı olmayan)
          const providersInCat = (Object.keys(PROVIDER_LABELS) as ProviderName[])
            .filter((p) => PROVIDER_META[p]?.category === cat);
          if (providersInCat.length === 0) return null;
          const connectedCount = integrations.filter(
            (i) => providersInCat.includes(i.provider),
          ).length;
          return (
            <div key={cat} className="space-y-2">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <span className="font-medium">{CATEGORY_LABELS[cat]}</span>
                <span className="font-mono tabular-nums">
                  {connectedCount} / {providersInCat.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {providersInCat.map((p) => {
                  const integration = integrations.find(
                    (i) => i.provider === p,
                  );
                  return (
                    <ProviderCard
                      key={p}
                      provider={p}
                      integration={integration}
                      testing={testing === integration?.id}
                      verifying={verifying === integration?.id}
                      onTest={() =>
                        integration && handleTest(integration.id as string)
                      }
                      onVerify={() =>
                        integration && handleVerify(integration.id as string)
                      }
                      onEdit={() => integration && handleEdit(integration)}
                      onToggle={(checked) =>
                        integration &&
                        update({
                          resource: "project_integrations",
                          id: integration.id,
                          values: { enabled: checked },
                        })
                      }
                      onDelete={() =>
                        integration &&
                        remove({
                          resource: "project_integrations",
                          id: integration.id,
                        })
                      }
                      onConnect={() => {
                        setProvider(p);
                        setConfig({});
                        setEditingId(null);
                        setOpen(true);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
        {integrations.length === 0 && !query.isLoading && (
          <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            Henüz hiçbir veri kaynağı bağlanmadı. Yukarıdaki kartlardan
            <strong> Bağla</strong> ile başla.
          </div>
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

/* ───────────────────────── ProviderCard (yeni grid) ───────────────────────── */

interface ProviderCardProps {
  provider: ProviderName;
  integration?: ProjectIntegration;
  testing: boolean;
  verifying: boolean;
  onTest: () => void;
  onVerify: () => void;
  onEdit: () => void;
  onToggle: (checked: boolean) => void;
  onDelete: () => void;
  onConnect: () => void;
}

const ProviderIcon = ({ name }: { name: string }) => {
  const Comp = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name];
  if (!Comp) return <Icons.Box className="size-5" />;
  return <Comp className="size-5" />;
};

const ProviderCard = ({
  provider,
  integration,
  testing,
  verifying,
  onTest,
  onVerify,
  onEdit,
  onToggle,
  onDelete,
  onConnect,
}: ProviderCardProps) => {
  const meta = PROVIDER_META[provider];
  const connected = !!integration;
  const status = integration?.last_sync_status;
  const lastSync = integration?.last_synced_at
    ? new Date(integration.last_synced_at).toLocaleString("tr-TR")
    : null;

  return (
    <div
      className={cn(
        "group flex flex-col gap-2 rounded-lg border bg-card/40 p-3 transition-colors",
        connected ? "hover:bg-card/80" : "opacity-60 hover:opacity-100",
      )}
    >
      {/* Header: ikon + ad + sync badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-md ring-1 ring-foreground/10",
              status === "ok"
                ? "bg-emerald-500/10 text-emerald-500"
                : status === "error"
                  ? "bg-destructive/10 text-destructive"
                  : connected
                    ? "bg-muted text-foreground"
                    : "bg-muted/50 text-muted-foreground",
            )}
          >
            <ProviderIcon name={meta?.icon ?? "Box"} />
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium text-sm">
              {PROVIDER_LABELS[provider]}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              {meta?.description ?? ""}
            </div>
          </div>
        </div>
        {connected && integration && (
          <SyncBadge record={integration} />
        )}
      </div>

      {/* Footer: durum + aksiyon butonları */}
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        {connected && integration ? (
          <>
            <div className="min-w-0">
              {lastSync ? (
                <div className="truncate text-[10px] text-muted-foreground">
                  Son: {lastSync}
                </div>
              ) : (
                <div className="text-[10px] text-muted-foreground">
                  Henüz çalışmadı
                </div>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              <Switch
                checked={integration.enabled}
                onCheckedChange={onToggle}
                className="mr-1 scale-75"
                aria-label="Aktif/Pasif"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Test"
                disabled={testing}
                onClick={onTest}
              >
                <Play className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Doğrula"
                disabled={verifying}
                onClick={onVerify}
              >
                <ShieldCheck className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Düzenle"
                onClick={onEdit}
              >
                <Pencil className="size-3.5" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Sil"
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Bağlantı kaldırılsın mı?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {PROVIDER_LABELS[provider]} entegrasyonu silinir. Geri
                      alınamaz.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete}>
                      Sil
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onConnect}
          >
            <Plus className="size-3.5" />
            <span className="ml-1">Bağla</span>
          </Button>
        )}
      </div>
    </div>
  );
};
