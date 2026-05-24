import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "@refinedev/core";
import { useEffect, useMemo } from "react";
import { useForm as useHookForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  availableModules,
  MODULE_META,
  PRESET_MODULES,
  PROPERTY_TYPES,
  type ModuleKey,
  type PropertyType,
} from "@/lib/modules";
import type { Property } from "@/types";

const propertyEditSchema = z.object({
  name: z.string().min(1, "Property adı gerekli"),
  slug: z
    .string()
    .min(1, "Slug gerekli")
    .regex(/^[a-z0-9-]+$/, "Sadece küçük harf, rakam ve tire"),
  type: z.enum(PROPERTY_TYPES),
  enabled_modules: z.array(z.string()),
  app_store_id: z.string().optional(),
  app_store_country: z.string().optional(),
});

type PropertyEditValues = z.infer<typeof propertyEditSchema>;

const MOBILE_LIKE: PropertyType[] = ["mobile_app", "game"];

export const PropertyEdit = () => {
  const { onFinish, query } = useForm({ resource: "properties", redirect: false });
  const navigate = useNavigate();
  const record = (query?.data?.data ?? undefined) as Property | undefined;

  const form = useHookForm<PropertyEditValues>({
    resolver: zodResolver(propertyEditSchema),
    defaultValues: {
      name: "",
      slug: "",
      type: "mobile_app",
      enabled_modules: [],
      app_store_id: "",
      app_store_country: "us",
    },
  });

  useEffect(() => {
    if (record) {
      form.reset({
        name: record.name,
        slug: record.slug,
        type: record.type,
        enabled_modules: record.enabled_modules ?? [],
        app_store_id: record.app_store_id ?? "",
        app_store_country: record.app_store_country ?? "us",
      });
    }
  }, [record?.id]);

  const currentType = form.watch("type");
  const enabledModules = form.watch("enabled_modules");

  const visibleModules = useMemo(
    () => availableModules(currentType as PropertyType),
    [currentType],
  );

  const toggleModule = (key: ModuleKey, on: boolean) => {
    const next = on
      ? Array.from(new Set([...(enabledModules as string[]), key]))
      : (enabledModules as string[]).filter((k) => k !== key);
    form.setValue("enabled_modules", next, { shouldDirty: true });
  };

  const submit = form.handleSubmit(async (values) => {
    await onFinish({
      ...values,
      app_store_id: values.app_store_id || null,
      app_store_country: MOBILE_LIKE.includes(values.type)
        ? values.app_store_country || "us"
        : null,
    });
    navigate("/");
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Property Ayarları</h1>

      <Form {...form}>
        <form onSubmit={submit} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Genel</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property adı</FormLabel>
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
                name="type"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Tip</FormLabel>
                    <div className="flex flex-wrap gap-2">
                      {PROPERTY_TYPES.map((t) => {
                        const active = field.value === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => field.onChange(t)}
                            className={`rounded-full border px-3 py-1 text-xs transition ${
                              active
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border text-muted-foreground hover:bg-accent"
                            }`}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Tip değişirse bazı modüller anlamsız hale gelebilir; modülleri aşağıdan elle güncelle.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Modüller</CardTitle>
              <p className="text-xs text-muted-foreground">
                Bu property için aktif modüller. Kapatılan modülün sayfaları sidebar'da gizlenir.
              </p>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {visibleModules.map((key) => {
                  const meta = MODULE_META[key];
                  const checked = (enabledModules as string[]).includes(key);
                  const preset = PRESET_MODULES[currentType as PropertyType].includes(key);
                  return (
                    <li
                      key={key}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{meta.label}</span>
                          {preset && (
                            <Badge variant="secondary" className="text-[10px]">
                              tip için önerilen
                            </Badge>
                          )}
                          {meta.comingSoon && (
                            <Badge variant="outline" className="text-[10px]">
                              yakında
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{meta.description}</p>
                      </div>
                      <Switch
                        checked={checked}
                        disabled={meta.comingSoon}
                        onCheckedChange={(v) => toggleModule(key, v)}
                      />
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          {MOBILE_LIKE.includes(currentType as PropertyType) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">App Store</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
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
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Kapat
            </Button>
            <Button type="submit">Kaydet</Button>
          </div>
        </form>
      </Form>
    </div>
  );
};
