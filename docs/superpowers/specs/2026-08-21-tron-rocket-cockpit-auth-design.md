# TRON Esintili Roket Kokpiti Auth Tasarımı

_2026-08-21 · WES-000 · Onaylanan yön: optimize edilmiş 3D/cel-shaded illüstrasyon + DOM form + hafif Motion katmanı_

## 1. Amaç

Web auth ekranı Helm'i bir "founder cockpit" olarak ilk bakışta anlatmalı. Sayfa,
referanslardaki sakin ve premium split-login kompozisyonunu; çizgi-film/3D roket
kokpiti illüstrasyonu ve sınırlı TRON ışık diliyle birleştirecek. Form her zaman
okunaklı, erişilebilir ve hızlı kalacak; görsel katman auth akışını gölgelemeyecek.

Başarı ölçütü: kullanıcı ekranı ilk gördüğünde "roket kokpiti" metaforunu anlar,
e-posta/şifre alanlarını aramadan bulur ve animasyon yüzünden etkileşim beklemez.

## 2. Tasarım Kararı

Seçilen yaklaşım:

1. Açık ve koyu tema için iki yerel, optimize edilmiş 3D/cel-shaded kokpit görseli.
2. Standart HTML form kontrolleri ve mevcut Refine/Supabase auth akışı.
3. Holografik çizgiler, durum ışıkları ve giriş geçişleri için `motion/react`.
4. Görsel optimizasyonu geliştirme aşamasında `sharp`; runtime bağımlılığı değil.
5. Gerçek zamanlı WebGL/Three.js yok.

Bu çözüm R3F/WebGL seçeneğine göre daha düşük bundle, GPU ve bakım maliyetiyle
aynı algısal kaliteyi verir. React Three Fiber, React 19 ile kullanılabilse de auth
sayfasında ayrı render loop, WebGL fallback ve düşük cihaz testi gerektirir; YAGNI
gereği kapsam dışıdır.

## 3. Görsel Dil

### 3.1 Kompozisyon

- Masaüstü dış kabuk: viewport'un yaklaşık `%94` genişliği, `%88` yüksekliği;
  `max-width: 1440px`, `min-height: 720px`.
- Sol görsel alan: `%56`; sağ auth alanı: `%44`.
- Tek dış kabuk; iki ayrı kart gibi görünmeyecek.
- Bölümler arasında sert divider yerine 80–120 px genişliğinde renk/ışık geçişi.
- Form sütunu maksimum `480px`; alanlar ve CTA tam genişlik.
- Dil seçici sağ üstte, marka işareti sol üstte.

### 3.2 Kokpit illüstrasyonu

Görsel 2.5D/cel-shaded olacak. Fotoğraf gerçekçiliği, çizgi roman konturu ve çocuk
oyunu estetiği kullanılmayacak. Sahne şunları içerir:

- Büyük roket ön camı ve dışarıda görünen bir gezegen/yörünge.
- Yuvarlatılmış fiziksel uçuş konsolu, birkaç düğme ve durum ışığı.
- Koyu kontur yerine hacim veren yumuşak kenar gölgesi.
- İki veya üç holografik veri paneli; üzerlerinde okunabilir metin bulunmayacak.
- Helm'in `h` işaretini taşıyan tek bir merkezi kontrol.
- İnsan, astronot, marka dışı logo veya başka ürün ekranı olmayacak.

Görseller:

- `cockpit-light.avif` + `cockpit-light.webp`
- `cockpit-dark.avif` + `cockpit-dark.webp`
- Kaynak master PNG repoya alınmayacak; üretim prompt'u docs altında saklanacak.
- Her yüklenen görsel hedefi: AVIF ≤ 280 KB, WebP ≤ 420 KB.
- Görselde metin üretilmeyecek; tüm metin DOM katmanında olacak.

### 3.3 Tema

**Açık tema:** inci beyazı dış zemin, yumuşak mavi/lila uzay ışığı, koyu grafit
metin, cyan HUD ve sınırlı lime durum ışığı.

**Koyu tema:** gece laciverti dış zemin, elektrik cyan HUD, düşük yoğunluklu
mor/mavi ortam ışığı, küçük lime durum ışıkları.

