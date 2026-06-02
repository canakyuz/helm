# Helm Mobile — Tasarım İş Planı (2026-06-03)

Skill'lerle (emil-design-eng · impeccable · taste) yürütülen çok fazlı tasarım/UX iyileştirme planı.
Her faz `design.md` + `tokens.ts` otoritesine bağlı; web skill'lerinin prensipleri alındı, RN'e dayatılmadı.

## Yöntem
6 paralel `ui-ux-reviewer` ajanı 5 ekranı + paylaşılan `liquid/` bileşenlerini token sistemine karşı
denetledi. Sorunlar sistemik çıktı → önce paylaşılan katman düzeltildi (5 ekranı birden etkiler).

## Durum

| Faz | Skill | İş | Durum | Commit |
|---|---|---|---|---|
| 0 | denetim + token/kontrast/renk | press feedback, fgMuted/fgSubtle kontrast, skala-dışı font/boşluk, glass token, semantik renk (health version-status bug) | ✅ bitti | `1ae9076` |
| — | — | glass kart köşe-kesik artifact (her blur/fill katmanına borderRadius) | ✅ bitti | `31a9cb4` |
| 2 | onboard/harden | metriksiz projede sahte sıfır yerine veri-yok durumu (loading/has-data/empty) | ✅ bitti | `3a6687c` |
| 1 | critique | **sim'de gözle doğrulama** (metro açık → cihazda hot-reload) | ⏳ gate | — |
| 3 | layout | section dikey ritmi: padded-View vs trailing-spacer tutarsızlığı; KV hizalama | ⏳ gözle | — |
| 4 | emil/animate | `useReducedMotion` sistemik (CountUp/HBar/Chevron/spin); liste stagger; FadeIn <300ms | ⏳ | — |
| 5 | typeset/extract | `radius.sm` token'ı; type 20–40 arası boşluk; tek `Hairline` primitive | ⏳ | — |
| 6 | colorize/taste | pozisyonel glyph tint'leri kaldır; accent=yalnız CTA kuralını design.md'ye yaz | ⏳ | — |

## Görsellerden kanıtlar (2026-06-03)
- **Wesan kartı:** her şey `₺0.00 / 0 / Unknown` → "veri yok" sahte sıfır olarak gösteriliyordu. *(Faz 2'de çözüldü)*
- **Top countries → OS versions:** section'lar arası düzensiz dikey boşluk. *(Faz 3 — gözle)*
- **Genel:** Faz 0 sim'de gözle doğrulanmadı. *(Faz 1 — gate)*

## Notlar
- Faz 3/4 gözle doğrulama gerektirir; körlemesine boşluk/motion oynanmaz (regresyon riski).
- Faz 5/6 düşük öncelik, görsel-yargısız cleanup — gate sonrası.
- Her faz bağımsız commit + OTA (`eas update --branch production`).
