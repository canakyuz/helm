# Helm Bento Sistemi — Tasarım Spec'i

**Tarih:** 2026-08-11 · **Dal:** `feat/bento-design-system` · **Kaynak:** `Helm Bento Sistemi.dc.html` (447 satır)

Bu spec, mobil cockpit'in Liquid Glass'tan Bento'ya geçişini tanımlar. Kaynak tasarım
bir mockup'tır; buradaki sapmaların her biri ölçüme veya yazılı bir kurala dayanır ve
gerekçesiyle işaretlidir.

---

## 1. Karar: ne değişiyor, ne kalıyor

Bento, Liquid Glass'ın üstüne sürülen bir cila değil — `design.md` §4/§5/§6/§8'i ve
`CLAUDE.md` §7'yi iptal eden bir dil değişimi. Ama malzeme korunuyor.

| Katman | Karar |
|---|---|
| Düzen | **Bento** — çok sayıda ayrı tile, 10px gap. "Tek büyük kart" deseni emekli. |
| Yüzey malzemesi | **Cam korunur** — `expo-glass-effect` / `BlurView` yaşamaya devam eder. |
| Arka plan | Aurora **korunur ama kısılır**; blueprint grid kaldırılır. |
| Tema | **Light + dark**, sistem takipli (`useColorScheme`), Settings'te Sistem/Koyu/Açık. |
| Ölçek | Bento'nun kendi değerleri, isimlendirilmiş. 4pt merdiveni emekli. |
| Veri | Değişmez — mevcut 29 hook aynen kullanılır. |
| IA | Değişmez — 5 sekme + login, rotalar birebir eşleşiyor. |

**Taşınan (dokunulmadı):** accent `#D4FF4D`, accentInk `#11130A`, Geist + Geist Mono,
`charts.tsx` (Skia eğri/ring/stack), `primitives.tsx` (`CountUp`, `Eyebrow`, `Delta`),
tüm veri hook'ları.

**Emekli olan:** `LiquidGlass` (dark hardcode), `LiquidBackground` (dark + grid),
`CardSection`/`FullDivider` editöryel indeks ritmi, `OpenHero` kartsız hero deseni.
Son ekran çevrilene kadar dosyada kalırlar.

---

## 2. Neden cam kalıyor ama aurora kısılıyor

Cam, arkasındaki şeyi bulanıklaştırarak var olur. `design.md` §4 bunu zaten yazmış:
*"GlassView koyu zemin üstünde tek başına görünmez → her zaman üstüne beyaz-tint fill
konur."* Bento düz `--bg` öneriyordu; düz zemin üstünde camın kıracağı hiçbir şey
kalmaz, geriye yarı saydam gri dikdörtgen kalır.

Eski aurora (opaklık 0.28–0.45 + grid) tek büyük kart için doğruydu. Bento'da ekranda
5–7 tile var; aynı yoğunluk görsel gürültüye döner. Opaklık **dark 0.12–0.18**,
**light 0.06–0.10**'a çekildi, grid kaldırıldı.

### Yüzey kuralı

```
--accent  → SOLID   lime hero, MRR tile. Altında bulanıklaştıracak şey yok.
--tile    → GLASS   cam burada yaşar.
--tile2   → SOLID   tile içi kutu. Cam içinde cam = çamur + 2x blur maliyeti.
```

Overview'da bu kural cam yüzey sayısını 7'den 4'e indiriyor.

---

## 3. Renk — ölçülmüş sapmalar

Mockup'ın light paleti kontrast açısından test edilmemişti. WCAG 2.1 AA (normal
metin 4.5:1, dolgu 3:1) ölçümü ve düzeltmeler:

| Token | Mockup | Ölçüm | Düzeltilmiş | Yeni |
|---|---|---|---|---|
| light `pos` | `#1F9B57` | 3.15:1 ✗ | **`#1B512D`** | 8.20:1 |
| light `neg` | `#E0263F` | 4.10:1 ✗ | `#D4243C` | 4.50:1 |
| light `warn` | `#A8700A` | 3.72:1 ✗ | `#956409` | 4.52:1 |
| light `fg3` | `#93949B` | 2.67:1 ✗ | `#6D6D73` | 4.54:1 |
| dark `fg3` | `#5F5F68` | 2.74:1 ✗ | `#828289` | 4.53:1 |
| dark `pos` | `#57E08B` | geçiyordu | **`#C2F8CB`** | 14.49:1 |

