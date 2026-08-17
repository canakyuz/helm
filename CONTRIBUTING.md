# Katkı

Helm tek kişilik bir proje ve önce kendi ihtiyacım için yazıldı. Katkı kabul
ediyorum, ama kapsam konusunda seçiciyim — büyük bir değişikliğe başlamadan önce
issue aç ve konuşalım. Reddedilen bir PR ikimizin de zamanını yakar.

## Kurulum

```bash
bun install
make hooks    # pre-commit sır taraması — bunu atlama
cp apps/mobile/.env.example apps/mobile/.env
```

Helm bir Supabase projesine bağlanır. Kendi projeni kurmak için
`supabase/migrations/` altındaki migration'ları uygula (`make db-push`), sonra
edge function'ları deploy et (`make fn-deploy`).

## Geliştirme

```bash
make dev-web       # Refine + Vite cockpit
make dev-mobile    # Expo, cache temiz
make typecheck     # tüm workspace'ler
```

## Beklentiler

**Tip güvenliği.** TypeScript strict. `any` yok — `unknown` + narrowing kullan.
Kaçınılmazsa neden gerektiğini yorumla açıkla.

**Katman sınırları.** `app/` yalnızca route; logic `src/`'ye gider. Component'ler
saf sunum, veri çekme hook'larda. Detay:
[docs/architecture/monorepo.md](./docs/architecture/monorepo.md).

**Tasarım sistemi.** UI'a dokunuyorsan önce
[apps/mobile/design.md](./apps/mobile/design.md) oku. Token adı uydurma, mevcut
paleti genişletme.

**Sır yok.** Gerçek credential `.env`'de durur. `.env.example` sadece placeholder.
Pre-commit hook bunu zorlar; bkz. [SECURITY.md](./SECURITY.md).

## Commit formatı

Conventional Commits + issue ID, tek satır:

```
type(scope): WES-XXX ne değişti
```

`type`: `feat` `fix` `refactor` `chore` `docs` `style` `perf` `test` `ci` `build`
`scope`: etkilenen alan — `mobile`, `web`, `domain`, `ingest`, `root`

Kendi issue ID'n yoksa `WES-000` kullan. Örnek:

```
fix(ingest): WES-000 stop writing fake zero errors when the sdk is silent
```

Mesajı ne yapıldığıyla değil **neden** yapıldığıyla yaz — diff zaten ne olduğunu
gösteriyor.

## PR

- Bir PR, bir konu. Karışık PR'lar geç review alır.
- `make typecheck` ve `make scan-secrets` yeşil olmalı — CI zaten zorlar.
- Davranış değiştiren şeyleri gerçek veriyle doğrula, ekran görüntüsü ekle.
- Kırılan bir şey varsa PR açıklamasında söyle. Sürpriz, geç bulunan hatadan iyidir.

## Lisans

Katkın [AGPL-3.0](./LICENSE) altında yayınlanır.
