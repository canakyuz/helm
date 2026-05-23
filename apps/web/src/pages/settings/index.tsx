import { useLogout } from "@refinedev/core";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDisplayCurrency } from "@/context/currency";
import { useHelmTheme } from "@/theme/ThemeProvider";

export const SettingsPage = () => {
  const { themeKey, setThemeKey, themes } = useHelmTheme();
  const { mutate: logout } = useLogout();
  const { currency, setCurrency } = useDisplayCurrency();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Ayarlar</h1>

      <Card>
        <CardHeader>
          <CardTitle>Görünüm</CardTitle>
        </CardHeader>
        <CardContent className="max-w-sm space-y-2">
          <Label>Tema</Label>
          <Select value={themeKey} onValueChange={setThemeKey}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {themes.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Genel</CardTitle>
        </CardHeader>
        <CardContent className="max-w-sm space-y-2">
          <Label>Ekran para birimi</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="EUR">EUR (€)</SelectItem>
              <SelectItem value="TRY">TRY (₺)</SelectItem>
              <SelectItem value="GBP">GBP (£)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Tüm para metrikleri (gelir, eCPM) bu birime çevrilerek gösterilir.
            FX rate'leri Frankfurter API'sinden günlük çekilir, localStorage'a
            cache'lenir.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Otomasyon</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>
            Gece senkronu (cron) her gün 03:00 UTC'de çalışacak şekilde kurulu.
          </p>
          <p>
            Etkinleşmesi için Supabase Vault'a hub secret'ları girilmeli — bkz.
            SETUP.md adım 6.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hesap</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => logout()}>
            <LogOut className="size-4" /> Çıkış yap
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
