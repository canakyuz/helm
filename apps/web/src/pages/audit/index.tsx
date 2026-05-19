import { useList } from "@refinedev/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditLog } from "@/types";

// Müdahale geçmişi — gem ver / premium aç / ban gibi kullanıcı aksiyonları.
// helm-action fonksiyonu eklenince dolacak; tablo (audit_log) şimdiden hazır.
export const AuditPage = () => {
  const { result, query } = useList<AuditLog>({
    resource: "audit_log",
    sorters: [{ field: "created_at", order: "desc" }],
    pagination: { mode: "off" },
  });
  const logs = result.data;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Müdahale Geçmişi
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Kullanıcı Müdahaleleri</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 && !query.isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Henüz müdahale kaydı yok. Kullanıcı detayından bir aksiyon (gem
              ver, premium aç, ban) yapıldığında — kim, ne zaman, hangi
              kullanıcı — burada kaydedilir.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zaman</TableHead>
                  <TableHead>Kullanıcı</TableHead>
                  <TableHead>Aksiyon</TableHead>
                  <TableHead>Detay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      {new Date(l.created_at).toLocaleString("tr-TR")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {l.target_user ?? "—"}
                    </TableCell>
                    <TableCell>{l.action}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.detail ?? ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
