import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useList } from "@refinedev/core";
import { useEffect, useState } from "react";
import { useForm as useHookForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PROPERTY_TYPE_LABELS } from "@/lib/modules";
import { supabaseClient } from "@/providers/supabase-client";
import type { Brand, Property } from "@/types";

const brandSchema = z.object({
  name: z.string().min(1, "Marka adı zorunlu"),
  slug: z
    .string()
    .min(1, "Slug zorunlu")
    .regex(/^[a-z0-9-]+$/, "Sadece küçük harf, rakam ve tire"),
});

type BrandFormValues = z.infer<typeof brandSchema>;

export const BrandEdit = () => {
  const { onFinish, query } = useForm({ resource: "brands", redirect: false });
  const navigate = useNavigate();
  const record = (query?.data?.data ?? undefined) as Brand | undefined;
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { result: propsResult } = useList<Property>({
    resource: "properties",
    pagination: { mode: "off" },
    filters: record ? [{ field: "brand_id", operator: "eq", value: record.id }] : [],
    queryOptions: { enabled: Boolean(record?.id), retry: false },
  });
  const properties: Property[] = propsResult?.data ?? [];

  const form = useHookForm<BrandFormValues>({
    resolver: zodResolver(brandSchema),
    defaultValues: { name: "", slug: "" },
  });

  useEffect(() => {
    if (record) {
      form.reset({ name: record.name, slug: record.slug });
    }
  }, [record?.id]);

  const submit = form.handleSubmit(async (values) => {
    await onFinish(values);
  });

  const deleteBrand = async () => {
    if (!record) return;
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabaseClient.from("brands").delete().eq("id", record.id);
    setDeleting(false);
    if (error) {
      // FK kısıtı (ON DELETE RESTRICT) yakalanıyorsa kullanıcıya net mesaj.
      setDeleteError(
        error.message.includes("violates foreign key")
          ? "Bu markaya bağlı property'ler var. Önce taşı veya sil."
          : error.message,
      );
      return;
    }
    navigate("/");
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Marka ayarları</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Genel</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={submit} className="grid max-w-md gap-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marka adı</FormLabel>
                    <FormControl>
                      <Input placeholder="Dante" {...field} />
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
                      <Input placeholder="dante" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div>
                <Button type="submit">Kaydet</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Property'ler{" "}
            <span className="text-xs font-normal text-muted-foreground">
              ({properties.length})
            </span>
          </CardTitle>
          <CardAction>
            {record && (
              <Button asChild size="sm" variant="outline">
                <Link to={`/properties/create?brand_id=${record.id}`}>
                  <Plus className="size-4" /> Yeni property
                </Link>
              </Button>
            )}
          </CardAction>
        </CardHeader>
        <CardContent>
          {properties.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Bu marka altında henüz property yok.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead className="text-right">Modül</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.slug}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {PROPERTY_TYPE_LABELS[p.type] ?? p.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                      {(p.enabled_modules ?? []).length}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/properties/edit/${p.id}`}>Düzenle</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-destructive">Tehlikeli bölge</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Markayı sil. Bu marka altında property yoksa kalıcı olarak silinir.
            </p>
            <AlertDialog>
              <Button asChild variant="destructive" size="sm">
                <span>
                  <Trash2 className="size-4" /> Markayı sil
                </span>
              </Button>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Marka silinsin mi?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {properties.length > 0
                      ? "Bu markaya bağlı property'ler var. Önce taşı veya sil."
                      : "Bu işlem geri alınamaz."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {deleteError && (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
                    {deleteError}
                  </div>
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel>İptal</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={deleteBrand}
                    disabled={deleting || properties.length > 0}
                  >
                    {deleting ? "Siliniyor…" : "Sil"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