Tema mevcut `ThemeProvider` tarafından belirlenir. `<picture>` yalnızca aktif
tema görselini indirir; iki asset aynı anda yüklenmez.

## 4. Auth Paneli

Panel sırası:

1. Helm marka işareti ve TR/EN dil seçici.
2. `Tekrar hoş geldin.` / `Welcome back.` başlığı.
3. Tek cümle yardımcı metin.
4. E-posta alanı.
5. Şifre alanı ve göster/gizle butonu.
6. Genel hata alanı.
7. `Giriş yap` / `Sign in` CTA.
8. Alt güvenlik metni: `Private workspace · Supabase Auth`.

Public signup kapalı olduğu için kayıt bağlantısı yoktur. `Remember me` eklenmez;
Supabase session persistence zaten provider düzeyinde yönetilir. Şifre sıfırlama
route'u mevcut uygulamada tamamlanmadan `Şifremi unuttum` bağlantısı gösterilmez.

## 5. Hareket Sistemi

`motion` paketi `motion/react` girişinden kullanılır. Global `MotionConfig`
`reducedMotion="user"` olur.

- Sayfa açılışı: auth panel opacity `0→1`, `y: 12→0`, 260 ms ease-out.
- Kokpit görseli: opacity `0→1`, scale `1.025→1`, 420 ms ease-out.
- HUD çizgileri: tek seferlik stroke reveal, 500–700 ms.
- Durum ışığı: düşük yoğunluklu opacity pulse, 2.8 sn; yalnızca 1–2 küçük öğe.
- Pointer parallax: yalnızca `fine` pointer ve reduced-motion kapalıysa, maksimum
  `±6px`; React state yerine MotionValue kullanılır.
- CTA: hover'da renk değişimi ve `translateY(-1px)`; 140 ms.
- Hata: yalnızca opacity + renk; shake/bounce yok.

Sürekli büyük transform, video autoplay, parçacık sistemi ve cursor follower yoktur.

## 6. Responsive Davranış

- `≥ 1024px`: `%56/%44` split düzen.
- `768–1023px`: `%50/%50`; kokpit kırpılır, form minimum `360px` korunur.
- `< 768px`: tek sütun. Görsel `30–34svh`, form aşağıda; dış kabuk tam genişlik.
- `< 420px`: dekoratif HUD etiketleri gizlenir, yalnızca kokpit görseli ve bir durum
  ışığı kalır.
- Ekran yüksekliği `< 700px`: dikey padding azalır; sayfa kaydırılabilir olur.
- Sanal klavye açıldığında form alanları görünür kalır.

## 7. Dil Desteği

Mevcut `I18nProvider` korunur. Auth ekranındaki hiçbir kullanıcı metni doğrudan
JSX'e yazılmaz. TR ve EN anahtarları aynı commit içinde tamamlanır. Dil tercihi
`helm.locale` anahtarıyla saklanır ve `<html lang>` güncellenir.

Görsel asset üzerinde dil bağımlı metin bulunmaz. Böylece tema başına iki değil,
yalnızca bir görsel varyantı yeterlidir.

## 8. Bileşen Sınırları

- `pages/login.tsx`: auth state, submit ve sayfa kompozisyonu.
- `components/auth/cockpit-visual.tsx`: `<picture>`, HUD ve hareket katmanı.
- `components/auth/login-form.tsx`: alanlar, validation, hata ve submit.
- `components/auth/language-toggle.tsx`: locale değiştirme.
- `styles/auth.css`: yalnızca auth layout ve tema görsel token'ları.
- `lib/i18n.tsx`: auth çevirileri ve locale davranışı.

`login.tsx` hedefi ≤ 80 satırdır. Görsel, form ve dil seçici birbirinin state'ine
erişmez; sayfa yalnızca bunları compose eder.

## 9. Paketler

### Eklenecek

- `motion`: React animasyonları, MotionValue parallax ve reduced-motion yönetimi.
- `sharp` (devDependency): master asset'ten AVIF/WebP üretimi.

### Mevcut ve kullanılacak

