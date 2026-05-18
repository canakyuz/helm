import {
  DateField,
  DeleteButton,
  EditButton,
  List,
  ShowButton,
  useTable,
} from "@refinedev/antd";
import { Space, Table, Typography } from "antd";
import type { Project } from "../../types";

export const ProjectList = () => {
  const { tableProps } = useTable<Project>({
    resource: "projects",
    sorters: { initial: [{ field: "created_at", order: "desc" }] },
  });

  return (
    <List title="Projeler">
      <Table {...tableProps} rowKey="id">
        <Table.Column
          dataIndex="name"
          title="Proje"
          render={(value: string) => <Typography.Text strong>{value}</Typography.Text>}
        />
        <Table.Column
          dataIndex="slug"
          title="Slug"
          render={(value: string) => <Typography.Text code>{value}</Typography.Text>}
        />
        <Table.Column
          dataIndex="created_at"
          title="Eklendi"
          render={(value: string) => <DateField value={value} format="DD MMM YYYY" />}
        />
        <Table.Column<Project>
          title="İşlemler"
          dataIndex="actions"
          width={140}
          render={(_, record) => (
            <Space>
              <ShowButton hideText size="small" recordItemId={record.id} />
              <EditButton hideText size="small" recordItemId={record.id} />
              <DeleteButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  );
};
