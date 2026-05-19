import { useState } from "react";
import { Bell, Info } from "lucide-react";
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

// Push bildirim modülü — sağlayıcı (Expo/FCM) henüz bağlı değil.
export const PushPage = () => {
  const [segment, setSegment] = useState("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const connected = false;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Push</h1>

      {!connected && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <span>
            Push sağlayıcısı bağlı değil. Gönderim için Expo Push / FCM
            bağlanmalı. Form yapısı hazır.
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Yeni Bildirim</CardTitle>
        </CardHeader>
        <CardContent className="max-w-xl space-y-4">
          <div className="space-y-2">
            <Label>Hedef segment</Label>
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm kullanıcılar</SelectItem>
                <SelectItem value="active">Aktif kullanıcılar</SelectItem>
                <SelectItem value="inactive">Pasif kullanıcılar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Başlık</Label>
            <Input
              placeholder="Yeni sezon!"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Mesaj</Label>
            <textarea
              className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="Bildirim metni…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <Button disabled={!connected}>
            <Bell className="size-4" /> Gönder
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
