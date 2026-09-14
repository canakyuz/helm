# Helm öneri motoru (insights), aşama 1 - tasarım

**Durum:** onaylandı (2026-09-14), plan bekliyor
**Kapsam:** aşama 1 = proaktif öneriler. Aşama 2 (sohbet) ayrı spec, token yenilenince.

## Sorun

Helm metrikleri, crash'leri ve gelirleri gösteriyor ama yorumlamıyor. Kullanıcı
her sekmeye bakıp "ne değişti, ne yapmalıyım" sorusunu kendi cevaplıyor.
İstenen: uygulamaların geri dönüşlerini ve analizlerini inceleyip öneride
bulunan bir sistem. Her sekme kendi AI bulgusunu göstersin, tab bar'daki ayrık
buton AI sayfasını açsın.

## Kısıtlar

- **Repo public.** Proje adı, hesap adı, id, proje ref'i, anahtar ve öneri
  metni repoya ve Actions loglarına girmez. Test verisi sentetik.
- **Supabase Management API token'ı 401.** Yeni edge function deploy ve
  Supabase sırrı eklenemiyor. `supabase db push` çalışıyor.
- **Tek kullanıcı.** Erişim `helm_is_owner()` (migration 0054) ile.
- **Tab bar'da toplam 5 yuva.** 6. öğe iOS 26'da ayrık butonu bozar.

## Veri gerçeği (2026-09-14 salt okuma ölçümü)

| Kaynak | Durum | Aşama 1'de |
|---|---|---|
| `metrics` | 4.539 satır; 3/4 projede, en zengini 29 metrik / 209 gün | Ana sinyal |
| `ad_*`, `errors` | 2 proje, 120-205 gün, son 30 gün dolu | Evet |
| `mrr`, `active_subs`, `subs_trial` | 1 proje, 100 gün | Evet |
| `dau`, `wau`, `mau`, `new_users` | 1 proje, 110-209 gün | Evet |
| `pct_level1`, `pct_paused` | 1 proje, 105 gün | Evet |
| `crash_free_sessions` | 65 gün, son 30'da 23 | Evet, veri şartıyla |
| `app_versions` | 30 satır | Sürüm eşleştirme için |
| `social_*` | 4 gün | Yalnız "veri birikiyor" |
| `reviews` | 15 satır, tek proje | Hayır (90 günde 30 yorum olunca) |
| `purchases`, `avg_session_sec` | Veri yok denecek kadar az | Hayır |
| `alert_events`, `content_embeddings` | 0 satır | Hayır |

Bir proje 5 günlük, biri hiç metriksiz. Motor bu projelerde öneri uydurmaz.

## Karar

**Kod sinyali bulur, Claude yorumlar (yaklaşım A).** Rakamları SQL + TypeScript
hesaplar; Claude yalnız tetiklenen sinyalleri alır, birleştirir, sıralar, TR/EN
metin yazar. Kartta görünen her sayı koddan gelir.

Reddedilen:
- Ham veriyi Claude'a vermek: token maliyeti yüksek, rakam doğrulanamaz.
- MCP araçlarıyla ajan: süre ve maliyet kestirilemez, aşama 1 için fazla.
- Edge function: deploy edilemiyor. İş GitHub Actions'ta koşar.
- pg_net: araç döngüsü ve uzun istek için uygun değil.

## 1. Veri modeli (migration 0055)

### `insight_runs`

| Kolon | Tip | Not |
|---|---|---|
| `id` | uuid pk | |
| `run_date` | date **unique** | Aynı gün ikinci koşu kopya üretmez |
| `started_at`, `finished_at` | timestamptz | |
| `status` | text | `running` \| `ok` \| `failed` \| `skipped_budget` |
| `model` | text | |
| `input_tokens`, `output_tokens` | int | |
| `cost_usd` | numeric | `usage × fiyat` |
| `signal_count`, `insight_count` | int | |
| `error` | text | Yalnız hata kodu/sınıfı, içerik değil |

### `insights`

