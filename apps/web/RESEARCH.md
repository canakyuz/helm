# helm — Pazar Araştırması ve Yapısal Karar

> 3 paralel araştırma ajanı, gerçek ürünlerin docs/changelog/blog/satış
> verisi taranarak hazırlandı. Bu belge helm'in yapısal kararlarının
> kanıt temelidir.

---

## Yöntem

Üç eksende araştırma: (1) çok-projeli SaaS dashboard'larının bilgi mimarisi,
(2) solo founder / çok-ürün yönetim araçları ekosistemi ve all-in-one vs
odaklı strateji, (3) her modül türünün sektördeki standart alt-görünümleri.

---

## Bulgu 1 — "Founder OS / her şeyi yapan panel" kanıta aykırı

Pazar 4 katmana bölünmüş; **hayatta kalanların her biri TEK katmanı iyi yapıyor:**

- **Appfigures** — helm'in birebir emsali: çok-uygulamalı portföyü tek
  Overview'da toplar (indirme, gelir, IAP, reklam geliri, abonelik, store
  yorumları; tüm store'lar). Telefonda uygulama-arası kaydırma.
- **RevenueCat** — "abonelik verisinin tek kaynağı" olarak kazandı, *sonra*
  genişledi. Kokpit olarak değil — veri hub'ı olarak.
- **Baremetrics** — saf dashboard, tek entegrasyona (Stripe) bağımlı, moat
  yok. Stripe kendi metriklerini ekleyince gereksizleşti → 7 yıl yatay
  büyüme, yatırım zarar yazıldı, **4M$ nakit satıldı (2020)**.

All-in-one suite'lerin sektörel başarısızlık sebepleri (kaynaklar tutarlı):
- **Master-of-none** — suite tek alanda başlar, gerisini ekler; eklenenler sığ.
- **Entegrasyon kırılganlığı** — absorbe ettiğin her entegrasyon, partneri
  aleyhine dönebilecek bir bağımlılık (Baremetrics/Stripe dersi).
- **Notion tuzağı** — yapısız sınırsız esneklik = yönetilemez çöplük.
- Alıcılar ödedikleri kullanmadıkları genişlikten rahatsız (Gartner: %67).

Kazanan desen: **bir acılı işi kazan, sonra komşu işlere genişle** (Notion,
Figma, RevenueCat hepsi böyle). all-in-one bir *hedef*, lansman konumu değil.

## Bulgu 2 — Çok-projeli dashboard IA'sı: 9 üründe ortak desenler

Vercel, Supabase, Netlify, RevenueCat, PostHog, Linear, PlanetScale, Railway,
Cloudflare incelendi. Ortak, helm'e doğrudan uygulanabilir desenler:

1. **Scope switcher sol-üst köşede sabit.**
2. **3 seviyeli hiyerarşi evrensel:** Org/Workspace → Proje → Modül/Section.
3. **"Dual overview"** — tüm projeleri toplayan global Home + her projenin
   kendi Overview'u, birlikte. (RevenueCat en net örnek.)
4. **"Proje = filtre"** — scope değiştirmek başka sayfaya atmamalı; aynı
   sayfada veriyi yeniden scope'lamalı (Vercel, PlanetScale).
5. Modüller domain'e göre gruplanır; merkezi "Settings" parçalanıp ilgili
   modüllerin altına dağıtılır.
6. Collapse + pin/star/shortcut artık baz beklenti.

## Bulgu 3 — Modül başına standart alt-görünümler

Sektör ürünleri her modülü "tip × görünüm" matrisine açar (RevenueCat 27
chart, PostHog 6 insight tipi) — **ama bunlar ekipli, çok-tenant ürünler.**
Solo founder için modül başına **3-4 alt-görünüm** sınırı.

