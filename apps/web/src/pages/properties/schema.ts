import { z } from "zod";

import { MODULE_KEYS, PROPERTY_TYPES } from "@/lib/modules";

export const propertyCreateSchema = z
  .object({
    // Brand seçimi: ya mevcut brand_id ya da yeni brand için isim.
    brand_id: z.string().uuid().optional(),
    new_brand_name: z.string().optional(),
    name: z.string().min(1, "Property adı zorunlu"),
    slug: z
      .string()
      .min(1, "Slug zorunlu")
      .regex(/^[a-z0-9-]+$/, "Sadece küçük harf, rakam ve tire"),
    type: z.enum(PROPERTY_TYPES),
    enabled_modules: z.array(z.enum(MODULE_KEYS)),
    app_store_id: z.string().optional(),
    app_store_country: z.string().optional(),
  })
  .refine((d) => Boolean(d.brand_id) || (d.new_brand_name ?? "").trim().length > 0, {
    path: ["brand_id"],
    message: "Bir marka seç veya yeni marka adı yaz",
  });

export type PropertyCreateValues = z.infer<typeof propertyCreateSchema>;

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
