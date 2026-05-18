import { useState } from "react";
import {
  useCreate,
  useDelete,
  useList,
  useUpdate,
} from "@refinedev/core";
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import {
  PROVIDER_LABELS,
  type ProjectIntegration,
  type ProviderName,
} from "../../types";

interface FieldDef {
  key: string;
  label: string;
  secret?: boolean;
  placeholder?: string;
}

// Her sağlayıcının "tek tıkla bağla" formunda istediği alanlar.
const PROVIDER_FIELDS: Record<ProviderName, FieldDef[]> = {
  revenuecat: [
    { key: "rc_project_id", label: "RevenueCat Project ID", placeholder: "projXXXXXXXX" },
    { key: "api_key", label: "v2 Secret API Key", secret: true },
  ],
  admob: [
    { key: "publisher_id", label: "Publisher ID", placeholder: "pub-XXXXXXXXXXXXXXXX" },
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
    { key: "project_url", label: "Project URL", placeholder: "https://xxxx.supabase.co" },
    { key: "service_role_key", label: "Service Role Key", secret: true },
  ],
};

const PROVIDER_OPTIONS = (Object.keys(PROVIDER_LABELS) as ProviderName[]).map(
  (p) => ({ label: PROVIDER_LABELS[p], value: p }),
);

const syncTag = (record: ProjectIntegration) => {
  if (record.last_sync_status === "ok") return <Tag color="green">senkron</Tag>;
  if (record.last_sync_status === "error")
    return (
      <Tooltip title={record.last_sync_error ?? "Bilinmeyen hata"}>
        <Tag color="red" style={{ cursor: "help" }}>
          hata
        </Tag>
      </Tooltip>
    );
  return <Tag>henüz çalışmadı</Tag>;
};

export const IntegrationsPanel = ({ projectId }: { projectId: string }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const provider: ProviderName | undefined = Form.useWatch("provider", form);

  const { result, query } = useList<ProjectIntegration>({
    resource: "project_integrations",
    filters: [{ field: "project_id", operator: "eq", value: projectId }],
    pagination: { mode: "off" },
  });

  const { mutate: create, mutation: createMutation } = useCreate();
  const { mutate: update } = useUpdate();
  const { mutate: remove } = useDelete();

  const integrations = result.data;
  const isLoading = query.isLoading;
  const creating = createMutation.isPending;

  const handleAdd = () => {
    form.validateFields().then((values) => {
      create(
        {
          resource: "project_integrations",
          values: {
            project_id: projectId,
            provider: values.provider,
            config: values.config ?? {},
            enabled: true,
          },
        },
        {
          onSuccess: () => {
            setModalOpen(false);
            form.resetFields();
          },
        },
      );
    });
  };

  return (
    <Card
      title="Entegrasyonlar"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalOpen(true)}
        >
          Bağla
        </Button>
      }
    >
      {integrations.length === 0 && !isLoading ? (
        <Empty description="Henüz veri kaynağı bağlanmadı" />
      ) : (
        <Table
          dataSource={integrations}
          rowKey="id"
          loading={isLoading}
          pagination={false}
        >
          <Table.Column
            title="Kaynak"
            dataIndex="provider"
            render={(p: ProviderName) => (
              <Typography.Text strong>{PROVIDER_LABELS[p]}</Typography.Text>
            )}
          />
          <Table.Column
            title="Durum"
            dataIndex="last_sync_status"
            render={(_, record: ProjectIntegration) => syncTag(record)}
          />
          <Table.Column
            title="Son senkron"
            dataIndex="last_synced_at"
            render={(value: string | null) =>
              value ? new Date(value).toLocaleString("tr-TR") : "—"
            }
          />
          <Table.Column
            title="Aktif"
            dataIndex="enabled"
            render={(enabled: boolean, record: ProjectIntegration) => (
              <Switch
                checked={enabled}
                size="small"
                onChange={(checked) =>
                  update({
                    resource: "project_integrations",
                    id: record.id,
                    values: { enabled: checked },
                  })
                }
              />
            )}
          />
          <Table.Column
            title=""
            dataIndex="actions"
            width={60}
            render={(_, record: ProjectIntegration) => (
              <Popconfirm
                title="Entegrasyon silinsin mi?"
                onConfirm={() =>
                  remove({
                    resource: "project_integrations",
                    id: record.id,
                  })
                }
                okText="Sil"
                cancelText="Vazgeç"
              >
                <Button danger size="small" icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          />
        </Table>
      )}

      <Modal
        title="Veri kaynağı bağla"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleAdd}
        okText="Kaydet"
        cancelText="Vazgeç"
        confirmLoading={creating}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Sağlayıcı"
            name="provider"
            rules={[{ required: true, message: "Sağlayıcı seç" }]}
          >
            <Select
              options={PROVIDER_OPTIONS}
              placeholder="RevenueCat / AdMob / PostHog / Supabase"
            />
          </Form.Item>

          {provider &&
            PROVIDER_FIELDS[provider].map((field) => (
              <Form.Item
                key={field.key}
                label={field.label}
                name={["config", field.key]}
                rules={[{ required: true, message: `${field.label} gerekli` }]}
              >
                {field.secret ? (
                  <Input.Password placeholder={field.placeholder} />
                ) : (
                  <Input placeholder={field.placeholder} />
                )}
              </Form.Item>
            ))}
        </Form>
      </Modal>
    </Card>
  );
};
