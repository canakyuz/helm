# helm — İhtiyaç Listesi (Backlog)

Founder cockpit. Çok-projeli gelir + kullanıcı metrik paneli.
Bu dosya: ne var, ne eksik, sıralı.

## ✅ Şu an çalışan

- Hub Supabase (projects / project_integrations / metrics tabloları + RLS)
- Panel: Refine v5 + shadcn/ui + Tailwind v4, 5 temalı sistem
- Cockpit dashboard (özet kartlar + 90 günlük grafikler + proje kırılımı)
- Proje CRUD + sekmeli detay (Genel Bakış / Entegrasyonlar)
- 4 connector: RevenueCat, AdMob, PostHog, Supabase
- `helm-ingest` Edge Function — manuel "senkronize et" çalışıyor
- Empire Inc bağlı: Supabase + AdMob + PostHog (RevenueCat hariç)

---

## P0 — Çalışır/dolu olması için şart

| # | İş | Not |
|---|-----|-----|
| 1 | Gece cron'unu aktifleştir | `scripts/p0-cron-bootstrap.sql`'i SQL Editor'e yapıştır, `<SERVICE_ROLE_KEY>` yerine gerçek key. Bu Vault'a 2 secret yazar + cron job'u (re)kurar. Dashboard "Son senkron" şeridi 36 saat eskimişse kırmızıya döner. |
| 2 | RevenueCat bağla | Empire Inc MRR $0 — abonelik geliri akmıyor. v2 secret key + project_id panelden Entegrasyonlar → "+". |
| 3 | DAU=0 doğrula | PostHog connector backfill'e geçti; entegrasyon satırındaki ShieldCheck (Doğrula) — upstream vs DB 7 günlük diff. `missing_stored` çok ise re-sync, sıfırsa gerçekten 0. |
| 4 | Diğer projeleri ekle | Friday, Levios, Dante×2 → panelden "Yeni proje" + her birine entegrasyon. |

## P1 — Güvenlik (internete deploy'dan ÖNCE şart)

| # | İş | Not |
|---|-----|-----|
| 5 | Anahtarları Vault'a taşı | Sağlayıcı API anahtarları şu an `project_integrations.config` jsonb'de **plaintext**. helm hub diğer projelerin service_role key'lerini tutuyor → sızarsa tüm projeler riskte. |
| 6 | Secret yazma akışı | Panel anon key ile Vault'a yazamaz → küçük bir `helm-save-secret` Edge Function. |

## P2 — Veri derinliği & operasyon

| # | İş | Not |
|---|-----|-----|
| 7 | Tek proje senkronu | Şu an hep "hepsi". "Bu projeyi senkronla" butonu. |
| 8 | Senkron geçmişi/log | Ne zaman çalıştı, ne kadar sürdü, kaç metrik geldi. |
| 9 | Connector hata bildirimi | Bir kaynak patlayınca haberdar ol (e-posta/push). Şu an sessizce `last_sync_error`'a yazıyor. |
| 10 | Daha çok metrik | RevenueCat: churn, trial, new_customers, ürün kırılımı. AdMob: impressions, eCPM, fill rate. PostHog: WAU, retention, funnel. Supabase: retention. |
| 11 | Manuel metrik girişi | API'si olmayan/atlanan kaynaklar için elle değer girme. |
| 12 | Backfill kontrolü | Yeni proje eklenince geçmiş veriyi çekme — şu an connector'lar 90 gün çekiyor, yeterli ama kontrol arayüzü yok. |

## P3 — Panel UX

| # | İş | Not |
|---|-----|-----|
| 13 | Tarih aralığı seçici | Sabit 90 gün yerine 7 / 30 / 90 / özel. |
| 14 | Projeler arası karşılaştırma | Yan yana gelir/kullanıcı kıyas görünümü. |
| 15 | Uyarı kuralları | "Gelir %20 düştü", "DAU yarıya indi" → bildirim. |
| 16 | Para birimi & format ayarları | Şu an her şey USD varsayılıyor. |
| 17 | Mobil uyum | Panele telefondan bakabilmek. |

## P4 — Founder araç kutusu (orijinal vizyon)

| # | İş | Not |
|---|-----|-----|
| 18 | CRM / Kullanıcılar modülü | Proje kullanıcılarını gör + müdahale et (gem ver, premium aç, ban). Sidebar'a yeni modül. |
| 19 | Audit log | Müdahalelerin kaydı (kim, ne zaman, ne yaptı). |
| 20 | Form | Tally entegrasyonu — kendin kurma. |
| 21 | Mail otomasyonu | Loops/Resend entegrasyonu — kendin kurma. |
| 22 | Push bildirim yönetimi | Segment seç → push gönder (Empire Inc'in push altyapısı var). |

## P5 — Altyapı & kalite

| # | İş | Not |
|---|-----|-----|
| 23 | Deploy (Vercel) | Lokal'den çıkış. Deploy = Vault (P1) şart + erişim kısıtı. |
| 24 | Bundle code-splitting | 1.4MB tek chunk — route bazlı `lazy()`. |
| 25 | helm için hata izleme | Sentry — panel kendi hatalarını görsün. |
| 26 | Hub DB yedekleme | Supabase otomatik yedek + periyodik export. |
| 27 | Doküman güncel | SETUP.md / README — yeni mimariye göre. |

---

## Öncelik mantığı

- **P0 önce** — helm dolu ve güncel olmadan gerisi anlamsız.
- **P1 deploy'dan önce** — lokal kaldıkça acil değil ama deploy ânında şart.
- **P2–P3** — helm'i kullandıkça hangisi can sıkıyorsa o.
- **P4** — orijinal vizyon ama helm metrik tarafında oturduktan SONRA.
- **P5** — büyüdükçe.