| Kolon | Tip | Not |
|---|---|---|
| `id` | uuid pk | |
| `run_id` | uuid → `insight_runs` | Son güncelleyen koşu |
| `project_id` | uuid null | null = portföy geneli |
| `tab` | text | `overview` \| `revenue` \| `users` \| `social` |
| `kind` | text | `risk` \| `opportunity` \| `anomaly` \| `data_gap` |
| `severity` | text | `critical` \| `warn` \| `info` (mevcut `AlertSeverity`) |
| `text` | jsonb | `{tr:{title,body}, en:{title,body}}` |
| `evidence` | jsonb | `[{signal_id, metric, window, value, baseline, delta_pct}]`, kod yazar |
| `action` | jsonb null | `{type, params}`; aşama 1'de `open_route`, `check_version` |
| `status` | text | `new` \| `seen` \| `done` \| `dismissed` \| `snoozed` |
| `snoozed_until` | timestamptz null | |
| `fingerprint` | text | `hash(project, kind, sinyal anahtarı)` |
| `last_triggered_on` | date | Otomatik kapanış için |
| `created_at`, `updated_at`, `resolved_at` | timestamptz | |

İndeksler:
- Kısmi tekil: `fingerprint` where `status in ('new','seen','snoozed')`.
- Kısmi: `(tab, status, severity)` where `status in ('new','seen')`.

### Erişim

- **Telefon:** `select` politikası `helm_is_owner()`. Yazma yok; durum değişimi
  yalnız `helm_insight_set_status(p_id uuid, p_status text, p_snooze_until timestamptz)`
  (security definer, `helm_is_owner()` kontrolü, yalnız `seen|done|dismissed|snoozed`).
- **Günlük iş:** `helm_insights_writer` rolü. `metrics`, `app_versions`,
  `projects` üzerinde `select`; iki yeni tabloda `select, insert, update`.
  `delete` yok. Migration rolü şifresiz oluşturur; şifreyi kullanıcı bir kez
  `alter role ... password` ile koyar ve `HELM_INSIGHTS_DB_URL` GitHub secret'ı
  olarak ekler.
- **Temizlik:** pg_cron, `resolved_at` 90 günden eski `done`/`dismissed`
  kayıtları siler (`0042_sync_runs_retention` kalıbı).

`alert_events` yeniden kullanılmadı: eşik kuralı ve onay semantiği taşıyor,
önerinin kanıt/aksiyon/erteleme yaşam döngüsü farklı.

## 2. Sinyal kataloğu

**Yöntem:** son 7 gün, önceki 28 günün medyanı ve MAD'ine karşı robust z-skor.

- Tetik: `|z| ≥ 3` **ve** metrik başına mutlak eşik.
- Veri şartı: taban 28 günün ≥ 21'inde, pencere 7 günün ≥ 5'inde veri.
  Sağlanmazsa sinyal hesaplanmaz.

| Sekme | Sinyal | Metrikler | Ne yakalar |
|---|---|---|---|
| Özet | `revenue_shift` | ad + app + iap + subscription toplamı | Portföy gelir kırılması |
| Özet | `error_spike` | `errors`, `crash_free_sessions` | Hata artışı; son 7 günde sürüm varsa "sürüm sonrası" |
| Gelir | `ecpm_shift` | `ad_ecpm` ↔ `ad_impressions` | Fiyat düştü, trafik sabit |
| Gelir | `fill_rate_drop` | `ad_matched_requests / ad_requests` | Dolum oranı düşüşü |
| Gelir | `subs_momentum` | `mrr`, `active_subs`, `subs_trial` | Deneme artıyor, abonelik artmıyor |
| Kullanıcı | `dau_shift` | `dau`, `new_users` | Aktif/yeni kullanıcı kırılması |
| Kullanıcı | `stickiness_trend` | `dau / mau` | 14 günlük bağlılık eğilimi |
| Kullanıcı | `funnel_shift` | `pct_level1`, `pct_paused` | Oyun hunisinde takılma/bırakma |
| Sosyal | `social_warmup` | `social_*` | 14 gün dolana kadar `data_gap` bilgisi |

