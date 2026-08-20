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
  if (!iso) return "never";
  const min = (Date.now() - new Date(iso).getTime()) / 60_000;
  if (min < 1) return "just now";
  if (min < 60) return `${Math.round(min)}m ago`;
  if (min < 1440) return `${Math.round(min / 60)}h ago`;
  return `${Math.round(min / 1440)}d ago`;
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
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
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
              Liquid Glass - {isDark ? "dark" : "light"} mod.
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
          <CardTitle>System info</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[160px_1fr] gap-y-3 text-sm">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-3.5" /> Oturum
            </dt>
            <dd className="font-mono">{identity?.email ?? "-"}</dd>

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
                  <span className="font-mono text-xs text-muted-foreground">
                    ({new Date(lastRun.started_at).toLocaleString("en-US")})
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">never</span>
              )}
            </dd>

            <dt className="flex items-center gap-2 text-muted-foreground">
              <Clock className="size-3.5" /> Cron health
            </dt>
            <dd>
              {syncStale ? (
                <Badge variant="destructive">
                  <XCircle className="mr-1 size-3" />
                  {SYNC_HEALTH_LABEL[syncHealth]}
                </Badge>
              ) : (
                <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-500">
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
          <CardTitle>Automation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            The <code className="font-mono">helm-ingest-hourly</code> cron runs
            every enabled integration on the hour (
            <code className="font-mono">0 * * * *</code>).
          </p>
          <p className="text-muted-foreground">
            It needs <code>helm_project_url</code> and{" "}
            <code>helm_service_role_key</code> in the Supabase Vault.{" "}
            <code className="font-mono">scripts/p0-cron-bootstrap.sql</code>{" "}
            sets both up in one go.
          </p>
          {syncStale && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {SYNC_HEALTH_MESSAGE[syncHealth]}
            </div>
          )}
        </CardContent>
      </Card>

      <CronHealthCard />

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
    </div>
  );
};
