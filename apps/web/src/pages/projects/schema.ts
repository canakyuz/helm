import { z } from "zod";

export const publishTargetSchema = z.object({
  name: z.string().min(1, "Ad zorunlu"),
  url: z.string().url("Geçerli bir URL gerekli"),
  secret: z.string().min(1, "Secret zorunlu"),
  locales: z.array(z.string()).optional(),
});

export const projectSchema = z.object({
  name: z.string().min(1, "Proje adı zorunlu"),
  slug: z
    .string()
    .min(1, "Slug zorunlu")
    .regex(/^[a-z0-9-]+$/, "Sadece küçük harf, rakam ve tire"),
  app_store_id: z.string().optional(),
  app_store_country: z.string().optional(),
  cms_publish_targets: z.array(publishTargetSchema).optional(),
});

export type ProjectFormValues = z.infer<typeof projectSchema>;
export type PublishTargetFormValues = z.infer<typeof publishTargetSchema>;

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