Kapsam dışı:
- `source_silent`: Özet'teki `AttentionTile` (`toItems(alerts, coverage)`) zaten gösteriyor.
- Yorum analizi, `purchases`, `avg_session_sec`: veri yok.
- Sentry canlı API: aşama 1 yalnız DB'deki `errors` ve `crash_free_sessions`.

## 3. Günlük iş

```
.github/workflows/insights.yml   schedule 05:00 UTC + workflow_dispatch
  └─ bun run packages/insights/src/run.ts
       1. insight_runs(run_date=bugün) ekle      → çakışırsa çık
       2. tek SQL: son 35 gün, katalog metrikleri
       3. saf TS: medyan / MAD / z-skor → sinyaller
       4. sinyal yok → status=ok, Claude çağrılmaz
       5. ay toplamı cost_usd ≥ 40 → status=skipped_budget
       6. proje başına 1 Claude isteği
       7. doğrula → tek transaction: upsert(fingerprint) + otomatik kapanış + status=ok
```

**Paket:** `packages/insights/` → `signals/` (saf fonksiyonlar), `prompt.ts`,
`schema.ts` (Zod), `run.ts`.

**Claude çağrısı:**
- `client.messages.parse`, `model: "claude-opus-5"`, adaptive thinking,
  `output_config: { effort: "medium", format: zodOutputFormat(...) }`.
- `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`); `stop_reason`
  her yanıtta kontrol edilir, `refusal` koşuyu `failed` yapar.
- Normal Messages API, Batch değil: günde ~3 istek, batch'in 24 saate kadar
  süren tamamlanması Actions'ta bekleme ya da iki aşamalı toplama gerektirir.
- Prompt caching yok: sistem prompt'u tahminen alt sınırın altında, günde tek istek.

**Doğrulama (Claude rakam yazamaz):**
- Çıktı: `[{signal_ids[], tab, kind, severity, text{tr,en}, action?}]`.
- Bilinmeyen `signal_id` → öneri reddedilir.
- `evidence` kod tarafından sinyalden kopyalanır.
- Proje + sekme başına ≤ 3 öneri; başlık ≤ 80, gövde ≤ 400 karakter.
- Boş dizi geçerli bir cevap.

**Yaşam döngüsü:**
- Aynı `fingerprint` tekrar tetiklenirse kayıt güncellenir, `last_triggered_on` ilerler.
- Açık öneri 3 gün üst üste tetiklenmezse `done` + `resolved_at`.
- `dismissed` öneri, sinyal anahtarı değişmedikçe açılmaz.

**Güvenlik:**
- Tetikleyici yalnız `schedule` ve `workflow_dispatch`; `pull_request` yok.
- Secret'lar: `ANTHROPIC_API_KEY`, `HELM_INSIGHTS_DB_URL`.
- Log yalnız sayı: `projects=3 signals=5 insights=4 cost=0.21`.

**Hata:** SDK varsayılan 2 yeniden deneme. Başarısızlıkta transaction geri
alınır, mevcut öneriler bozulmaz, run `failed`, Actions kırmızı.

**Yerel:** `--dry-run` yalnız sinyal sayılarını basar; Claude ve DB yazımı yok.

