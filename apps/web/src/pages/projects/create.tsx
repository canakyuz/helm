import { useForm } from "@refinedev/core";
import { useForm as useHookForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { projectSchema, slugify, type ProjectFormValues } from "./schema";

export const ProjectCreate = () => {
  const { onFinish } = useForm();
  const form = useHookForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: "", slug: "" },
  });

  const submit = form.handleSubmit(async (values) => {
    await onFinish(values);
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Yeni Proje</h1>
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
                      <Input
                        placeholder="Empire Inc"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          if (!form.getFieldState("slug").isDirty) {
                            form.setValue("slug", slugify(e.target.value));
                          }
                        }}
                      />
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
                      <Input placeholder="empire-inc" {...field} />
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
