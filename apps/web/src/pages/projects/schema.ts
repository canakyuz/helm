import { z } from "zod";

export const publishTargetSchema = z.object({
  name: z.string().min(1, "Ad gerekli"),
  url: z.string().url("A valid URL is required"),
  secret: z.string().min(1, "Secret gerekli"),
  locales: z.array(z.string()).optional(),
});

export const projectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  slug: z
    .string()
    .min(1, "Slug gerekli")
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, digits and hyphens only"),
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
