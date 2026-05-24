import { useMemo, useState } from "react";
import { type CrudFilter, useList } from "@refinedev/core";
import { Mail, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useScope } from "@/context/scope";
import type { Project } from "@/types";

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

const ChannelBadge = ({ channel }: { channel: "mail" | "push" }) => {
  if (channel === "mail") {
    return (
      <Badge variant="secondary">
        <Mail className="size-3" />
        <span className="ml-1">mail</span>
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <Send className="size-3" />
      <span className="ml-1">push</span>
    </Badge>
  );
};

export const CampaignsPage = () => {
  const { scope, isAll } = useScope();
  const [channel, setChannel] = useState<"all" | "mail" | "push">("all");

  const filters: CrudFilter[] = [];
  if (!isAll) {
    filters.push({ field: "project_id", operator: "eq", value: scope });
  }
  if (channel !== "all") {
    filters.push({ field: "channel", operator: "eq", value: channel });
  }

  const { result, query } = useList<Campaign>({
    resource: "campaigns",
    filters,
    sorters: [{ field: "sent_at", order: "desc" }],
    pagination: { mode: "off" },
  });
  const { result: projResult } = useList<Project>({
    resource: "projects",
    pagination: { mode: "off" },
  });
  const projectName = (id: string | null) =>
    id ? projResult.data.find((p) => p.id === id)?.name ?? "—" : "—";

  const campaigns = result.data;
  const totals = useMemo(() => {
    let recipients = 0;
    let sent = 0;
    let failed = 0;
    for (const c of campaigns) {
      recipients += c.recipients;
      sent += c.sent;
      failed += c.failed;
    }
    return { recipients, sent, failed };
  }, [campaigns]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Kampanya Geçmişi
      </h1>

      {campaigns.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border bg-card p-3">
            <div className="text-xs text-muted-foreground">Kampanya</div>
            <div className="mt-1 font-mono text-2xl tabular-nums">
              {campaigns.length}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="text-xs text-muted-foreground">Toplam alıcı</div>
            <div className="mt-1 font-mono text-2xl tabular-nums">
              {totals.recipients}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="text-xs text-muted-foreground">Gönderildi</div>
            <div className="mt-1 font-mono text-2xl tabular-nums text-emerald-500">
              {totals.sent}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="text-xs text-muted-foreground">Hata</div>
            <div className="mt-1 font-mono text-2xl tabular-nums text-destructive">
              {totals.failed}
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Gönderimler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={channel}
            onValueChange={(v) => setChannel(v as "all" | "mail" | "push")}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm kanallar</SelectItem>
              <SelectItem value="mail">Mail</SelectItem>
              <SelectItem value="push">Push</SelectItem>
            </SelectContent>
          </Select>

          {campaigns.length === 0 && !query.isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Henüz kampanya gönderilmedi. Mail veya Push sayfasından bir
              segmente gönderim yap.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zaman</TableHead>
                  <TableHead>Kanal</TableHead>
                  {isAll && <TableHead>Proje</TableHead>}
                  <TableHead>Konu</TableHead>
                  <TableHead className="text-right">Alıcı</TableHead>
                  <TableHead className="text-right">Gönderildi</TableHead>
                  <TableHead className="text-right">Hata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {fmt(c.sent_at)}
                    </TableCell>
                    <TableCell>
                      <ChannelBadge channel={c.channel} />
                    </TableCell>
                    {isAll && (
                      <TableCell className="text-xs">
                        {projectName(c.project_id)}
                      </TableCell>
                    )}
                    <TableCell className="font-medium">
                      {c.subject ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {c.recipients}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-500">
                        {c.sent}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
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