| Modül | Minimum değerli set | YAGNI |
|-------|---------------------|-------|
| Cockpit | Tek ekran 30-sn bakış: gelir + kullanıcı + uyarı + sistem | — |
| Analitik | Trend · Funnel · Retention (D1/D7/D30) · Canlı event | Paths, Stickiness, Lifecycle |
| Gelir | Overview · MRR hareketleri · Trial dönüşüm · Churn+kohort | forecasting, dunning |
| Kullanıcılar | Liste · Profil · Segment | Şirket profili (B2C) |
| Uyarılar | Kural listesi · Basit eşik editörü · Geçmiş · Kanal | escalation, downtime |
| Sistem | Monitör · **Heartbeat** · Olay geçmişi | status page, synthetic |

---

## helm İçin Karar

### helm'in kaması (wedge)
Çok-ürünlü bir solo founder'ın **tüm ürünlerinin (mobil + web, tüm store'lar
+ Stripe + reklam) tek dürüst gelir+kullanıcı rakamı — telefonda, alarmlı.**
Bugün hiçbir araç bunu temiz yapmıyor. helm'in tek değerli çekirdeği bu.

### Mevcut yapı — araştırmaya göre doğru olan
- ✅ Dual overview (Cockpit "Tüm Projeler" + proje görünümü)
- ✅ Proje = kapsam/filtre (scope switcher sayfayı değiştirmez)
- ✅ Domain-bazlı gruplu sidebar, sol-üst switcher

### Düzeltilecek olan
- ❌ Her grubu 9 panele genişletmek — belgelenmiş başarısızlık deseni.
  Modüller **sığ** kalmalı (3-4 alt-görünüm). Genişlik değil, **küratörlük**.
- helm'in ürünü **Cockpit'tir** — 30 saniyelik dürüst bakış. Yatırım oraya.

### Yapılmayacaklar (kanıt temelli)
- Tam CRM modülü — "CRM'i CRM'de tut"; sığ CRM = all-in-one hatası.
- Mail motoru — Loops/Resend. helm mail göndermez.
- Görev/not modülü — Notion tuzağı.
- Vanity metrik (toplam indirme/kullanıcı) başlık yapmak.

### Eklenecekler (ucuz, gerçek değer)
- Store **yorum/puan** toplama (Appfigures deseni).
- **Heartbeat monitoring** — cron/push-scheduler sessizce ölünce yakala.
- **Uyarı motoru** — "gelir %X düştü" → ping. Kokpiti ham dashboard'dan
  ayıran şey budur.

### Yol haritası (kanıta dayalı öncelik)
1. **Kamayı tamamla:** tüm projeleri bağla + RevenueCat → Cockpit gerçek,
   eksiksiz toplam göstersin. (Yapı hazır, **veri eksik.**)
2. **Uyarı motoru** (`helm-alert`) — kuralları senkron sonrası değerlendir,
   Telegram ping. Kokpitin asıl farkı.
3. **Cockpit'i mükemmelleştir** — 30-sn bakış, trend okları, sağlık.
4. Modülleri minimum sette tut — genişletme.
5. Store yorumları + heartbeat — ucuz değer.

> Özet: helm'in iskeleti doğru. Sıradaki iş **genişletmek değil** — kamayı
> (veri + uyarı) tamamlamak ve Cockpit'i keskinleştirmek.

---

## Kaynaklar

Appfigures Overview/revenue docs · RevenueCat dashboard redesign + Charts docs
· Baremetrics $4M satış analizi (bizbuygrow) · ChartMogul/Baremetrics
karşılaştırması · Vercel/Supabase/Netlify/PostHog/Linear/PlanetScale/Railway/
Cloudflare changelog & docs · PostHog/Mixpanel/Amplitude insight docs ·
Datadog/Grafana/Better Stack/Checkly alerting & monitoring docs · "SaaS
breadth vs depth" (graphstrategy) · "Unbundling 2.0" (Monetizely) · indie
hacker metrik kaynakları. Tam linkler araştırma ajanı çıktılarında.