`pos` değerleri marka kararı (Can); diğerleri AA düzeltmesi. Dark tema başka bir
düzeltme gerektirmedi; accent üstündeki `#11130A` metin 16.24:1, %60 alfalı eyebrow
bile 4.70:1.

### `fg3`'ün bedeli

`fg3` AA'ya çekilince `fg2`↔`fg3` parlaklık farkı **1.18x** (dark) / **1.31x** (light)
kalıyor — renk olarak neredeyse aynılar. Üç kademeli gri merdiven iki kademeye iniyor.

Kabul edildi, çünkü tasarım üçüncü kademeyi zaten renkle değil **biçimle** ayırıyor:
`fg3` metni her zaman 10px mono, BÜYÜK HARF, .16em tracking. Ayrımın taşıyıcısı
tipografi olur.

### Seri renkleri durum renklerinden ayrıldı

`#C2F8CB` ile accent `#D4FF4D` arasındaki parlaklık farkı **1.04:1**. Ton olarak
ayrılırlar (nane vs sarı-lime) ama kırmızı-yeşil renk körlüğünde bu ayrım kaybolur.
Tasarımın ülkeler grafiği `accent → violet → blue → pos` sıralıyordu (kaynak satır
394-398); 1. ve 4. çubuk ayırt edilemezdi.

**Kural:** `pos`/`neg`/`warn` yalnızca **durum** rengidir, asla seri rengi değil.
Seriler kendi ladder'ını kullanır: `accent → violet → blue → amber`. Ölçülen ayrım
dark'ta ≥1.97:1, light'ta ≥4.32:1.

---

## 4. Ölçek

Sayısal merdiven yerine **isimli semantik ölçek**. Gerekçe: bento'nun oranları 10px gap
ve 18px tile padding üzerine kurulu; 4pt'ye yuvarlamak (10→12, 18→16) ritmi bozar.
İsimlendirme "keyfi px" yasağını korur — her değerin bir kullanım yeri var.

```
space   screenX 16 · tileGap 10 · tilePad 18 · tilePadLg 20 · tilePadSm 16
        boxPad 14 · rowY 12 · headerY 14 · tabBarTop 12 · tabBarBottom 26
radius  tile 22 · inner 16 · field 14 · icon 13 · btn 12 · logo 18
        rail 4 · bar 3 · pill 999
type    eyebrow 10 · meta 12 · body 13 · row 14 · emph 15 · title 19
        statSm 22 · stat 28 · hero 48
```

İki sadeleştirme: `11.5px → 12` (tek yarım punto, 3 yerde geçiyordu);
`44/46/50px hero → tek 48` + `adjustsFontSizeToFit` (`design.md` §3 zaten şart
koşuyordu — uzun rakamda taşma kendiliğinden çözülür). Stat boyutu mockup'ta 26 ve 28
arasında gidip geliyordu, 28'de birleşti.

`tracking` em cinsinden tutulur; React Native `letterSpacing` mutlak nokta ister,
`track(fontSize, em)` çevirir.

---

## 5. Hareket

Tasarımın 7 CSS keyframe'i Reanimated'e çevrildi (`design.md` §8: "CSS yok").

| Anim | Mockup | Spec | Gerekçe |
|---|---|---|---|
| `rise` tile girişi | 460ms | **260ms** | UI girişi 300ms altında kalmalı |
| `grow` bar | 620ms | 620ms | Grafik — süre bilgi taşır |
| `rail` yatay oran | 760ms `width` | 760ms **`scaleX`** | `width` layout tetikler |
| `ring` gauge | 900ms | 900ms | Grafik |
| `count` sayaç | 900ms cubic-out | 900ms | Mevcut `CountUp` birebir aynı |
| `pulse` canlı nokta | 1800ms ∞ | 1800ms ∞ | — |
| `spin` sync | 900ms linear ∞ | 900ms linear ∞ | — |

Easing: `cubic-bezier(0.23, 1, 0.32, 1)`. Stagger: tile 40ms, bar 34ms, rail 80ms.
Press: satır/tile `opacity 0.85` @120ms, buton `scale 0.97` @140ms.

### Yeniden oynatma politikası

Mockup her sekme değişiminde `play()` çağırıyordu (kaynak satır 306). 5 sekmeli bir
cockpit'te sekme değişimi günde onlarca kez olur; o sıklıkta animasyon bilgi değil
gecikme taşır.

