# Güvenlik

## Açık bildirimi

Bir güvenlik açığı bulduysan **public issue açma.** GitHub'ın
[Security Advisories](https://github.com/canakyuz/helm/security/advisories/new)
akışını kullan; oradan özel olarak konuşabiliriz.

İlk yanıt için hedefim 72 saat. Helm tek kişilik bir proje — SLA sözü vermiyorum,
ama bildirimini ciddiye alacağım.

Faydalı bir raporda şunlar olur: etkilenen bileşen (web / mobile / edge function /
migration), tekrar üretme adımları, ve saldırganın gerçekten ne elde ettiği.

## Kapsam

| Alan | Kapsamda mı |
|------|-------------|
| `apps/`, `packages/`, `supabase/` içindeki kod | ✅ |
| Tenant izolasyonunu delen RLS politikaları | ✅ |
| Sızmış credential (repo, history, build çıktısı) | ✅ |
| Bağımlılıklardaki bilinen CVE'ler | ✅ eğer Helm'de gerçekten sömürülebiliyorsa |
| Kendi Supabase kurulumunun yanlış yapılandırması | ❌ |
| Otomatik tarayıcı çıktısı, exploit gösterilmeden | ❌ |

## Sır yönetimi

Gerçek credential'lar `.env` dosyalarında durur ve asla commit edilmez.
`.env.example` yalnızca placeholder içerir.

Repo üç katmanlı bir bariyerle korunuyor:

```bash
make hooks           # pre-commit: stage'lenmiş içeriği tarar
make scan-secrets    # tracked dosyaların tamamı — CI'da da koşar
make audit-secrets   # tüm git history — denetim için
```

Tarayıcı [`scripts/check-secrets.sh`](./scripts/check-secrets.sh) içinde ve
placeholder'ları eler, böylece yanlış alarm üretmez. **`--no-verify` kullanma** —
hook yanlış alarm veriyorsa doğru düzeltme pattern'ı daraltmaktır.
