import { useGetIdentity, useLogout } from "@refinedev/core";
import {
  CheckCircle2,
  Clock,
  Database,
  LogOut,
  Mail,
  Moon,
  Server,
  Sun,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CronHealthCard } from "@/components/settings/cron-health-card";
import {
  SYNC_HEALTH_LABEL,
  SYNC_HEALTH_MESSAGE,
  useLastSyncRun,
} from "@/hooks/use-last-sync-run";
import { useDisplayCurrency } from "@/context/currency";
import { useHelmTheme } from "@/theme/ThemeProvider";

const HUB_URL = import.meta.env.VITE_HELM_SUPABASE_URL as string | undefined;

const timeAgo = (iso: string | null) => {
  if (!iso) return "hiç";
  const min = (Date.now() - new Date(iso).getTime()) / 60_000;
  if (min < 1) return "az önce";
  if (min < 60) return `${Math.round(min)}dk önce`;
  if (min < 1440) return `${Math.round(min / 60)}sa önce`;
  return `${Math.round(min / 1440)}g önce`;
};

interface Identity {
  email?: string;
  id?: string;
}

export const SettingsPage = () => {
  const { theme, toggleMode } = useHelmTheme();
  const { mutate: logout } = useLogout();
  const isDark = theme.mode === "dark";
  const { currency, setCurrency } = useDisplayCurrency();
  const { data: identity } = useGetIdentity<Identity>();

  const { run: lastRun, health: syncHealth, needsAttention: syncStale } =
    useLastSyncRun();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Ayarlar</h1>

      {/* Sekmeler: gunluk ayarlar (Genel) ile altyapi/tani bilgisi
          (Sistem & Otomasyon) ayri okunur - tek uzun sayfa yerine. */}
      <Tabs defaultValue="genel" className="space-y-4">
        <TabsList>
          <TabsTrigger value="genel">Genel</TabsTrigger>
          <TabsTrigger value="sistem">Sistem & Otomasyon</TabsTrigger>
        </TabsList>

        <TabsContent value="genel" className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Görünüm</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                {isDark ? (
                  <Moon className="size-4" />
                ) : (
                  <Sun className="size-4" />
                )}
                <span>Tema modu</span>
              </span>
              <Switch checked={!isDark} onCheckedChange={toggleMode} />
            </Label>
            <p className="text-xs text-muted-foreground">
              {isDark ? "Koyu" : "Açık"} mod.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ekran Para Birimi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label>Para birimi</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
                <SelectItem value="TRY">TRY (₺)</SelectItem>
                <SelectItem value="GBP">GBP (£)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Tüm para metrikleri (MRR, ad revenue, mağaza proceeds, eCPM) bu
              birime çevrilerek gösterilir. FX Frankfurter API'sinden günlük
              çekilir, localStorage'a cache'lenir.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hesap</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => logout()}>
            <LogOut className="size-4" /> Çıkış yap
          </Button>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="sistem" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Sistem bilgisi</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[160px_1fr] gap-y-3 text-sm">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-3.5" /> Oturum
            </dt>
            <dd>{identity?.email ?? "-"}</dd>

            <dt className="flex items-center gap-2 text-muted-foreground">
              <Server className="size-3.5" /> Hub URL
            </dt>
            <dd className="font-mono text-xs">{HUB_URL ?? "-"}</dd>

            <dt className="flex items-center gap-2 text-muted-foreground">
              <Database className="size-3.5" /> Hub Project Ref
            </dt>
            <dd className="font-mono text-xs">
              {HUB_URL?.match(/https:\/\/([^.]+)\./)?.[1] ?? "-"}
            </dd>

            <dt className="flex items-center gap-2 text-muted-foreground">
              <Clock className="size-3.5" /> Son senkron
            </dt>
            <dd className="flex items-center gap-2">
              {lastRun ? (
                <>
                  <span>{timeAgo(lastRun.started_at)}</span>
                  <span className="text-xs text-muted-foreground">
                    ({new Date(lastRun.started_at).toLocaleString("tr-TR")})
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">hiç</span>
              )}
            </dd>

            <dt className="flex items-center gap-2 text-muted-foreground">
              <Clock className="size-3.5" /> Cron sağlığı
            </dt>
            <dd>
              {syncStale ? (
                <Badge variant="destructive">
                  <XCircle className="mr-1 size-3" />
                  {SYNC_HEALTH_LABEL[syncHealth]}
                </Badge>
              ) : (
                <Badge className="border-emerald-600/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="mr-1 size-3" />
                  {SYNC_HEALTH_LABEL[syncHealth]}
                </Badge>
              )}
            </dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Otomasyon</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <code className="font-mono">helm-ingest-hourly</code> cron'u saat
            başı tüm aktif entegrasyonları çalıştırır (
            <code className="font-mono">0 * * * *</code>).
          </p>
          <p className="text-muted-foreground">
            Supabase Vault'ta <code>helm_project_url</code> ve{" "}
            <code>helm_service_role_key</code> gerekir.{" "}
            <code className="font-mono">scripts/p0-cron-bootstrap.sql</code>{" "}
            ikisini de tek seferde kurar.
          </p>
          {syncStale && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {SYNC_HEALTH_MESSAGE[syncHealth]}
            </div>
          )}
        </CardContent>
      </Card>

      <CronHealthCard />
        </TabsContent>
      </Tabs>
    </div>
  );
};
