# Mobil yayın ve Make komutları

Helm iOS uygulaması **bu Mac'te** derlenir ve **bu Mac'ten** App Store Connect'e
yüklenir. EAS cloud kullanılmaz. Bu belge sistemin nasıl çalıştığını, neden böyle
kurulduğunu ve bir şey bozulursa nereye bakılacağını anlatır.

Son güncelleme: 2026-09-14

## Hangi komutu ne zaman

| Değişiklik | Komut | Süre |
|---|---|---|
| Sadece JS/TS (ekran, hook, metin, stil) | `make ota` | saniyeler |
| Native (yeni paket, widget, `app.config.ts`, izinler, ikon) | `EAS_PROFILE=production make ios-release` | 15-20 dk + Apple işleme |

Emin değilsen önce OTA'yı düşün. Build ancak native değişiklik varsa gerekli.
OTA yalnızca aynı uygulama sürümündeki (`version`, şu an `0.1.4`) build'lere iner;
`runtimeVersion` politikası `appVersion`.

## Build + yükleme akışı

```
EAS_PROFILE=production make ios-release            (kök → apps/mobile ios-local-release)
  ├─ require-store-profile   hat production mı?        değilse DUR
  ├─ require-asc             .p8 anahtarı + ASC_ISSUER_ID var mı?  yoksa DUR
  ├─ ios-local-build         eas build --local
  │     ├─ EAS remote sayaç: buildNumber +1
  │     ├─ prebuild → pod install → xcodebuild archive
  │     └─ dist/helm-ios-production.ipa
  └─ ios-submit              xcrun altool --upload-package
        └─ App Store Connect → TestFlight (işleme 5-15 dk)
```

Kontroller build'den **önce** çalışır; 20 dakika sonra "ayar eksik" diye durmaz.

## Mobil Makefile (`apps/mobile/`)

| Komut | Ne yapar |
|---|---|
| `ios-local-release` | Build + yükleme, tek komut |
| `ios-local-build` | Sadece IPA, hiçbir yere göndermez (her hat) |
| `ios-submit` | Hazır IPA'yı `altool` ile yükler (`IPA=./dist/x.ipa`) |
| `ios-submit-eas` | Yedek: aynı IPA'yı EAS Submit ile gönderir |
| `ios-cloud-build` / `ios-cloud-release` | EAS cloud, `CLOUD=1` olmadan çalışmaz |
| `ios-prebuild` | `ios/` klasörünü sıfırdan üretir + widget yamaları |
| `pod-install` | `pod install` + CocoaPods düzeltmesi |
| `ios-codegen` | `ios/build` silindiyse ReactCodegen |
| `ios-device` | Kabloyla bağlı iPhone'a debug kurulum |
| `check` | bun + eas-cli + eas oturumu |
| `clean-dist` | `dist/` siler |

### Hat (`EAS_PROFILE`) - varsayılan yok

| Hat | İmza | Nereye |
|---|---|---|
| `production` | App Store | TestFlight, `production` kanalı. Tek yayın hattı |
| `preview` | AdHoc | Sadece kayıtlı cihaz. Yükleme komutları reddeder |
| `development` | Dev client | Geliştirme |

Hat verilmezse terminalde sorulur; terminal yoksa (CI, agent) komut durur.

## Kök Makefile (`helm/`)

| Komut | Ne yapar |
|---|---|
| `make help` | Komut listesi |
| `make install` | `bun install` |
| `make hooks` | Git hook'ları (clone sonrası bir kez) |
| `make dev-web` / `make dev-mobile` | Web kokpit / Expo |
| `make typecheck` | Tüm workspace'lerde `tsc` |
| `make build-web` | Web production build → `apps/web/dist` |
| `make scan-secrets` / `make audit-secrets` | Dosyalarda / tüm git geçmişinde sır taraması |
| `make gen-types` | Supabase şeması → `packages/types/src/database.ts` |
| `make db-push` | ⚠️ Migration'ları canlı veritabanına uygular |
| `make fn-deploy FN=<ad>` | ⚠️ Edge function deploy |
| `make ios-release` | ⚠️ Yukarıdaki build + yükleme akışı |
| `make ota` | ⚠️ OTA güncellemesi; kanal her seferinde sorulur (`CHANNEL=production`) |
| `make clean` | `node_modules` + build çıktıları |

⚠️ = canlı sisteme dokunur, geri alması zor.

## Değişkenler

