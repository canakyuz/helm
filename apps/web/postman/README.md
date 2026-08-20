# helm - Postman Koleksiyonu

helm'in connector'larının yaptığı **tam HTTP çağrılarını** Postman'de tek tek
çalıştırıp ham yanıtı görebilmek için. Veri yorumlamasında bir şey ters
geliyorsa: önce burada çağırıp upstream'in gerçekte ne döndürdüğünü
inceleyebilirsin, sonra connector kodu (`supabase/functions/helm-ingest/
connectors/`) ile karşılaştırırsın.

## Kurulum

1. **Postman** → **Import** → `helm.postman_collection.json` seç.
2. Sol panelde **helm** koleksiyonu görünür. Üstüne tıkla → **Variables** sekmesi.
3. İhtiyacın olan değerleri **Current Value** sütununa doldur (varsayılan
   `POSTHOG_HOST=https://eu.posthog.com`, `SENTRY_HOST=https://sentry.io`,
   `APP_STORE_COUNTRY=us`, `PLAUSIBLE_HOST=https://plausible.io` dolu).

## Tarih değişkenleri otomatik

Her istek öncesi pre-request script çalışır ve şunları üretir:
`DATE_90_AGO`, `DATE_TODAY`, `EPOCH_90_AGO`, `EPOCH_NOW`, `YMD_START`,
`YMD_END` - connector'lardaki son 90 gün penceresinin birebir aynısı.

## Sıra

### AdMob
1. **0 - Refresh access token** - `client_id/secret/refresh_token`'dan
   access token üretir, otomatik kaydeder.
2. **1 - Network report** - son 90 günün günlük gelir/gösterim/RPM raporu.
   - helm: revenue = `microsValue / 1e6`, impressions = `integerValue`,
     ecpm = `IMPRESSION_RPM/1e6` (yoksa `revenue/impressions*1000`).
   - **Para birimi:** yanıtın `header.localizationSettings.currencyCode`'una
     bak - helm config'inde `currency` alanı bunla eşleşmeli.

### RevenueCat
- **Overview metrics** - `metrics[]` dizisi. helm `id: 'mrr'`,
  `'active_subscriptions'`, `'revenue'` arıyor.
  **Yanıttaki gerçek id'leri doğrula** - farklıysa connector kodunda
  güncellenmesi gerekir.

### PostHog
- **Daily DAU** - HogQL: `SELECT toDate(timestamp), uniq(person_id) FROM events ...`
- **Current WAU** - anlık WAU.
- Sürekli 0 dönüyorsa → `person_id` event'lerin çoğunda boş demektir.

### Stripe
- **Aktif abonelikler** - helm MRR'ı her aboneliğin items'ından hesaplar
  (yıllık /12, vb), `unit_amount` cents'i /100.

### Plausible
- **Timeseries** - günlük ziyaretçi 90g. helm bunu `dau` olarak yazar.

### Sentry
- **Project stats** - `[[unix_ts, count], …]` - helm `errors` olarak yazar.

### Target Supabase (proje kullanıcıları)
- **List users (admin)** - helm-users buna eşdeğer; tüm sayfaları gezer.

### App Store
- **Reviews RSS** - public, auth yok.
- **App lookup** - `results[0].version` + `currentVersionReleaseDate` +
  `releaseNotes`. helm sürüm takibi buradan.

### helm Edge Functions
- **helm-ingest / helm-test / helm-users / helm-alert / helm-reviews /
  helm-versions / helm-heartbeat** - helm'in kendi endpoint'leri.
- Auth: `Authorization: Bearer {{HELM_SUPABASE_ANON_KEY}}` (heartbeat hariç -
  JWT'siz deploy edildi).

## Akış: bir bug'ı izlemek

1. Cockpit'te tuhaf bir değer gör (ör. eCPM $0).
2. Postman'de AdMob → "Network report"u çalıştır.
3. Yanıtta o tarih için `IMPRESSION_RPM` ne dönüyor - bak.
4. helm o değeri nasıl yorumluyor: `connectors/admob.ts` aç, karşılaştır.
5. Tutarsızlık varsa connector'ı düzelt + deploy.

Veri yorumlamasında "rezalet" varsa bu döngü onu nokta atışı bulur.
