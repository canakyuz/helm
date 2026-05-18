import { useMemo, useState } from "react";
import { useInvalidate, useList } from "@refinedev/core";
import {
  Button,
  Card,
  Col,
  Empty,
  Row,
  Table,
  Typography,
  notification,
} from "antd";
import {
  DollarOutlined,
  ReloadOutlined,
  TeamOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { supabaseClient } from "../../providers/supabase-client";
import { TrendChart } from "../../components/trend-chart";
import { StatCard } from "../../components/stat-card";
import { useHelmTheme } from "../../theme/ThemeProvider";
import { compact, deltaPct, latest, series, usd } from "../../lib/metrics";
import type { Metric, Project } from "../../types";

/** Bir metrik için her projenin en güncel tarihli değerini döndürür. */
const latestByProject = (metrics: Metric[], metricName: string) => {
  const map = new Map<string, { value: number; date: string }>();
  for (const m of metrics) {
    if (m.metric !== metricName) continue;
    const current = map.get(m.project_id);
    if (!current || m.date > current.date) {
      map.set(m.project_id, { value: Number(m.value), date: m.date });
    }
  }
  return map;
};

interface ProjectRow {
  key: string;
  name: string;
  mrr: number;
  adRevenue: number;
  dau: number;
  totalUsers: number;
}

export const DashboardPage = () => {
  const [syncing, setSyncing] = useState(false);
  const invalidate = useInvalidate();
  const { theme } = useHelmTheme();

  const since = useMemo(
    () => new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10),
    [],
  );

  const { result: projectsResult, query: projectsQuery } = useList<Project>({
    resource: "projects",
    pagination: { mode: "off" },
  });

  const { result: metricsResult, query: metricsQuery } = useList<Metric>({
    resource: "metrics",
    filters: [{ field: "date", operator: "gte", value: since }],
    pagination: { mode: "off" },
  });

  const projects = projectsResult.data;
  const metrics = metricsResult.data;
  const loading = projectsQuery.isLoading || metricsQuery.isLoading;

  const adRevenueSeries = useMemo(
    () => series(metrics, "ad_revenue"),
    [metrics],
  );
  const dauSeries = useMemo(() => series(metrics, "dau"), [metrics]);

  const rows: ProjectRow[] = useMemo(() => {
    const mrr = latestByProject(metrics, "mrr");
    const adRevenue = latestByProject(metrics, "ad_revenue");
    const dau = latestByProject(metrics, "dau");
    const totalUsers = latestByProject(metrics, "total_users");
    return projects.map((p) => ({
      key: p.id,
      name: p.name,
      mrr: mrr.get(p.id)?.value ?? 0,
      adRevenue: adRevenue.get(p.id)?.value ?? 0,
      dau: dau.get(p.id)?.value ?? 0,
      totalUsers: totalUsers.get(p.id)?.value ?? 0,
    }));
  }, [metrics, projects]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke(
        "helm-ingest",
        { body: {} },
      );
      if (error) throw error;
      notification.success({
        message: "Senkronizasyon tamam",
        description: `${data?.ingested ?? 0} metrik güncellendi.`,
      });
      invalidate({ resource: "metrics", invalidates: ["list"] });
    } catch (e) {
      notification.error({
        message: "Senkronizasyon başarısız",
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Typography.Title level={3} style={{ margin: 0, fontWeight: 600 }}>
          Cockpit
        </Typography.Title>
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          loading={syncing}
          onClick={handleSync}
        >
          Şimdi senkronize et
        </Button>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Toplam MRR"
            value={usd(latest(metrics, "mrr"))}
            icon={<DollarOutlined />}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Reklam Geliri (son gün)"
            value={usd(latest(metrics, "ad_revenue"))}
            icon={<WalletOutlined />}
            delta={deltaPct(adRevenueSeries)}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Toplam DAU"
            value={compact(latest(metrics, "dau"))}
            icon={<TeamOutlined />}
            delta={deltaPct(dauSeries)}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Aktif Abone"
            value={compact(latest(metrics, "active_subs"))}
            loading={loading}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Reklam Geliri — son 90 gün" loading={loading}>
            <TrendChart
              data={adRevenueSeries}
              color={theme.chart.revenue}
              format={usd}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Günlük Aktif Kullanıcı — son 90 gün" loading={loading}>
            <TrendChart
              data={dauSeries}
              color={theme.chart.users}
              format={compact}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Proje Kırılımı" style={{ marginTop: 16 }}>
        {projects.length === 0 && !loading ? (
          <Empty description="Henüz proje eklenmedi" />
        ) : (
          <Table<ProjectRow>
            dataSource={rows}
            loading={loading}
            pagination={false}
          >
            <Table.Column<ProjectRow>
              title="Proje"
              dataIndex="name"
              render={(value) => (
                <Typography.Text strong>{value}</Typography.Text>
              )}
            />
            <Table.Column<ProjectRow>
              title="MRR"
              dataIndex="mrr"
              render={(value) => usd(value)}
            />
            <Table.Column<ProjectRow>
              title="Reklam Geliri"
              dataIndex="adRevenue"
              render={(value) => usd(value)}
            />
            <Table.Column<ProjectRow>
              title="DAU"
              dataIndex="dau"
              render={(value) => compact(value)}
            />
            <Table.Column<ProjectRow>
              title="Toplam Kullanıcı"
              dataIndex="totalUsers"
              render={(value) => compact(value)}
            />
          </Table>
        )}
      </Card>
    </div>
  );
};
