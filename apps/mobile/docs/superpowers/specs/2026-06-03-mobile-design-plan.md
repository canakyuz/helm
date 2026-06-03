# Helm Mobile — Tasarım İş Planı (2026-06-03)

Skill'lerle (emil-design-eng · impeccable · taste) yürütülen çok fazlı tasarım/UX iyileştirme planı.
Her faz `design.md` + `tokens.ts` otoritesine bağlı; web skill'lerinin prensipleri alındı, RN'e dayatılmadı.

## Yöntem
6 paralel `ui-ux-reviewer` ajanı 5 ekranı + paylaşılan `liquid/` bileşenlerini token sistemine karşı
denetledi. Sorunlar sistemik çıktı → önce paylaşılan katman düzeltildi (5 ekranı birden etkiler).

## Durum

> ⚠️ **DERS (2026-06-03):** Faz 0 (token/font/boşluk pass'i) **körlemesine** yapıldı — sim'de
> gözle doğrulanmadan. Sonuç: boyutlar/boşluklar kaydı, kullanıcı "uygulama bozuldu" dedi.
> **Geri alındı** (`449d346`). Yalnız kayma-yapmayan 3 kazanım kaldı. **Kural: bundan sonra
> her boşluk/font/motion değişikliği ÖNCE sim'de gözle doğrulanacak (Faz 1 gate), sonra commit.**

| Faz | Skill | İş | Durum | Commit |
|---|---|---|---|---|
| 0 | token/kontrast/renk pass | press feedback, kontrast, skala font/boşluk — **layout kaydırdı** | ❌ geri alındı | `449d346` |
| — | köşe-fix | glass kart köşe-kesik artifact (her katmana borderRadius) | ✅ kaldı | `449d346` |
| — | feat | "Today · saat" (eyebrowMeta) | ✅ kaldı | `449d346` |
| 2 | onboard | metriksiz projede sahte sıfır yerine veri-yok durumu | ✅ kaldı | `449d346` |
| 1 | critique | **sim'de gözle doğrulama** — artık her fazın ÖN KOŞULU | ⏳ gate | — |
| 3 | layout | section ritmi + KV hizalama — **gözle, tek tek, küçük adım** | ⏳ | — |
| 4 | emil/animate | `useReducedMotion`; stagger; FadeIn <300ms — **gözle** | ⏳ | — |
| 5 | typeset/extract | `radius.sm`; type 20–40 boşluk; tek `Hairline` | ⏳ | — |
| 6 | colorize/taste | accent=yalnız CTA kuralı; glyph tint kararı | ⏳ | — |

## Görsellerden kanıtlar (2026-06-03)
- **Wesan kartı:** her şey `₺0.00 / 0 / Unknown` → "veri yok" sahte sıfır olarak gösteriliyordu. *(Faz 2'de çözüldü)*
- **Top countries → OS versions:** section'lar arası düzensiz dikey boşluk. *(Faz 3 — gözle)*
- **Genel:** Faz 0 sim'de gözle doğrulanmadı. *(Faz 1 — gate)*

## Notlar
- Faz 3/4 gözle doğrulama gerektirir; körlemesine boşluk/motion oynanmaz (regresyon riski).
- Faz 5/6 düşük öncelik, görsel-yargısız cleanup — gate sonrası.
- Her faz bağımsız commit + OTA (`eas update --branch production`).
