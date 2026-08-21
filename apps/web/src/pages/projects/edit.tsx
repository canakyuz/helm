import { useEffect } from "react";
import { useForm } from "@refinedev/core";
import { useFieldArray, useForm as useHookForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import { Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    defaultValues: {
      name: "",
      slug: "",
      app_store_id: "",
      app_store_country: "us",
      cms_publish_targets: [],
    },
  });

  const targets = useFieldArray({
    control: form.control,
    name: "cms_publish_targets",
  });

  // Record yüklendiğinde formu doldur.
  useEffect(() => {
    if (record) {
      form.reset({
        name: record.name,
        slug: record.slug,
        app_store_id: record.app_store_id ?? "",
        app_store_country: record.app_store_country ?? "us",
        cms_publish_targets: record.cms_publish_targets ?? [],
      });
    }
  }, [record?.id]);

  const submit = form.handleSubmit(async (values) => {
    await onFinish(values);
    navigate("/");
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Projeyi düzenle
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
              <FormField
                control={form.control}
                name="app_store_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>App Store ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="6451234567 (yorumlar için)"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="app_store_country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>App Store ülkesi</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="us"
                        {...field}
                        value={field.value ?? ""}
                      />
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="size-4" /> CMS yayın hedefleri
          </CardTitle>
          <CardAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                targets.append({
                  name: "",
                  url: "",
                  secret: "",
                  locales: [],
                })
              }
            >
              <Plus className="size-4" /> Hedef ekle
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Bir içerik yayınlandığında bu hedeflere POST atılır. Webhook payload:{" "}
            <code>{`{ tags: string[], entry: { slug, locale } }`}</code>. Hedefin{" "}
            <code>x-helm-secret</code> header'ını doğrulaması beklenir.
          </p>

          {targets.fields.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Henüz hedef yok. "Hedef ekle" ile başla.
            </p>
          ) : (
            <Form {...form}>
              <div className="flex flex-col gap-3">
                {targets.fields.map((field, idx) => (
                  <div
                    key={field.id}
                    className="grid gap-3 rounded-md border bg-card p-3 md:grid-cols-12"
                  >
                    <FormField
                      control={form.control}
                      name={`cms_publish_targets.${idx}.name`}
                      render={({ field }) => (
                        <FormItem className="md:col-span-3">
                          <FormLabel className="text-xs">Ad</FormLabel>
                          <FormControl>
                            <Input placeholder="friday-prod" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`cms_publish_targets.${idx}.url`}
                      render={({ field }) => (
                        <FormItem className="md:col-span-4">
                          <FormLabel className="text-xs">Webhook URL</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://friday.app/api/revalidate"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`cms_publish_targets.${idx}.secret`}
                      render={({ field }) => (
                        <FormItem className="md:col-span-3">
                          <FormLabel className="text-xs">Secret</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="random-32-char"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`cms_publish_targets.${idx}.locales`}
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel className="text-xs">
                            Diller (virgül)
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="en,tr (boş = tümü)"
                              value={(field.value ?? []).join(",")}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="md:col-span-12 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => targets.remove(idx)}
                      >
                        <Trash2 className="size-4" /> Kaldır
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
