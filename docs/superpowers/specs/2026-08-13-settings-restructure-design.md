# Ayarlar yeniden yapılandırma — tasarım

**Durum:** uygulandı, görsel doğrulama bekliyor
**Kapsam:** yalnızca B. Entegrasyon yönetimi (C) ve i18n (A) ayrı spec'ler.

## Sorun

Ayarlar tek ekranda beş düz tile idi. Üç somut kusur ölçüldü:

1. **Gruplama yanlış.** Para birimi "Görünüm" tile'ındaydı. Para birimi bir
   biçimlendirme kararı, görsel tercih değil.
2. **Tekrar.** Üstteki tile `N PROJE · M KAYNAK` yazıyor, alttaki sistem tile'ı
   aynı sayıları satır satır tekrar ediyordu.
3. **Çıkmaz.** Projeler, uyarı kuralları, son senkron — hepsi salt okunur sayı.
   Hiçbiri tıklanmıyordu, detaya gitmenin yolu yoktu.

Ayrıca istenen yeni işlevin (entegrasyon yönetimi, ~1250 satırlık web
özelliğinin portu) oturacağı bir yer yoktu.

## Karar

**Hub + itilen alt ekranlar.** Reddedilen alternatifler:

- *Tek kaydırma, bölümlenmiş:* entegrasyon formları bottom sheet'e sığmıyor,
  iç içe sheet'e düşülüyor.
- *Sekmeli ayarlar:* alttaki `NativeTabs` ile görsel olarak yarışıyor, iki
  kademe sekme tarama maliyetini artırıyor.

## Yapı

```
app/(cockpit)/settings/
  _layout.tsx      Stack, headerShown:false (başlık ekran içinde)
  index.tsx        hub
  appearance.tsx   tema · vurgu rengi
  data.tsx         para birimi · hedef · çarpan · gelir önceliği
  sources.tsx      bağlı entegrasyonlar (salt okunur)
  about.tsx        sürüm · senkron durumu · sayımlar
```

`NativeTabs.Trigger name="settings"` dizini kendiliğinden çözer; sekme çubuğu
kalır, itme sekmenin içinde olur.

`headerShown:false` çünkü `BentoBackground` başlığın altından geçmeli; native
başlık onu keserdi.

## Hub

Kimlik tile'ı, dört grup satırı, çıkış. Her satır sağda **özet** taşır — hub bir
menü değil, durum özeti; iç ekranı açmadan "tema neydi" cevaplanmalı.

| Satır | Özet |
|---|---|
| Görünüm | `Koyu · Camgöbeği` |
| Veri ve biçim | `TRY · ×1` |
| Kaynaklar | `4 bağlı · 1 hata` |
| Hakkında | `0.1.3` |

Proje/kaynak sayıları yalnızca kimlik tile'ında. Tekrar silindi.

## Kurallar

- **Dekoratif satır yok.** `rows.tsx` yorumunda kayıtlı: geçmişte dokuz satır
  `onPress={() => haptic.tap()}` ile hiçbir şey yapmıyordu ve bilerek silindiler.
  Gitmediği yere `›` konmaz. Bu yüzden `sources.tsx`'te çalışmayan bir "Ekle"
  butonu yok ve `appearance.tsx`'te henüz dil satırı yok.
- **`onSync` opsiyonel oldu.** Görünüm ve veri ekranlarında yenilenecek uzak veri
  yok; yenile butonu çizilmiyor.
- **Durum rengi tek başına anlam taşımaz.** `sources.tsx`'te her satırın sağında
  metin var (son senkron / HATA); renkli nokta yalnızca yedek kodlama.
- **Yeni hareket eklenmedi.** Mevcut `Rise` korundu, itme geçişi native Stack'in
  kendi animasyonu. `Rise` zaten `useReducedMotion` onurlandırıyor.

## Bileşen değişikliği

`BentoHeader`: `onBack?` eklendi, `onSync`/`syncing` opsiyonel oldu. İkinci bir
başlık bileşeni üretilmedi.

`src/components/settings/labels.ts`: tema etiketleri hub ve alt ekran arasında
paylaşılıyor (route dosyaları birbirinden import etmesin diye). i18n geldiğinde
çeviri katmanının bağlanacağı yer burası.

## Kapsam dışı

- **Entegrasyon ekleme/düzenleme (C).** Web paneli sır topluyor (RevenueCat v2
  Secret API Key, OAuth Client Secret, Service Role Key, Stripe Secret Key).
  Mobile taşımak `apps/mobile/CLAUDE.md`'deki "veri yazma minimum" kuralıyla
  çelişiyor; o kural güncellenmeden yapılmamalı.
- **i18n (A).** String yüzeyi B ve C ile büyüyeceği için en sona bırakıldı;
  şimdi çevirmek sonradan yeniden çeviri demek.

## Doğrulama

- `bun run typecheck` temiz.
- Expo typed routes yeniden üretildi (`.expo/types/router.d.ts`), aksi halde
  `/settings/sources` ve `/settings/about` tip hatası veriyordu.
- Simülatörde gözle doğrulama: **release build gömülü paketi çalıştırdığı için
  ilk denemede görülemedi** (Metro sıfır paket servis etti). Debug build ile
  tekrarlanmalı.