- React 19 + Vite 6
- Tailwind CSS 4 ve mevcut tema token'ları
- Refine `useLogin`
- Supabase Auth provider
- Lucide React ikonları
- Mevcut `I18nProvider` ve `ThemeProvider`

### Eklenmeyecek

- `three`, `@react-three/fiber`, `@react-three/drei`
- GSAP
- Lottie
- Uzak Unsplash veya başka runtime görsel URL'si

## 10. Performans ve Karmaşıklık

- Auth route'un ilk yüklenen JS chunk artışı gzip ≤ 18 KB.
- LCP masaüstü hızlı bağlantıda ≤ 2.0 sn; mobil orta profil hedefi ≤ 2.5 sn.
- Görsel için `fetchpriority="high"`, fallback WebP ve kesin `width/height` kullanılır.
- CLS hedefi `0`; görsel alanı aspect ratio ile önceden ayrılır.
- Parallax her frame React render üretmez.
- Login validation zaman karmaşıklığı `O(n)`; `n` e-posta uzunluğu.
- Login validation yardımcı alanı `O(1)` ek bellek.
- HUD dekorasyonu sabit sayıda öğe (`O(1)` render ve bellek).

## 11. Erişilebilirlik

- WCAG 2.1 AA kontrastı: gövde metni ≥ 4.5:1, büyük metin ≥ 3:1.
- Görsel dekoratifse `aria-hidden`; anlamlı durum metni DOM'da bulunur.
- Tüm alanların görünür label'ı vardır.
- Şifre butonu TR/EN `aria-label` taşır.
- Hata alanı `role="alert"`; auth provider'ın ham hata metni gösterilmez.
- Klavye focus sırası: dil → e-posta → şifre → göster/gizle → giriş.
- Focus ring her temada en az 3:1 kontrast sağlar.
- Reduced-motion tercihinde parallax/pulse kapanır; yalnızca opacity geçişi kalır.

## 12. Güvenlik ve Hata Davranışı

- E-posta trim + lowercase edilir; loglanmaz.
- Hata mesajı hesap varlığını ifşa etmez: `E-posta veya şifre hatalı.`
- Submit pending iken tekrar gönderim engellenir.
- Ham Supabase hata nesnesi UI'da ve console'da gösterilmez.
- Form autocomplete: `email` ve `current-password`.
- Asset ve Motion için üçüncü parti runtime isteği yapılmaz.

## 13. Doğrulama

Otomatik:

- TypeScript `tsc --noEmit`.
- ESLint hedef dosyalar.
- Auth formu için kritik davranış testleri: validation, loading, hata, locale.
- Görsel asset bütçesi script assertion'ı.
- Production build.

Manuel:

- 1440×900, 1024×768, 390×844 viewport.
- Açık/koyu tema.
- TR/EN ve uzun İngilizce metin taşması.
- Klavye-only ve VoiceOver temel akışı.
- Reduced-motion açık/kapalı.
- Görsel yüklenmezse formun eksiksiz çalışması.

## 14. Kabul Kriterleri

1. İlk bakışta roket kokpiti metaforu anlaşılır; görsel fotoğraf gerçekçiliğinde değildir.
2. Form ve CTA görselden bağımsız olarak okunur ve kullanılabilir.
3. Açık/koyu tema ve TR/EN kombinasyonlarının dördü de tamamdır.
4. Mobilde yatay taşma yoktur ve form klavyeyle kapanmaz.
5. Reduced-motion modunda sürekli hareket yoktur.
6. Public signup veya tamamlanmamış şifre sıfırlama akışı gösterilmez.
7. Runtime'da uzak görsel, WebGL veya sürekli React render loop yoktur.
8. Typecheck, lint, kritik testler ve production build geçer.

## 15. Kapsam Dışı

- Kayıt ve şifre sıfırlama sayfaları.
- OAuth sağlayıcı butonları.
- Gerçek zamanlı 3D/WebGL.
- Auth sonrası dashboard tasarımının değiştirilmesi.
- Web genelindeki tüm sayfa metinlerinin TR/EN migrasyonu; auth metinleri tamdır,
  global i18n migrasyonu ayrı iş paketidir.
