# helm — Kurulum

Çok-projeli founder cockpit. Tüm projelerin gelir + kullanıcı metriklerini tek
panelde toplar. Lokal çalışır (`npm run dev`).

## Mimari

```
Dış kaynaklar        helm-ingest (Edge Fn, gece cron)      helm hub DB       Panel
RevenueCat ─┐
AdMob      ─┤──►  her entegrasyon için connector ────►  metrics        ──►  Cockpit
PostHog    ─┤      "dün"ün metriğini upsert eder         projects            Projeler
Supabase   ─┘                                            project_integrations
```

## Kurulum adımları

### 1. helm hub Supabase projesi
- [supabase.com](https://supabase.com) → yeni proje oluştur (ör. `helm-hub`).
- Project Settings → API'den şunları al: **Project URL**, **anon key**, **service_role key**.
- `.env.local` dosyasını doldur:
  ```
  VITE_HELM_SUPABASE_URL=https://<ref>.supabase.co
  VITE_HELM_SUPABASE_ANON_KEY=<anon-key>
  ```

### 2. Şemayı uygula
```bash
npx supabase link --project-ref <hub-ref>
npx supabase db push          # 0001_init.sql tabloları kurar
```
> `0002_cron.sql` cron job'u kurar ama önce Vault secret'larını ister — bkz. adım 6.

### 3. Panel kullanıcısı
- Supabase Dashboard → Authentication → Users → kendine bir kullanıcı ekle
  (kayıt ekranı kapalı, giriş bununla yapılır).

### 4. Paneli çalıştır
```bash
npm install
npm run dev
```
→ `/login` ile giriş yap → boş Cockpit açılır → "Projeler"den proje ekle.

### 5. Edge Function deploy
```bash
npx supabase functions deploy helm-ingest
```
`SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` Edge Function ortamında
otomatik tanımlıdır — ekstra ayar gerekmez.

### 6. Gece cron (opsiyonel ama önerilir)
Supabase SQL Editor'da, **gerçek hub değerleriyle** bir kez çalıştır:
```sql
select vault.create_secret('https://<hub-ref>.supabase.co', 'helm_project_url');
select vault.create_secret('<hub-service-role-key>',        'helm_service_role_key');
```
Sonra `0002_cron.sql` migration'ı uygulanınca her gece 03:00 UTC'de senkron olur.

## Bir projeyi bağlamak (ör. Empire Inc)

1. Panel → Projeler → "Oluştur" → ad + slug.
2. Projenin detay sayfası → "Entegrasyonlar" → "Bağla" → sağlayıcı seç:

| Sağlayıcı  | Gereken bilgiler |
|------------|------------------|
| RevenueCat | v2 secret API key + RevenueCat project_id |
| PostHog    | personal API key + project_id + host (`https://eu.posthog.com`) |
| Supabase   | hedef projenin URL'i + service_role key |
| AdMob      | publisher_id + OAuth client_id/secret + refresh_token (aşağıya bak) |

### AdMob refresh_token (tek seferlik)
AdMob API service account desteklemez. Bir kez:
1. Google Cloud Console → "Desktop app" tipi OAuth client oluştur.
2. OAuth consent screen'i **"In production"** yap (yoksa token 7 günde expire).
3. ```bash
   node scripts/admob-oauth.mjs <CLIENT_ID> <CLIENT_SECRET>
   ```
4. Çıkan `refresh_token`'ı panelde AdMob entegrasyonuna yapıştır.

## Doğrulama
- Panel → Cockpit → "Şimdi senkronize et" → `helm-ingest` çalışır.
- Supabase'de `metrics` tablosu dolar, Cockpit kartları gerçek veriyi gösterir.

## Güvenlik notu
v1'de sağlayıcı anahtarları `project_integrations.config` içinde tutulur (lokal,
tek kullanıcı, RLS korumalı). Panel internete **deploy edilmeden önce**
secret'lar Supabase Vault'a taşınmalıdır.
