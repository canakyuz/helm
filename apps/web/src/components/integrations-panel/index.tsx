import { useMemo, useState } from "react";
import { useCreate, useDelete, useList, useUpdate } from "@refinedev/core";
import { Plus, Trash2 } from "lucide-react";
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

export const IntegrationsPanel = ({ projectId }: { projectId: string }) => {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<ProviderName | "">("");
  const [config, setConfig] = useState<Record<string, string>>({});

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
    provider !== "" && fields.every((f) => (config[f.key] ?? "").trim() !== "");

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
                <TableHead className="w-12" />
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
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="icon-sm"
                          aria-label="Sil"
                        >
                          <Trash2 className="size-4" />
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
