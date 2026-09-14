import { useMemo, useState } from "react";
import { ExternalLink, Share2, TriangleAlert } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageStatus } from "@/components/ui/page-status";
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
import { useSocialAccountDaily, useSocialAccounts, useSocialKpis } from "@/hooks/use-social";

const WINDOWS = [7, 30, 90] as const;
type Window = (typeof WINDOWS)[number];

const fmtInt = (n: number | null | undefined) =>
  n == null ? "-" : new Intl.NumberFormat("tr-TR").format(n);
const fmtDelta = (d: number | null | undefined) =>
  d == null ? null : `${d >= 0 ? "+" : ""}${d.toFixed(1)}%`;

function Kpi({ label, value, delta }: { label: string; value: string; delta: string | null }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{delta ?? "önceki dönem yok"}</div>
      </CardContent>
    </Card>
  );
}

export const SocialPage = () => {
  const [days, setDays] = useState<Window>(30);
  const accounts = useSocialAccounts();
  const kpis = useSocialKpis(days);
  const accountIds = useMemo(() => (accounts.data ?? []).map((a) => a.id), [accounts.data]);
  const daily = useSocialAccountDaily(accountIds, days);

  // Gun bazinda tum hesaplarin toplami - grafik icin. O(n).
  const series = useMemo(() => {
    const byDay = new Map<string, { date: string; impressions: number; engagements: number }>();
    for (const r of daily.data ?? []) {
      const cur = byDay.get(r.date) ?? { date: r.date, impressions: 0, engagements: 0 };
      cur.impressions += r.impressions;
      cur.engagements += r.engagements;
      byDay.set(r.date, cur);
    }
    return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [daily.data]);

  if (accounts.isLoading || kpis.isLoading) return <PageStatus tone="loading" label="Sosyal veriler yükleniyor" />;
  if (accounts.error) return <PageStatus tone="error" label={accounts.error.message} />;
  if ((accounts.data ?? []).length === 0) {
    return (
      <PageStatus
        tone="empty"
        label="Bağlı sosyal hesap yok. Entegrasyonlar → Zernio ile bağla, sonra Senkronla."
      />
    );
  }

  const k = kpis.data;
  const needsReconnect = (accounts.data ?? []).filter((a) => a.needs_reconnection);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Share2 className="size-5" /> Sosyal
        </h1>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v) as Window)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {WINDOWS.map((w) => (
              <SelectItem key={w} value={String(w)}>Son {w} gün</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {needsReconnect.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <TriangleAlert className="size-4 text-amber-500" />
          {needsReconnect.map((a) => `${a.platform} · ${a.username ?? a.id}`).join(", ")} bağlantısı koptu.
          <a className="underline" href="https://zernio.com" target="_blank" rel="noreferrer">Zernio'da yeniden bağla</a>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Takipçi" value={fmtInt(k?.followers)} delta={fmtDelta(k?.followersDelta)} />
        <Kpi label="Impression" value={fmtInt(k?.impressions)} delta={fmtDelta(k?.impressionsDelta)} />
        <Kpi label="Reach" value={fmtInt(k?.reach)} delta={fmtDelta(k?.reachDelta)} />
        <Kpi label="Etkileşim" value={fmtInt(k?.engagements)} delta={fmtDelta(k?.engagementsDelta)} />
        <Kpi label="Yayınlanan" value={fmtInt(k?.postsPublished)} delta={null} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Impression ve etkileşim (yayın gününe göre)</CardTitle></CardHeader>
        <CardContent className="h-64">
          {series.length === 0 ? (
            <PageStatus tone="empty" label="Bu pencerede yayın yok" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} fontSize={11} />
                <YAxis fontSize={11} width={40} />
                <Tooltip />
                <Line type="monotone" dataKey="impressions" stroke="currentColor" dot={false} name="Impression" />
                <Line type="monotone" dataKey="engagements" stroke="#f59e0b" dot={false} name="Etkileşim" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Hesaplar</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hesap</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead className="text-right">Takipçi</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(accounts.data ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="flex items-center gap-2">
                    {a.avatar_url && <img src={a.avatar_url} alt="" className="size-6 rounded-full" />}
                    <span>{a.display_name ?? a.username ?? a.id}</span>
                    {a.username && <span className="text-muted-foreground">@{a.username}</span>}
                  </TableCell>
                  <TableCell><Badge variant="secondary">{a.platform}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{fmtInt(a.followers_count)}</TableCell>
                  <TableCell>
                    {a.needs_reconnection ? (
                      <Badge variant="destructive">yeniden bağla</Badge>
                    ) : a.is_active ? (
                      <Badge>aktif</Badge>
                    ) : (
                      <Badge variant="outline">pasif</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {a.profile_url && (
                      <a href={a.profile_url} target="_blank" rel="noreferrer" aria-label="Profili aç">
                        <ExternalLink className="size-4" />
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
