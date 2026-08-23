# Product

## Register

product

## Users

Tek kurucu (Can) ve küçük bir ekip — kendi sahip oldukları birden fazla dijital ürünü (web app,
mobil app, oyun, website) tek panelden yöneten operatörler. Günün büyük bölümünde bu panele kısa
aralıklarla bakılıyor: gelir/kullanıcı sayısı kontrol, hata/uyarı taraması, entegrasyon sağlığı,
CMS içerik güncellemesi. Yoğun, karar-verme odaklı kullanım — uzun oturumlar değil, sık ve hızlı
kontroller.

## Product Purpose

Helm, birden fazla projenin (property) gelir, kullanıcı, hata ve pazarlama metriklerini tek
"kokpit"te birleştiren bir founder-ops aracı. Amaç: kurucunun hangi sayıya bakması gerektiğini
öne çıkarmak, dağınık entegrasyon (AdMob, RevenueCat, Sentry, App Store Connect vb.) verisini tek
ekranda normalize etmek. Başarı: kurucu güne başladığında 30 saniyede "bugün nasıl gidiyor"
sorusuna cevap bulabiliyor.

## Brand Personality

Kontrol odası / kokpit. Teknik, güvenilir, gösterişsiz. Süs değil sinyal. Referans: login
ekranında zaten uygulanmış "cockpit" dili (monospace HUD etiketleri, tek lime-green accent, koyu
zemin, orbit/canlı-veri görselleştirmesi) — bu dil diğer sayfalara da taşınmalı. Üç kelime:
**net, teknik, sakin.**

## Anti-references

- Jenerik "AI SaaS" şablonu: kremrengi/sand arkaplan, gradient text, glassmorphism süsü, eyebrow
  etiketli bölümler, hero-metric kartları — hepsi `impeccable` skill'inin kendi yasak listesinde.
- Var olan flat "Kravio" temasının kendisi de bilinçli olarak efektsiz tutulmuş
  (`index.css`: "Efekt yok - bkz. glass.css") — bu tercih korunacak, glassmorphism eklenmeyecek.
- Mobile'ın "Liquid Glass" native iOS dili web'e taklit edilmeyecek; web kendi flat/HUD dilini
  kullanır, mobile'a benzemeye çalışmaz (platformlar farklı, veri disiplini ortak).

## Design Principles

1. **Sinyal, süs değil.** Her görsel eleman bir kararı hızlandırmalı; salt dekoratif hiçbir şey.
2. **Kokpit tutarlılığı.** Login ekranında kurulan dil (HUD etiket, tek accent, monospace meta
   veri) tüm panelde tekrar etmeli — parça parça farklı "temalar" değil.
3. **Veri asla sessiz kaybolmaz.** Loading/error/empty durumları her ekranda açık, mobile'daki
   disiplinle birebir (`ScreenStatus` eşdeğeri).
4. **Az ama doğru hareket.** Klavye tetiklemeli/yüksek frekanslı etkileşimlerde animasyon yok;
   modal/drawer/toast gibi seyrek olaylarda kısa (≤300ms) ve amaçlı hareket var.
5. **Basitlik hız demektir.** Kurucu 30 saniyede cevap bulmalı — her ek kart/adım bu bütçeyi
   tüketir, gereksiz soyutlama veya süs bu bütçeden çalar.

## Accessibility & Inclusion

WCAG 2.1 AA (proje kök `CLAUDE.md` §2 zorunlu kılıyor). `prefers-reduced-motion` her hareketli
elemanda karşılanmalı. Kontrast: body metni ≥4.5:1, büyük metin ≥3:1 — mevcut `text-muted-foreground`
tonları bu eşiğin altına düşmemeli.
