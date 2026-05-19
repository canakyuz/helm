import { useState } from "react";
import { Info, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Mail modülü — gönderim sağlayıcısı (Resend/Loops) henüz bağlı değil.
// Ekran yapısı hazır; sağlayıcı bağlanınca form aktifleşir.
export const MailPage = () => {
  const [segment, setSegment] = useState("all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const connected = false; // sağlayıcı bağlı mı

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Mail</h1>

      {!connected && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <span>
            Mail sağlayıcısı bağlı değil. Gönderim yapabilmek için Resend ya da
            Loops bağlanmalı (Ayarlar → İletişim). Form yapısı hazır.
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Yeni Gönderim</CardTitle>
        </CardHeader>
        <CardContent className="max-w-xl space-y-4">
          <div className="space-y-2">
            <Label>Alıcı segmenti</Label>
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm kullanıcılar</SelectItem>
                <SelectItem value="new">Yeni kullanıcılar (7 gün)</SelectItem>
                <SelectItem value="active">Aktif kullanıcılar</SelectItem>
                <SelectItem value="paying">Ödeyen kullanıcılar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Konu</Label>
            <Input
              placeholder="Yeni sezon başladı"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Mesaj</Label>
            <textarea
              className="min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="Mail içeriği…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <Button disabled={!connected}>
            <Send className="size-4" /> Gönder
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Geçmiş Gönderimler</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-sm text-muted-foreground">
            Henüz gönderim yok
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
