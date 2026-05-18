import { Edit, useForm } from "@refinedev/antd";
import { Form, Input } from "antd";
import type { Project } from "../../types";

export const ProjectEdit = () => {
  const { formProps, saveButtonProps } = useForm<Project>();

  return (
    <Edit saveButtonProps={saveButtonProps} title="Projeyi Düzenle">
      <Form {...formProps} layout="vertical">
        <Form.Item
          label="Proje adı"
          name="name"
          rules={[{ required: true, message: "Proje adı gerekli" }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Slug"
          name="slug"
          rules={[
            { required: true, message: "Slug gerekli" },
            {
              pattern: /^[a-z0-9-]+$/,
              message: "Sadece küçük harf, rakam ve tire",
            },
          ]}
        >
          <Input />
        </Form.Item>
      </Form>
    </Edit>
  );
};
