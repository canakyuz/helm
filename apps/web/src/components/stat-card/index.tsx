import type { ReactNode } from "react";
import { ArrowDownOutlined, ArrowUpOutlined } from "@ant-design/icons";
import { Card, Typography, theme } from "antd";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  /** Yüzde değişim. null/undefined ise trend satırı gizlenir. */
  delta?: number | null;
  deltaLabel?: string;
  loading?: boolean;
}

// Başlık + büyük değer + trend göstergeli istatistik kartı.
export const StatCard = ({
  title,
  value,
  icon,
  delta,
  deltaLabel = "son 7 gün",
  loading,
}: StatCardProps) => {
  const { token } = theme.useToken();
  const hasDelta =
    delta !== null && delta !== undefined && Number.isFinite(delta);
  const positive = (delta ?? 0) >= 0;

  return (
    <Card
      loading={loading}
      style={{ height: "100%" }}
      styles={{ body: { padding: 20 } }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
        }}
      >
        {icon && (
          <span style={{ color: token.colorTextTertiary, fontSize: 15 }}>
            {icon}
          </span>
        )}
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {title}
        </Typography.Text>
      </div>

      <Typography.Title level={3} style={{ margin: 0, fontWeight: 600 }}>
        {value}
      </Typography.Title>

      {/* Trend satırı her zaman yer kaplar — kartlar aynı boyda kalsın. */}
      <div style={{ marginTop: 6, fontSize: 12, minHeight: 20 }}>
        {hasDelta ? (
          <>
            <span
              style={{
                color: positive ? token.colorSuccess : token.colorError,
                fontWeight: 500,
              }}
            >
              {positive ? <ArrowUpOutlined /> : <ArrowDownOutlined />}{" "}
              {Math.abs(delta as number).toFixed(1)}%
            </span>{" "}
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {deltaLabel}
            </Typography.Text>
          </>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            —
          </Typography.Text>
        )}
      </div>
    </Card>
  );
};
