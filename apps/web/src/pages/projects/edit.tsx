import { useEffect } from "react";
import { useForm } from "@refinedev/core";
import { useForm as useHookForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { projectSchema, type ProjectFormValues } from "./schema";
import type { Project } from "@/types";

export const ProjectEdit = () => {
  const { onFinish, query } = useForm({ redirect: false });
  const navigate = useNavigate();
  const record = query?.data?.data as Project | undefined;

  const form = useHookForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: "", slug: "" },
  });

  // Record yüklendiğinde formu doldur.
  useEffect(() => {
    if (record) {
      form.reset({ name: record.name, slug: record.slug });
    }
  }, [record?.id]);

  const submit = form.handleSubmit(async (values) => {
    await onFinish(values);
    navigate("/");
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Projeyi Düzenle
      </h1>
      <Card>
        <CardContent>
          <Form {...form}>
            <form onSubmit={submit} className="max-w-md space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proje adı</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit">Kaydet</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};