| Değişken | Nerede | Anlamı |
|---|---|---|
| `EAS_PROFILE` | komut satırı | Build hattı, zorunlu |
| `CHANNEL` | komut satırı | OTA kanalı, zorunlu |
| `ASC_ISSUER_ID` | kök `.env` | App Store Connect issuer ID |
| `ASC_KEY_ID` | otomatik | `~/.appstoreconnect/private_keys/AuthKey_<ID>.p8` dosya adından |
| `IPA`, `DIST` | isteğe bağlı | IPA yolu, çıktı klasörü |
| `CLOUD=1` | isteğe bağlı | Cloud build kilidini açar |

Anahtar ID'si ve issuer ID repo'ya **yazılmaz** (repo public).

## İlk kurulum (yeni makine)

1. Xcode, bun, `bun add -g eas-cli`, `eas login`.
2. App Store Connect → Users and Access → Integrations → App Store Connect API →
   **Team Keys** → App Manager rolüyle anahtar oluştur, `.p8`'i indir.
3. `.p8`'i `~/.appstoreconnect/private_keys/` altına koy. Klasörde **tek** anahtar olmalı
   (birden fazlaysa `ASC_KEY_ID=<id>` ver).
4. Aynı sayfada Team Keys listesinin üstündeki **Issuer ID**'yi kopyala, kök `.env`'i
   editörle açıp ekle: `ASC_ISSUER_ID=<uuid>`. `echo >> .env` kullanma: son satır
   newline'sız ise önceki satıra yapışır.

## Neden böyle kuruldu

| Karar | Neden |
|---|---|
| Build yerel (`--local`) | EAS cloud ücretsiz kuyrukta 5-6 saat bekledi ve non-interactive'de `EXPO_TOKEN` istedi. Yerel 15-20 dk |
| Yükleme `altool` ile | EAS Submit kuyruğuna ve Expo hesabına gitmez, doğrudan Apple'a |
| `eas submit --latest` yok | EAS'teki son **cloud** build'i seçer, yerel IPA'yı görmez |
| Hat ve OTA kanalı varsayılansız | Sessiz varsayılan yanlış hatta gönderdi: `make ota` preview'a yayınladı, telefon production dinliyordu, güncelleme hiç inmedi |
| Yükleme sadece production | Telefon production kanalını dinliyor; preview AdHoc imzalı |
| Build numarası EAS remote + `autoIncrement` | Elle artırma unutulunca TestFlight aynı numarayı reddediyor. `app.config.ts`'teki `buildNumber` yok sayılır |
| Makefile `LANG`/`LC_ALL` UTF-8 export eder | Bu makinede locale boş; CocoaPods `pod install`'da `Encoding::CompatibilityError` veriyor |
| OTA öncesi anahtar formatı kontrolü | Production ortamı eski `eyJ...` anahtarı taşıyordu, yayından sonra tüm ekranlar boşaldı |

## Sorun giderme

| Belirti | Anlamı |
|---|---|
| Bir komut `EXPO_TOKEN` istiyor | Cloud'a gidiyorsun. Yerel komutu kullan |
| `HATA: hat secilmedi` | `EAS_PROFILE=production` ver |
| `HATA: ASC_ISSUER_ID kok .env'de yok` | İlk kurulum adım 4 |
| `[INSTALL_PODS] Error: Cannot find module 'expo-dev-client/package.json'` | Zararsız. `expo-updates` isteğe bağlı paketi arıyor, build devam eder |
| `EXPO_USE_PRECOMPILED_MODULES=1 was set, but React Native is configured to build from source` | Uyarı, build'i bozmaz, sadece yavaşlatır |
| `altool --generate-jwt` "arguments must be specified" | Bu komut `--p8-file-path` ister; yükleme (`--upload-package`) etkilenmez |
| TestFlight numarası atlanmış | Normal. Sayaç build başında artar; yarıda kesilen build numarayı tüketir. Geri almak için: `cd apps/mobile && eas build:version:set -p ios` |
| Yükleme "bundle version already used" | EAS sayacı TestFlight'ın gerisinde; yukarıdaki komutla TestFlight'taki en yüksek numaraya eşitle |

## Durum notu

- 2026-09-14: EAS remote sayaç 16'dan başlatıldı ve 17'ye çıktı; o build yarıda
  durduruldu. TestFlight'taki son build **16**. Bir sonraki build **18** olacak (17 atlanır,
  sorun değil).
- Sayaç EAS'te oluştuğu için `app.config.ts`'teki `buildNumber: "16"` satırı artık
  kaldırılabilir.
