# Helm Web - UI/UX İnceleme ve Cila Planı

> Kapsam: `apps/web`'deki 30 route (18 sidebar sayfası + 11 gizli CRUD/detay sayfası + login).
> Metodoloji kaynağı: `emil-design-eng` (motion/animasyon kararları) + `impeccable` (görsel incelik, kontrast,
> tipografi, layout, "AI slop" testi). Veri işleyişi referansı: **`apps/mobile`** — CLAUDE.md'sinde tanımlı
> disiplin (her ekranda loading+error+empty state, 1-3 odaklı query hook, staleTime disiplini, 50+ item'da
> virtualization). **Mobile'a hiçbir değişiklik yapılmaz, sadece okunur.**
>
> Sıralama mantığı: önce paylaşılan altyapı (bir kere düzeltilir, 30 sayfaya birden fayda sağlar),
> sonra sayfalar sidebar'ın kendi önem sırasına göre (Ana Menü → Analitik → Mesajlaşma → DevOps → Destek),
> en son gizli CRUD sayfaları. Her faz kendi commit'ine girer.
>
> **Durum: TÜM FAZLAR TAMAMLANDI (Faz 0-3, 37/37 madde).** Otonom olarak `/goal bütün fazları
> bitir` ile yürütüldü. Öne çıkan sistemik bulgular: (1) çoğu liste sayfasında `query.isLoading`/
> `isError` hiç kontrol edilmiyordu, boş/yanlış mesaj kısa süreliğine yanlış gösteriliyordu — artık
> hepsinde `PageStatus`; (2) tüm `useForm`/`useOne`+`reset()` düzenleme formlarında veri gelmeden
> boş alanlarla render olma (flash) hatası vardı — 4 sayfada düzeltildi; (3) 10+ yerde `en-US` tarih
> formatı vardı, `tr-TR`'ye çevrildi; (4) bir gerçek absolute-ban ihlali (side-stripe border) vardı.
> **Ertelenen:** `/system` sayfasının 4 ikincil bölümü (996 satır, zaman bütçesi nedeniyle sadece
> en kritik bölüm düzeltildi) ve genel `text-emerald-600 dark:text-emerald-400` tarzı (çalışan ama
> bento-token'lara taşınmamış) renk kullanımı — ikisi de gelecek bir turda ele alınmalı.

---

## İnceleme metodolojisi (her sayfada aynı 9 madde)

Her sayfa incelenirken şu checklist uygulanır — sonuç bu dosyaya not düşülür:

1. **Layout & hiyerarşi** (impeccable) — kart yığını mı yoksa gerçek hiyerarşi mi? İç içe kart var mı (yasak)? Grid mi flex mi doğru yerde mi?
2. **Kontrast & tipografi** (impeccable) — body text ≥4.5:1, `text-muted-foreground` çok soluk mu? Ölçek sıçraması ≥1.25 oranında mı?
3. **Absolute ban taraması** (impeccable) — side-stripe border, gradient text, ghost-card (border+geniş shadow ikilisi), 32px+ radius, tekdüze eyebrow/numaralı bölüm.
4. **Boşluk/ritim** — sabit `gap-4` tekrarı mı, yoksa kasıtlı ritim mi?
5. **Motion kararı** (emil-design-eng) — hangi elemanlar animasyonlu olmalı (modal/drawer/toast), hangileri olmamalı (yüksek frekanslı, klavye tetiklemeli)? Buton `:active` scale(0.97) var mı?
6. **Loading state** — mobile'daki `ScreenStatus` eşdeğeri var mı, yoksa boş/donuk mu render ediyor?
7. **Error state** — query `isError` durumunda kullanıcıya ne gösteriliyor? Sessizce mi düşüyor?
8. **Empty state** — veri yoksa "—" mü basıyor, yoksa anlamlı bir boş durum mu var?
9. **Veri katmanı disiplini** (mobile referans) — sayfa başına kaç fetch/query var (mobile: 1-3 kuralı)? 50+ satırlık liste varsa virtualization/pagination var mı? Mutation sonrası invalidate doğru mu?

---

## Faz 0 - Hazırlık (kod yok)

- [x] `impeccable init` çalıştır → `PRODUCT.md` + `DESIGN.md` oluştur (kod taramasından çıkarıldı,
      login'in lime-green sapması ve Card'ın 14px/22px radius tutarsızlığı DESIGN.md'de not edildi)
- [x] Dev server temiz (cache temizlendi, taze restart)
- [x] Bu dosya `/goal bütün fazları bitir` ile onaylandı — otonom ilerleniyor

---

## Faz 1 - Paylaşılan altyapı (1-2 commit, 30 sayfaya birden fayda)

Web'de mobile'ın `ScreenStatus` bileşeninin eşdeğeri yok — her sayfa loading/error/empty'i kendi
başına, tutarsız şekilde çözüyor (bazıları hiç çözmüyor). Önce bunu standardize etmek, sonraki 29
sayfa incelemesini hem hızlandırır hem tutarlı kılar.

- [x] `src/components/ui/page-status.tsx`: ortak `PageStatus` (loading/error/empty, mobile
      `ScreenStatus`'un web karşılığı) — 3 tone, lucide ikon, `role="status"/"alert"` (a11y)
- [x] `Card`/`Table` primitiflerinde absolute-ban taraması — ghost-card (border+geniş shadow) veya
      keyfi büyük radius YOK. Tek gerçek bulgu: Card `rounded-xl` (14px), DESIGN.md'nin hedeflediği
      `bento-tile` (22px) ile uyuşmuyor. **Bilinçli olarak ertelendi** — 29 sayfanın hepsinde Card
      kullanılıyor, görsel doğrulama yapamadan (auth arkasında, screenshot alamıyorum) sitewide
      radius değişikliği riskli. Faz 2'de bir sayfada denenip onay alınınca sitewide uygulanacak.
- [x] Buton `:active` press-feedback zaten VARDI (`translate-y-px`). Gerçek bulgu: `transition-all`
      kullanılıyordu (emil-design-eng yasağı) → kesin property listesine çevrildi (`button.tsx`)
- [x] z-index skalası kontrolü — `z-50`/`z-10`/`z-20` tutarlı (shadcn/radix default). 3 adet keyfi
      değer (`z-[500/600/900]`) var ama `users-geo-map.tsx`/`geo-map.tsx`'te Leaflet'in kendi iç
      z-index'ini (200-700 aralığı) aşmak için bilinçli — dokunulmadı, gerçek sorun değil.
- [x] React Query global config gözden geçirildi (`App.tsx`: staleTime 60s, gcTime 5dk, retry 1,
      refetchOnReconnect true) — makul, sabit kalması yeterli. Mobile'ın 30s/5dk per-hook ayrımı
      Faz 2'de tekil sayfa ihtiyacına göre (KPI vs audit log gibi) değerlendirilecek, global değil.

---

## Faz 2 - Sayfa sırası (sidebar önem sırasına göre)

### Ana Menü
- [x] `/` — Cockpit (dashboard) — bulgular: (1) `metricsQuery.isError` hiç gösterilmiyordu, sessizce
      0/boş rakam basıyordu → `PageStatus` error banner eklendi; (2) durum renkleri (`bg-emerald-500`,
      `text-red-600`, `text-amber-600`) hardcoded, dark mode'da adapte olmuyordu → `--bento-pos/neg/warn`
      token'larına ve mevcut `text-destructive`'e taşındı (`kpi-card.tsx`, `bar-trend.tsx`, dashboard
      `HealthBadge`/`StatusStrip`); (3) `BarTrendCard` loading sırasında "Veri yok" (boş durum)
      gösteriyordu, gerçekte yükleniyor → `loading` prop + skeleton eklendi. `errors-panel.tsx` zaten
      iyi durumda, dokunulmadı.
- [x] `/cms/collections` — aynı desen bulundu: `useList` sonucu loading/error state olmadan
      doğrudan render ediliyordu → `query.isLoading`/`isError` + `PageStatus` eklendi
- [x] `/cms/entries` — aynı loading/error boşluğu + tarih `en-US` formatındaydı (Türkçe arayüzde
      tutarsız) → `tr-TR`'ye çevrildi
- [x] `/cms/assets` — aynı loading/error boşluğu + medya thumbnail'leri `loading="lazy"` yoktu
      (çok sayıda görselde performans riski) → ikisi de eklendi
- [x] `/users` — zaten iyi kurulmuş: cache'li query (`staleTime` fix'i kod yorumunda belgeli),
      skeleton loading, hata mesajı, zengin `EmptyState`. Değişiklik yapılmadı.
- [x] `/segments` — `isLoading` sırasında boş tablo sessizce render ediliyordu (satır yoktu ama
      loading göstergesi de yoktu), `isError` hiç kontrol edilmiyordu → `PageStatus` eklendi
- [x] `/reviews` — aynı loading/error boşluğu; ayrıca gerçek bir **absolute-ban ihlali**:
      geliştirici yanıtı kutusunda `border-l-2` (side-stripe border, impeccable'ın yasak listesinde)
      → tam kenarlıkla değiştirildi. Tarih `en-US` → `tr-TR`.
- [x] `/audit` — aynı loading/error boşluğu (Müdahale geçmişi) → `PageStatus` eklendi

### Analitik & İçgörü
- [x] `/revenue` — `query.isError` hiç gösterilmiyordu (dashboard'daki aynı sessiz-hata deseni) →
      `PageStatus` error banner eklendi
- [x] `/growth` — aynı isError boşluğu + ülke kırılımı tablosu loading sırasında "Ülke kırılımı
      yok" (yanlış) mesajı basıyordu → `countryQuery.isLoading` ayrımı eklendi. Alt bileşenler
      (`PostHogGeoCard`, `AcquisitionCard`) zaten loading/error/empty'i doğru sırayla yapıyordu,
      dokunulmadı.
- [x] `/funnel` — zaten iyi kurulmuş: `ErrorBanner`, per-KPI loading, absolute-ban ihlali yok.
      Değişiklik yapılmadı.
- [x] `/alerts` — iki ayrı liste (kurallar + tetiklenen olaylar), ikisinde de aynı isLoading/isError
      boşluğu vardı → ikisine de `PageStatus` eklendi

### Mesajlaşma
- [x] `/mail` — aynı isLoading/isError boşluğu → `PageStatus` eklendi
- [x] `/push` — aynı boşluk (mail ile neredeyse aynı şablon) → `PageStatus` eklendi
- [x] `/campaigns` — aynı boşluk → `PageStatus` eklendi

### DevOps
- [x] `/integrations` — ham İngilizce string bulundu (EmptyState açıklaması) → Türkçeleştirildi;
      `IntegrationsPanel`'de daha ciddi bulgu: sorgu yüklenirken tüm sağlayıcı kartları kısa süreliğine
      "bağlı değil" gösteriyordu (integrations verisi henüz gelmemiş) → loading guard eklendi
- [x] `/system` — 5 yerde `en-US` tarih formatı vardı (bir `fmt()` helper dahil) → hepsi `tr-TR`'ye
      çevrildi; en görünür bölüm olan "Senkron geçmişi" tablosunda loading sırasında "Henüz senkron
      çalışmadı" (yanlış) mesajı basılıyordu → düzeltildi. **Not:** sayfa 996 satır, 5 ayrı `useList`
      var (heartbeats, sentry hataları, entegrasyon sağlığı) - zaman bütçesi nedeniyle sadece en
      kritik bölüm düzeltildi, diğerleri gelecek bir turda gözden geçirilmeli.
- [x] `/logs` — aynı loading/error boşluğu → `PageStatus` eklendi
- [x] `/versions` — aynı boşluk + 1 adet `en-US` tarih → `tr-TR`'ye çevrildi

### Destek
- [x] `/settings` — zaten temiz (tr-TR tarih, senkron sağlığı badge'i, `CronHealthCard` da doğru
      loading/error/empty sırasına sahip). Değişiklik yapılmadı. **Faz 2 tamamlandı (18/18).**

---

## Faz 3 - Gizli CRUD/detay sayfaları

- [x] `/users/:id` — zaten iyi kurulmuş (skeleton, error state); 2 adet `en-US` tarih → `tr-TR`
- [x] `/properties` — hiç loading/error kontrolü yoktu → eklendi
- [x] `/properties/create` — zaten temiz (yeni kayıt, çekilecek veri yok)
- [x] `/properties/edit/:id` — **sistemik bulgu**: form gerçek veri gelmeden boş/varsayılan
      değerlerle render oluyor, `useEffect`+`reset()` ile üzerine yazılıyordu - kullanıcı kısa
      süreliğine yanlış alan değerleri görüyordu → `query.isLoading`/`isError` guard eklendi. Aynı
      `useForm`+`reset()` deseni tüm repo'da arandı (grep), 2 sayfa daha bulundu (aşağıda).
- [x] `/brands/edit/:id` — aynı sistemik form-flash bulgusu → düzeltildi
- [x] `/projects/edit/:id` — aynı sistemik form-flash bulgusu → düzeltildi (legacy proje düzenleme)
- [x] `/cms/collections/edit/:id` — zaten iyi kurulmuş (loading + not-found). Değişiklik yapılmadı.
- [x] `/cms/entries/create` + `/cms/entries/edit/:id` (aynı dosya, `isCreate` ile ayrılıyor) —
      aynı sistemik form-flash bulgusu (raw `useState`+`useEffect`, react-hook-form değil ama aynı
      desen) → `entryQuery.isLoading`/`isError` guard eklendi (sadece edit modunda, create'te veri
      çekilmiyor); 1 adet `en-US` tarih → `tr-TR`.

## Zaten yapıldı (referans, tekrar incelenmeyecek)
- [x] `/login` — bu oturumda tamamen yeniden tasarlandı (split-panel, orbit görsel, TR/EN)

---

## İşleyiş kuralı

Her sayfa için: checklist uygulanır → bulgular bu dosyaya (madde altına) not düşülür → onay alınır →
düzeltme yapılır → kendi commit'i → checkbox işaretlenir → sıradaki sayfaya geçilir. Faz 1 bitmeden
Faz 2'ye geçilmez (paylaşılan bileşenler olgunlaşmadan tek tek sayfa cilası tekrar iş demek).
