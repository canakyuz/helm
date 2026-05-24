import { useMemo } from "react";
import { useGetIdentity, useList, useLogout } from "@refinedev/core";
import {
  CheckCircle2,
  Clock,
  Database,
  LogOut,
  Mail,
  Server,
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
import { useDisplayCurrency } from "@/context/currency";
import { useHelmTheme } from "@/theme/ThemeProvider";
import type { SyncRun } from "@/types";

const HUB_URL = import.meta.env.VITE_HELM_SUPABASE_URL as string | undefined;

const timeAgo = (iso: string | null) => {
  if (!iso) return "hiç";
  const min = (Date.now() - new Date(iso).getTime()) / 60_000;
  if (min < 1) return "az önce";
  if (min < 60) return `${Math.round(min)} dk önce`;
  if (min < 1440) return `${Math.round(min / 60)} sa önce`;
  return `${Math.round(min / 1440)} gün önce`;
};

interface Identity {
  email?: string;
  id?: string;
}

export const SettingsPage = () => {
  const { themeKey, setThemeKey, themes } = useHelmTheme();
  const { mutate: logout } = useLogout();
  const { currency, setCurrency } = useDisplayCurrency();
  const { data: identity } = useGetIdentity<Identity>();

  const { result: runsResult } = useList<SyncRun>({
    resource: "sync_runs",
    sorters: [{ field: "started_at", order: "desc" }],
    pagination: { mode: "off" },
  });
  const lastRun = runsResult.data[0];
  const syncStale = useMemo(() => {
    if (!lastRun?.started_at) return true;
    return Date.now() - new Date(lastRun.started_at).getTime() > 3 * 3_600_000;
  }, [lastRun]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Ayarlar</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Görünüm</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label>Tema</Label>
            <Select value={themeKey} onValueChange={setThemeKey}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {themes.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <CardTitle>Sistem Bilgisi</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[160px_1fr] gap-y-3 text-sm">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-3.5" /> Oturum
            </dt>
            <dd className="font-mono">{identity?.email ?? "—"}</dd>

            <dt className="flex items-center gap-2 text-muted-foreground">
              <Server className="size-3.5" /> Hub URL
            </dt>
            <dd className="font-mono text-xs">{HUB_URL ?? "—"}</dd>

            <dt className="flex items-center gap-2 text-muted-foreground">
              <Database className="size-3.5" /> Hub Project Ref
            </dt>
            <dd className="font-mono text-xs">
              {HUB_URL?.match(/https:\/\/([^.]+)\./)?.[1] ?? "—"}
            </dd>

            <dt className="flex items-center gap-2 text-muted-foreground">
              <Clock className="size-3.5" /> Son senkron
            </dt>
            <dd className="flex items-center gap-2">
              {lastRun ? (
                <>
                  <span>{timeAgo(lastRun.started_at)}</span>
                  <span className="font-mono text-xs text-muted-foreground">
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
                  3 saatten fazla senkron yok
                </Badge>
              ) : (
                <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-500">
                  <CheckCircle2 className="mr-1 size-3" />
                  saatlik cron çalışıyor
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
            <code className="font-mono">helm-ingest-hourly</code> cron'u her
            saatin başında (<code className="font-mono">0 * * * *</code>) tüm
            aktif entegrasyonları çalıştırır.
          </p>
          <p className="text-muted-foreground">
            Etkinleşmesi için Supabase Vault'a <code>helm_project_url</code> +{" "}
            <code>helm_service_role_key</code> girilmiş olmalı.{" "}
            <code className="font-mono">scripts/p0-cron-bootstrap.sql</code>{" "}
            tek tıkla kurulum.
          </p>
          {syncStale && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Cron çalışmıyor olabilir. Vault secret'larını ve{" "}
              <code>cron.job</code> tablosunu kontrol et.
            </div>
          )}
        </CardContent>
      </Card>

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