**Maliyet tahmini:** ayda ~10-30 $ (hesap, ölçüm değil; aralık thinking token'larından).

## 4. Sekme kartları

- **Yer:** her sekmede hero + stat satırının hemen altı.
- **Sayı:** sekme başına 1 kart (en yüksek önem, sonra en yeni). Fazlası
  "+N öneri daha" satırı → AI sayfası, o sekme filtreli.
- **Boş:** öneri yoksa ya da son başarılı koşu 36 saatten eskiyse kart çizilmez.
- **Kapsam:** proje seçiciye uyar. Seçili proje → o projenin + portföy geneli önerileri.
- **Dil:** uygulama dili, `text[lang]`, yoksa `tr`.

**Anatomi:** tür etiketi (önem renginde, mono) · başlık · gövde (2 satır) ·
`evidence[0]` (mono, koddan) · aksiyonlar.

**Aksiyonlar:**
- Birincil: `action` varsa (tek accent kullanımı).
- "Sonra": 3 gün erteler. "Geç": kapatır. İkisi de iyimser; hata olursa kart
  geri gelir, satır içi hata (toast yok).
- Gövdeye dokunma: AI sayfasında detay + `seen`.

**Görsel:** önem sol şerit değil renkli mono etiket (yeni bileşende side-stripe yok).

**Hareket (`@helm/design` motion token'ları):**

| Durum | Davranış |
|---|---|
| Giriş | `Rise`, 260ms `EASE_OUT` |
| Sekme değişimi | Animasyon yok (`replayOn.tabChange: false`) |
| Geç / Sonra | 180ms fade-out; alttaki içerik 220ms `EASE_IN_OUT` |
| Günlük yenileme, aynı öneri | Metin yerinde değişir |
| Basma | opaklık 0.85, buton scale 0.97 |
| Azaltılmış hareket | 160ms fade, hareket yok |

**Dosyalar:** `src/components/insights/insight-card.tsx`,
`src/hooks/use-insights.ts` (`useInsights(tab)`, `useSetInsightStatus`),
dört sekme ekranı. `staleTime` 5 dk.

## 5. AI sayfası

- **Tab:** `role="search"` korunur; route `search/` → `ai/`, ikon SF `sparkles`,
  etiket "AI", `accessibilityLabel="Helm AI"` (expo-router 57 trigger prop'u).
- **Başlık satırı:** son analiz saati · açık öneri sayısı · bu ay maliyet / $40.
  `failed` ve `skipped_budget` uyarı renginde.
- **Filtre:** `NativeSegmented`: Tümü · Özet · Gelir · Kullanıcı · Sosyal.
- **Akış:** `InsightCard variant="full"` (tüm gövde, tüm kanıt satırları).
- **Arşiv:** "Kapananlar (N)" → `done`/`dismissed`.
- **Arama:** alttaki `Stack.SearchBar` korunur; `search-index` öneri metnini de kapsar.
- **Detay:** `/ai/[id]`: tam metin, tüm kanıt, "N gündür açık" (`created_at`).
- **Aksiyonlar:** `open_route` (sekmeye git), `check_version` (Sağlık). Yazma
  yapmadıkları için onay kartı yok.

**Boş durumlar:**
- Hiç koşu yok: "İlk analiz yarın 08:00'de."
- Bugün sinyal yok: "Bugün kayda değer bir sinyal yok · son analiz HH:MM."
- Bütçe doldu: "Bu ayın $40 tavanı doldu; analiz ayın 1'inde devam eder."

**Hook'lar:** `useInsightFeed(tab, status)` (`limit 50`), `useLatestRun()`.

## Aşama 2 (bu spec'in kapsamı dışında)

Sohbet: `ai/chat` ekranı, kartlarda "bunu açıkla", Dante'den `MessageBubble`,
`AIComposer`, SSE ayrıştırıcı, pacer, `ThinkingOrb`, onay kartı deseni.
Supabase token'ının yenilenmesini ve bir sunucu ucunu gerektirir. Aşama 1'de
bunlara ait devre dışı buton da çizilmez.

## Kullanıcı adımları

1. `helm_insights_writer` rolüne şifre koymak.
2. GitHub secret'ları: `ANTHROPIC_API_KEY`, `HELM_INSIGHTS_DB_URL`.
3. Migration 0055'i `db push` ile uygulamak (onayla).

## Test

Yalnız kritik mantık, sentetik veri: z-skor ve MAD, veri şartı (21/28, 5/7),
mutlak eşik, fingerprint kararlılığı, Claude çıktı doğrulaması (bilinmeyen
sinyal, uzunluk, sekme başı tavan), otomatik kapanış.

## Uygulama sırası

1. Motor: migration 0055, `packages/insights`, workflow (`--dry-run` ile doğrulanır).
2. Sekme kartları.
3. AI sayfası.
