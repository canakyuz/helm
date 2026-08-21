import { useMemo, useState } from "react";
import { type CrudFilter, useList } from "@refinedev/core";
import { Mail, MousePointerClick, Send, Eye } from "lucide-react";
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
    id ? projResult.data.find((p) => p.id === id)?.name ?? "-" : "-";

  const campaigns = result.data;

  // Campaign events - open/click tracking
  interface CampaignEvent {
    campaign_id: number | null;
    event: "sent" | "delivered" | "opened" | "clicked" | "bounced" | "complained";
    email_id: string;
  }
  const { result: eventsResult } = useList<CampaignEvent>({
    resource: "campaign_events",
    pagination: { mode: "off" },
  });
  const events = eventsResult.data;

  // Her campaign için unique opens/clicks
  const statsByCampaign = useMemo(() => {
    const map = new Map<
      number,
      { opened: Set<string>; clicked: Set<string>; delivered: Set<string> }
    >();
    for (const e of events) {
      if (e.campaign_id === null) continue;
      let s = map.get(e.campaign_id);
      if (!s) {
        s = { opened: new Set(), clicked: new Set(), delivered: new Set() };
        map.set(e.campaign_id, s);
      }
      if (e.event === "opened") s.opened.add(e.email_id);
      else if (e.event === "clicked") s.clicked.add(e.email_id);
      else if (e.event === "delivered") s.delivered.add(e.email_id);
    }
    return map;
  }, [events]);

  const totals = useMemo(() => {
    let recipients = 0;
    let sent = 0;
    let failed = 0;
    let opened = 0;
    let clicked = 0;
    for (const c of campaigns) {
      recipients += c.recipients;
      sent += c.sent;
      failed += c.failed;
      const s = statsByCampaign.get(c.id);
      if (s) {
        opened += s.opened.size;
        clicked += s.clicked.size;
      }
    }
    return { recipients, sent, failed, opened, clicked };
  }, [campaigns, statsByCampaign]);
  const openRate =
    totals.sent > 0 ? (totals.opened / totals.sent) * 100 : 0;
  const clickRate =
    totals.sent > 0 ? (totals.clicked / totals.sent) * 100 : 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Kampanya Geçmişi
      </h1>

      {campaigns.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <SummaryCard label="Kampanya" value={campaigns.length} />
          <SummaryCard label="Toplam alıcı" value={totals.recipients} />
          <SummaryCard
            label="Gönderildi"
            value={totals.sent}
            tone="emerald"
          />
          <SummaryCard
            label="Açılma oranı"
            value={`${totals.opened} · %${openRate.toFixed(1)}`}
            tone="primary"
            icon={<Eye className="size-3" />}
          />
          <SummaryCard
            label="Tıklama"
            value={`${totals.clicked} · %${clickRate.toFixed(1)}`}
            tone="primary"
            icon={<MousePointerClick className="size-3" />}
          />
          <SummaryCard
            label="Hatalar"
            value={totals.failed}
            tone="destructive"
          />
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
                  <TableHead className="text-right">Gönderildi</TableHead>
                  <TableHead className="text-right">Açılma oranı</TableHead>
                  <TableHead className="text-right">Tıklama</TableHead>
                  <TableHead className="text-right">Hatalar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => {
                  const s = statsByCampaign.get(c.id);
                  const opens = s?.opened.size ?? 0;
                  const clicks = s?.clicked.size ?? 0;
                  const openPct =
                    c.sent > 0 ? (opens / c.sent) * 100 : 0;
                  const clickPct =
                    c.sent > 0 ? (clicks / c.sent) * 100 : 0;
                  return (
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
                        {c.subject ?? "-"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <Badge className="border-emerald-600/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                          {c.sent} / {c.recipients}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.channel === "mail" ? (
                          opens > 0 ? (
                            <span className="text-foreground">
                              {opens}{" "}
                              <span className="text-xs text-muted-foreground">
                                %{openPct.toFixed(0)}
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              -
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            -
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.channel === "mail" ? (
                          clicks > 0 ? (
                            <span className="text-foreground">
                              {clicks}{" "}
                              <span className="text-xs text-muted-foreground">
                                %{clickPct.toFixed(0)}
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              -
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            -
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.failed > 0 ? (
                          <Badge variant="destructive">{c.failed}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            0
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const SummaryCard = ({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number | string;
  tone?: "emerald" | "destructive" | "primary";
  icon?: React.ReactNode;
}) => {
  const toneCls =
    tone === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "primary"
          ? "text-primary"
          : "";
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className={`mt-1 text-2xl tabular-nums ${toneCls}`}
      >
        {value}
      </div>
    </div>
  );
};