| Tetikleyici | Davranış |
|---|---|
| İlk mount | Tam stagger + sayaç |
| Sekme değişimi | **Animasyon yok**, değerler yerinde |
| Pull-to-refresh / sync | Sayaç + grafikler tekrar oynar |

Taze veri geldiğinde animasyon "bu rakam değişti" der; sekme değiştiğinde hiçbir şey
demez.

### Azaltılmış hareket

Sıfır animasyon **değil**: yer değiştirme ve ölçek kalkar, **fade kalır** (160ms).
Sayaç son değerde başlar. `useReducedMotion()` ile.

---

## 6. Mimari

```
packages/design/          framework-bağımsız TS — TEK KAYNAK
├── palette.ts            marka renkleri + seri ladder'ı
├── themes.ts             dark + light, aynı 14 anahtar
├── glass.ts              tema başına cam reçetesi + aurora opaklığı
├── scale.ts              space · radius · type · tracking · track()
├── motion.ts             süreler · easing · stagger · replay politikası
└── css.ts                tema → CSS değişkeni üretici (web için hazır)
        │
        ├─→ apps/mobile/global.css          ÜRETİLİR (bun run gen:design)
        ├─→ apps/mobile/tailwind.tokens.js  ÜRETİLİR
        └─→ [sonra] apps/web/src/styles/
```

Mobil Tailwind v3 JS config, web Tailwind v4 `@theme inline` — ikisi aynı dosyayı
okuyamaz, bu yüzden ortak kaynak düz TS, hedefler ondan **türetilir**.
`tailwind.config.js` bir `.ts` dosyasını require edemediği için ölçek de üretilir.

Renkler CSS değişkeninden okunur (`rgb(var(--tile) / <alpha-value>)`), böylece
`bg-tile` **tek className** olarak iki temada da doğru çözülür ve `CLAUDE.md` §7'nin
"inline style yasak" kuralı korunur. RGB kanal üçlüsü olarak yazılır — hex yazılırsa
Tailwind alfa modifier'ı (`bg-tile/50`) kırılır.

`useTheme()` runtime renkleri döndürür; yalnızca className ile çözülemeyen yerler
için: Skia, GlassView prop'ları, Reanimated interpolasyonu.

**Tema tek kaynak:** tercih (`preferences.themeMode`) → NativeWind `colorScheme` →
CSS değişkenleri. İkisi ayrı ayrı set edilirse kaçınılmaz olarak ayrışırlar —
className koyu, Skia grafiği açık kalır.

---

## 7. Bileşenler

```
src/components/bento/
├── tile.tsx        BentoTile (cam, tema-duyarlı) · SolidTile (opak)
├── rise.tsx        staggerlı giriş, replayKey ile tekrar
├── bars.tsx        flex bar grafiği, scaleY grow
├── meter.tsx       10 segmentli ilerleme
├── header.tsx      eyebrow + başlık + sync + uyarı rozeti
└── background.tsx  kısık aurora, tema-duyarlı
```

Her katman kendi `borderRadius`'unu taşır: iOS'ta native blur view'lar ebeveynin
`overflow:hidden`'ına güvenilir kırpılmıyor, yuvarlak kenarın altından kare köşe sızar.

Bar grafiği Skia değil flex: bu grafik sadece dikdörtgen, Skia canvas açmanın
kazandırdığı bir şey yok. Skia eğri/gradyan/ring gerektiren yerlerde kalır.

---

## 8. Durum

**Tamam:** token paketi · üretim hattı · tema çözümleyici · 6 bento primitifi ·
Overview ekranı · kısık aurora. Typecheck temiz, 3 commit.

**Kalan:** Revenue · Users(Analytics) · Health · Settings · login ekranları ·
alt sekme çubuğu kararı (tasarım custom pill kullanıyor, uygulama `NativeTabs`
kullanıyor — `design.md` §6 native diyor, çözülmedi) · `design.md` yeniden yazımı ·
`CLAUDE.md` §7 güncellemesi (light mode yasağı kalkacak) · geçiş dönemi palet
bloğunun silinmesi · `apps/web` token tüketimi.

**Doğrulanmadı:** cam + kısık aurora kararı simulator'da görülmedi. Bu spec'in en
büyük açık riski budur.
