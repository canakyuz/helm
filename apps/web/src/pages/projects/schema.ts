import { z } from "zod";

export const projectSchema = z.object({
  name: z.string().min(1, "Proje adı gerekli"),
  slug: z
    .string()
    .min(1, "Slug gerekli")
    .regex(/^[a-z0-9-]+$/, "Sadece küçük harf, rakam ve tire"),
  app_store_id: z.string().optional(),
  app_store_country: z.string().optional(),
});

export type ProjectFormValues = z.infer<typeof projectSchema>;

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
