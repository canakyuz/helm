# helm - Modül Tasarım Spesifikasyonu

> Her modülün ne olduğu, nasıl yapılandırılacağı: ekranlar, alt-görünümler,
> veri ihtiyacı, akışlar, durum. Uygulama bu spec'e göre yapılır.
> Genel kural: her modül **kapsam context'ini** (`useScope`) okur -
> "Tüm Projeler" toplar, bir proje seçiliyse o projeye daralır.

---

## 1. Cockpit  ◇  `/`  ✅ var, derinleşecek

**Amaç:** Açılışta tek bakışta "ürünlerim ne durumda" - kuş bakışı.

**Kapsam = Tüm Projeler:**
- Üst özet şeridi: 4 kart - Toplam MRR · Reklam Geliri · Toplam DAU · Aktif
  Abone. Her kartta 7 günlük trend yüzdesi.
- 2 grafik: toplam gelir zaman serisi, toplam DAU.
- **Proje kartları ızgarası** - her kart: proje adı + MRR/reklam/DAU + mini
  sparkline + **sağlık noktası** (yeşil/kırmızı: connector'lar ok mu).
  Karta tıkla → kapsamı o projeye çevirir.
- Tarih aralığı seçici (7/30/90).

**Kapsam = bir proje:**
- O projenin 7 kartı (MRR, reklam, DAU, kullanıcı, gösterim, eCPM, WAU).
- 3 grafik: gelir, DAU, kullanıcı büyümesi.
- Proje aksiyonları: Senkronla · Düzenle.

**Veri:** `metrics`, `projects`, `project_integrations` (sağlık noktası için).

**Yapılacak:** karşılaştırma modu (2 proje yan yana); grafiklere hedef çizgisi;
proje kartına sağlık noktası.

---

## 2. Kullanıcılar / CRM  ▤  `/users`  ⚠️ yarım - asıl iş burada

**Amaç:** Bir projenin kullanıcılarını gör, anla, **müdahale et**. helm'in
orijinal vizyonunun kalbi.

### 2.1 Liste ekranı
- Seçili projenin kullanıcı tablosu. Kolonlar: e-posta, kayıt, son giriş.
  (Oyun verisi bağlanırsa: bakiye, era, toplam harcama.)
- **Arama** (e-posta), **segment filtresi** (Tümü / Yeni (7g) / Aktif /
  Pasif / Ödeyen), **sıralama**, **sayfalama** (helm-users şu an ilk 200 -
  gerçek sayfalama eklenecek).

### 2.2 Kullanıcı detayı (drawer / sağ panel)
Satıra tıkla → kayar panel:
- **Kimlik:** e-posta, id, kayıt tarihi, son giriş, sağlayıcı.
- **Aktivite zaman çizelgesi:** PostHog'dan son event'ler (giriş, satın alma…).
- **Satın almalar:** RevenueCat'ten bu kullanıcının işlemleri.
- **Aksiyon butonları** (bkz. 2.3).

### 2.3 Müdahale - mimari kritik nokta
helm **doğrudan "gem veremez"** - bu hedef projenin oyun mantığı. helm
hedef projenin bir **aksiyon endpoint'ini** çağırır.
- Her bağlı proje küçük bir Edge Function expose eder: `helm-action`
  (`{ action, user_id, payload }` alır - gem ver / premium aç / ban).
- helm panelindeki buton → `project_integrations.config`'teki action
  endpoint + secret ile çağrı.
- Her müdahale helm hub'daki **`audit_log`** tablosuna yazılır
  (kim, ne zaman, hangi kullanıcı, ne yaptı).

### 2.4 Segmentler
Kaydedilmiş filtreler ("son 7 günde ödeyenler"). helm hub'da `user_segments`
(opsiyonel, v2).

**Veri:** `helm-users` (liste) · hedef proje (detay/event/satın alma) ·
`helm-action` (müdahale) · hub `audit_log`.
**Yapı:** `pages/users/{list, user-detail}` · migration `audit_log` ·
her projede `helm-action` sözleşmesi.
**Durum:** liste var. Detay, müdahale, segment, audit - yok.

---

## 3. Gelir & Reklam  ◷  `/revenue`  🔜

**Amaç:** Cockpit'teki tek "MRR / reklam" sayısının arkası - para derinliği.

**Ekran - 3 sekme:**
- **Abonelik (RevenueCat):** MRR trendi, aktif abone & trial, yeni vs churn,
  ürün/plan kırılımı, trial→paid dönüşüm hunisi, kabaca LTV.
- **Reklam (AdMob):** reklam geliri trendi, eCPM trendi, gösterim, fill rate,
  **format kırılımı** (banner / interstitial / rewarded), ülke kırılımı.
- **Bileşim:** gelir kompozisyonu - abonelik vs reklam payı (alan grafiği).

**Veri:** connector'lar genişletilir - RevenueCat ürün kırılımı, AdMob
format/ülke boyutları (`metrics` long-format → migration gerekmez, yeni
`metric`/`source` değerleri).
**Yapı:** `pages/revenue/` + connector genişletmeleri.

---

## 4. Uyarılar  ◷  `/alerts`  🔜

**Amaç:** Proaktif bildirim - helm sana haber verir, sen helm'i açmazsın.

**Ekran:**
- **Kural listesi:** tanımlı uyarılar (metrik, koşul, kanal, durum).
- **Kural oluştur:** metrik seç (DAU/gelir/…) + koşul (% düştü / arttı /
  eşik altı) + pencere (1g/7g) + kapsam (proje / tümü) + kanal.
- **Tetiklenenler:** geçmiş uyarı olayları.

**Akış:** `helm-ingest` her senkron sonrası `helm-alert` fonksiyonunu
tetikler → kuralları değerlendirir → eşik aşıldıysa kanaldan ping atar.

**Veri:** hub `alert_rules` + `alert_events` tabloları.
**Kanal:** Telegram bot (öncelik) veya Resend mail. Kullanıcı kurar
(bot token / API key → Ayarlar).
**Yapı:** `pages/alerts/`, 2 migration, `helm-alert` Edge Function.

---

## 5. Entegrasyonlar  🔌  `/integrations`  ✅ var, derinleşecek

**Amaç:** Seçili projenin veri kaynaklarını yönet.

**Ekran:** connector tablosu - provider, durum, son senkron, aktif toggle,
sil. "Bağla" → provider seç → dinamik form.

**Yapılacak:**
- **Config düzenleme** - şu an sadece ekle/sil; mevcut bir entegrasyonun
  anahtarını güncelleme yok.
- **Test bağlantısı** - connector'ı tek sefer çalıştır, sonucu göster
  ("✓ bağlandı" / hata) - kaydetmeden önce doğrulama.

**Veri:** `project_integrations`.

---

## 6. Senkron & Sağlık  ⟳  `/system`  ✅ var, derinleşecek

**Amaç:** Sistemin kendi sağlığı - ingestion çalışıyor mu.

**Ekran:** connector sağlık tablosu (proje, kaynak, durum, son senkron,
hata) + senkron geçmişi (`sync_runs`).

**Yapılacak:**
- Tek connector'ı **elle çalıştır** butonu.
- Senkron satırına tıkla → **detay drawer** (`sync_runs.details` - hangi
  connector ne çekti / neden patladı).
- Cron durumu göstergesi (son otomatik çalışma ne zaman).

**Veri:** `sync_runs`, `project_integrations`.

---

## 7. Ayarlar  ⚙  `/settings`  🔜

**Amaç:** helm'in kendi konfigürasyonu.

**Ekran - bölümler:**
- **Görünüm:** tema seçimi (şu an sidebar'da - buraya da).
- **Genel:** para birimi, varsayılan tarih aralığı, dil.
- **Otomasyon:** cron durumu + gece senkron saati.
- **Güvenlik:** sağlayıcı anahtarlarını Vault'a taşıma (BACKLOG P1).
- **Hesap:** şifre değiştir, çıkış.

**Veri:** çoğu `localStorage`; kalıcı olması gerekenler hub'da `settings`
tablosu (tek satır, jsonb).
**Yapı:** `pages/settings/`.

---

## Veri modeli eklemeleri (toplam)

| Tablo | Modül | İçerik |
|-------|-------|--------|
| `audit_log` | CRM | müdahale kayıtları (kim/ne zaman/kullanıcı/aksiyon) |
| `alert_rules` | Uyarılar | uyarı kuralları |
| `alert_events` | Uyarılar | tetiklenen uyarılar |
| `settings` | Ayarlar | tek satırlık jsonb konfigürasyon |
| `user_segments` | CRM (v2) | kaydedilmiş segment filtreleri |

Her biri ayrı `migrations/NNNN_*.sql` - long-format `metrics` dışındakiler
gerçek tablo.

## Yeni Edge Function'lar

| Function | Modül | İş |
|----------|-------|-----|
| `helm-alert` | Uyarılar | senkron sonrası kuralları değerlendir, ping at |
| `helm-action` | CRM | hedef projeye müdahale çağrısı (proje tarafında da sözleşme) |
| `helm-test` | Entegrasyonlar | bir connector'ı tek sefer test et |

## Önerilen uygulama sırası

1. **CRM derinleştirme** - kullanıcı detayı + segment/filtre (müdahale hariç).
2. **Senkron & Sağlık derinleştirme** - elle çalıştır + detay drawer (küçük).
3. **Entegrasyonlar** - config düzenleme + test bağlantısı.
4. **Uyarılar** - kural + `helm-alert` + Telegram.
5. **Gelir & Reklam** - connector genişletme + sayfa.
6. **CRM müdahale** - `helm-action` sözleşmesi + audit log (proje tarafı iş ister).
7. **Ayarlar** - en son, diğerleri oturunca.
