import { Create, useForm } from "@refinedev/antd";
import { Form, Input } from "antd";
import type { Project } from "../../types";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const ProjectCreate = () => {
  const { formProps, saveButtonProps, form } = useForm<Project>();

  return (
    <Create saveButtonProps={saveButtonProps} title="Yeni Proje">
      <Form {...formProps} layout="vertical">
        <Form.Item
          label="Proje adı"
          name="name"
          rules={[{ required: true, message: "Proje adı gerekli" }]}
        >
          <Input
            placeholder="Empire Inc"
            onChange={(e) => {
              if (!form.isFieldTouched("slug")) {
                form.setFieldValue("slug", slugify(e.target.value));
              }
            }}
          />
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
          <Input placeholder="empire-inc" />
        </Form.Item>
      </Form>
    </Create>
  );
};
