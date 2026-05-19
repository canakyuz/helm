import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Kampanya geçmişi — Mail/Push gönderimleri burada listelenir.
// Sağlayıcılar bağlanıp gönderim yapılınca dolacak.
export const CampaignsPage = () => (
  <div className="space-y-4">
    <h1 className="text-2xl font-semibold tracking-tight">Kampanya Geçmişi</h1>

    <Card>
      <CardHeader>
        <CardTitle>Gönderimler</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="py-10 text-center text-sm text-muted-foreground">
          Henüz kampanya gönderilmedi. Mail veya Push sağlayıcısı bağlanıp ilk
          gönderim yapıldığında — kime, ne zaman, kaç kişiye — burada
          listelenir.
        </div>
      </CardContent>
    </Card>
  </div>
);
