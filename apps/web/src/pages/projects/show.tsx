import { useMemo } from "react";
import { Show } from "@refinedev/antd";
import { useList, useShow } from "@refinedev/core";
import { Card, Col, Row, Tabs } from "antd";
import {
  ApiOutlined,
  BarChartOutlined,
  DollarOutlined,
  TeamOutlined,
  UserOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { IntegrationsPanel } from "../../components/integrations-panel";
import { StatCard } from "../../components/stat-card";
import { TrendChart } from "../../components/trend-chart";
import { useHelmTheme } from "../../theme/ThemeProvider";
import { compact, deltaPct, latest, series, usd } from "../../lib/metrics";
import type { Metric, Project } from "../../types";

export const ProjectShow = () => {
  const { query } = useShow<Project>();
  const record = query.data?.data;
  const { theme } = useHelmTheme();

  const since = useMemo(
    () => new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10),
    [],
  );

  const { result: metricsResult, query: metricsQuery } = useList<Metric>({
    resource: "metrics",
    filters: [
      { field: "project_id", operator: "eq", value: record?.id },
      { field: "date", operator: "gte", value: since },
    ],
    pagination: { mode: "off" },
    queryOptions: { enabled: !!record?.id },
  });

  const metrics = metricsResult.data;
  const loading = query.isLoading || metricsQuery.isLoading;

  const adRevenueSeries = useMemo(
    () => series(metrics, "ad_revenue"),
    [metrics],
  );
  const dauSeries = useMemo(() => series(metrics, "dau"), [metrics]);
  const usersSeries = useMemo(
    () => series(metrics, "total_users"),
    [metrics],
  );

  const overview = (
    <>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="MRR"
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
            title="DAU"
            value={compact(latest(metrics, "dau"))}
            icon={<TeamOutlined />}
            delta={deltaPct(dauSeries)}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Toplam Kullanıcı"
            value={compact(latest(metrics, "total_users"))}
            icon={<UserOutlined />}
            delta={deltaPct(usersSeries)}
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
        <Col xs={24}>
          <Card title="Kullanıcı Büyümesi — son 90 gün" loading={loading}>
            <TrendChart
              data={usersSeries}
              color={theme.chart.revenue}
              format={compact}
              height={200}
            />
          </Card>
        </Col>
      </Row>
    </>
  );

  return (
    <Show isLoading={query.isLoading} title={record?.name ?? "Proje"}>
      <Tabs
        defaultActiveKey="overview"
        items={[
          {
            key: "overview",
            label: (
              <span>
                <BarChartOutlined /> Genel Bakış
              </span>
            ),
            children: overview,
          },
          {
            key: "integrations",
            label: (
              <span>
                <ApiOutlined /> Entegrasyonlar
              </span>
            ),
            children: record?.id ? (
              <IntegrationsPanel projectId={record.id} />
            ) : null,
          },
        ]}
      />
    </Show>
  );
};
