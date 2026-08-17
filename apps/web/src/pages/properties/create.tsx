import { zodResolver } from "@hookform/resolvers/zod";
import { useList } from "@refinedev/core";
import { useEffect, useMemo, useState } from "react";
import { useForm as useHookForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  availableModules,
  MODULE_META,
  PRESET_MODULES,
  PROPERTY_TYPE_DESCRIPTIONS,
  PROPERTY_TYPE_LABELS,
  PROPERTY_TYPES,
  type ModuleKey,
  type PropertyType,
} from "@/lib/modules";
import { cn } from "@/lib/utils";
import { supabaseClient } from "@/providers/supabase-client";
import type { Brand } from "@/types";

import {
  propertyCreateSchema,
  slugify,
  type PropertyCreateValues,
} from "./schema";

const PROPERTY_TYPE_ICON: Record<PropertyType, string> = {
  website: "🌐",
  web_app: "💻",
  mobile_app: "📱",
  desktop_app: "🖥️",
  game: "🎮",
};

const MOBILE_LIKE: PropertyType[] = ["mobile_app", "game"];

export const PropertyCreate = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const preselectedBrandId = searchParams.get("brand_id");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { result: brandsResult } = useList<Brand>({
    resource: "brands",
    pagination: { mode: "off" },
    queryOptions: { retry: false },
  });
  const brands: Brand[] = brandsResult?.data ?? [];

  const form = useHookForm<PropertyCreateValues>({
    resolver: zodResolver(propertyCreateSchema),
    defaultValues: {
      brand_id: preselectedBrandId ?? undefined,
      new_brand_name: "",
      name: "",
      slug: "",
      type: "mobile_app",
      enabled_modules: PRESET_MODULES.mobile_app,
      app_store_id: "",
      app_store_country: "us",
    },
  });

  const selectedType = form.watch("type");
  const selectedModules = form.watch("enabled_modules");
  const brandId = form.watch("brand_id");

  // Type değişince preset modülleri otomatik doldur (kullanıcı manuel değiştirmediyse).
  // Basit kural: type değişimi sırasında her zaman preset'e resetle.
  useEffect(() => {
    form.setValue("enabled_modules", PRESET_MODULES[selectedType]);
  }, [selectedType, form]);

  const visibleModules = useMemo(() => availableModules(selectedType), [selectedType]);

  const toggleModule = (key: ModuleKey, on: boolean) => {
    const next = on
      ? Array.from(new Set([...selectedModules, key]))
      : selectedModules.filter((k) => k !== key);
    form.setValue("enabled_modules", next, { shouldDirty: true });
  };

  const submit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      let resolvedBrandId = values.brand_id;
      if (!resolvedBrandId) {
        const brandName = (values.new_brand_name ?? "").trim();
        const brandSlug = slugify(brandName);
        const { data: brand, error: brandError } = await supabaseClient
          .from("brands")
          .insert({ name: brandName, slug: brandSlug })
          .select("id")
          .single();
        if (brandError) throw brandError;
        resolvedBrandId = brand!.id;
      }

      const { error: propError } = await supabaseClient.from("properties").insert({
        brand_id: resolvedBrandId,
        name: values.name,
        slug: values.slug,
        type: values.type,
        enabled_modules: values.enabled_modules,
        app_store_id: values.app_store_id || null,
        app_store_country: MOBILE_LIKE.includes(values.type)
          ? values.app_store_country || "us"
          : null,
      });
      if (propError) throw propError;

      navigate("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Yeni Property</h1>
        <p className="text-sm text-muted-foreground">
          Bir property = bir platform (site, mobil uygulama, masaüstü uygulaması). Önce bir brand seç, sonra
          property tipini ve modülleri belirle.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={submit} className="space-y-4">
          {/* 1) Brand */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Brand</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <FormField
                control={form.control}
                name="brand_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mevcut brand</FormLabel>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(v) => {
                        field.onChange(v || undefined);
                        if (v) form.setValue("new_brand_name", "");
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pick a brand (or create one)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {brands.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">veya</span>
                <Separator className="flex-1" />
              </div>

              <FormField
                control={form.control}
                name="new_brand_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Yeni brand</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Dante"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          field.onChange(e);
                          if (e.target.value) form.setValue("brand_id", undefined);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 2) Property bilgisi + type */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">2. Property</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Dante Mobile"
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
                      <Input placeholder="dante-mobile" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property tipi</FormLabel>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                      {PROPERTY_TYPES.map((t) => {
                        const active = field.value === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => field.onChange(t)}
                            className={cn(
                              "flex flex-col items-start gap-1 rounded-md border bg-card p-3 text-left transition",
                              active
                                ? "border-primary ring-2 ring-primary/30"
                                : "hover:bg-accent",
                            )}
                          >
                            <span className="text-xl leading-none">{PROPERTY_TYPE_ICON[t]}</span>
                            <span className="text-sm font-medium">{PROPERTY_TYPE_LABELS[t]}</span>
                            <span className="text-[11px] leading-tight text-muted-foreground">
                              {PROPERTY_TYPE_DESCRIPTIONS[t]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 3) Modüller */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">3. Modules</CardTitle>
              <p className="text-xs text-muted-foreground">
                Tipe göre önerilen modüller otomatik seçildi. Sonra ayarlardan değiştirebilirsin.
              </p>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {visibleModules.map((key) => {
                  const meta = MODULE_META[key];
                  const checked = selectedModules.includes(key);
                  const preset = PRESET_MODULES[selectedType].includes(key);
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
                              önerilen
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

          {/* 4) App Store (sadece mobile_app / game) */}
          {MOBILE_LIKE.includes(selectedType) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">4. App Store</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Yorumlar ve App Store Connect entegrasyonu için. Sonra da eklenebilir.
                </p>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="app_store_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>App Store ID</FormLabel>
                      <FormControl>
                        <Input placeholder="6451234567" {...field} value={field.value ?? ""} />
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
                      <FormLabel>App Store country</FormLabel>
                      <FormControl>
                        <Input placeholder="us" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {submitError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {submitError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              İptal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Kaydediliyor..." : "Create property"}
            </Button>
          </div>

          {!brandId && (form.watch("new_brand_name") ?? "").trim().length === 0 && (
            <p className="text-xs text-muted-foreground">
              İpucu: önce bir brand seç veya yeni brand adı gir.
            </p>
          )}
        </form>
      </Form>
    </div>
  );
};
