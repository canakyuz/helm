# Helm

An indie founder's **portfolio operations hub** - revenue, users, crashes and
reviews for every app you ship, in one place. A web console (setup and deep
admin) and a mobile app (KPIs, alerts and an iOS widget in your pocket) both
talk to the **same Supabase hub**.

> One product, two shells, a shared data layer - not one UI stretched across two
> screens. See [ADR-001](./docs/architecture/decisions/001-monorepo-shared-packages.md).

## Layout

```
helm/                       bun workspaces monorepo
├── apps/
│   ├── web/                Refine + Vite - admin, integration wizard, billing
│   └── mobile/             Expo (SDK 56) - KPI/alert/widget, TestFlight
├── packages/               @helm/* - shared layer between apps
│   ├── types/              Supabase Database + domain types (single source)
│   ├── api/                plain fetch functions (supabase.from)
│   ├── queries/            TanStack queryOptions + keys
│   ├── domain/             formatting, severity, modules
│   └── config/             staleTime, plan limits
├── supabase/               migrations + edge functions (shared by both apps)
└── docs/                   architecture and migration notes
```

## Getting started

```bash
bun install
make hooks   # git hooks - run once after cloning
```

Then copy the env template and fill in your own Supabase project:

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Helm expects a Supabase project of your own. Apply the migrations in
`supabase/migrations/` with `make db-push`, then deploy the edge functions with
`make fn-deploy`.

Real credentials live in `.env`; `.env.example` holds placeholders only. If you
stage an actual secret the `pre-commit` hook stops the commit, and the same scan
runs in CI. See [SECURITY.md](./SECURITY.md).

## Commands (`make help`)

| Command | What it does |
|---------|--------------|
| `make dev-web` | Web console (Refine/Vite) |
| `make dev-mobile` | Mobile (Expo, clean cache) |
| `make typecheck` | `tsc` across every workspace |
| `make build-web` | Web production build → `apps/web/dist` |
| `make gen-types` | Supabase schema → `packages/types/src/database.ts` |
| `make db-push` | Apply migrations to the remote database |
| `make fn-deploy FN=helm-payouts` | Deploy an edge function (omit `FN` for all) |
| `make ios-release` | Local IPA + TestFlight (delegates to `apps/mobile/Makefile`) |
| `make ota` | Publish an over-the-air update to the production channel |
| `make scan-secrets` | Scan tracked files for credentials |
| `make audit-secrets` | Scan the entire git history |
| `make clean` | Remove node_modules and build output |

## Backend (Supabase)

Migrations live in `supabase/migrations/`, edge functions in
`supabase/functions/`.

Provider connectors sit inside `helm-ingest`; an hourly cron syncs every enabled
integration. Different providers are fetched concurrently while integrations
sharing one provider run in sequence, so no external API ever sees two requests
at once - that keeps reporting quotas (AdMob in particular) safe.

The metric schema is deliberately generic:
`metrics: project_id, date, source, metric, value`. Adding a new metric means a
new `metric` string plus a connector that writes it - no migration.

## Deployment

- **Web** - `make build-web` produces a static `dist/`. Serve it behind your own
  Caddy/nginx and an auth wall; the RLS policy is permissive because Helm was
  built single-user first.
- **Mobile** - `make ios-release` runs the EAS build locally and submits to
  TestFlight, which avoids burning cloud build quota.

## Documentation

- [docs/README.md](./docs/README.md) - documentation index
- [docs/architecture/monorepo.md](./docs/architecture/monorepo.md) - package rules, import direction
- [docs/integrations/architecture.md](./docs/integrations/architecture.md) - sync orchestration, adapter interface
- [docs/migration/](./docs/migration/) - migration phases
- [MONOREPO-EXECUTION.md](./MONOREPO-EXECUTION.md) - phase 0 setup spec (applied)

Some documents are written in Turkish; the code, commit messages and
contributor-facing guides are in English.

## Contributing and security

- [CONTRIBUTING.md](./CONTRIBUTING.md) - workflow, commit format, PR expectations
- [SECURITY.md](./SECURITY.md) - how to report a vulnerability

## License

[GNU AGPL-3.0](./LICENSE). If you modify Helm and offer it to others over a
network, you must make your modified source available to those users. Get in
touch if you need terms that don't fit that requirement.

## Status

- **Phase 0 (monorepo skeleton)** ✅ - workspaces, `@helm/*` scaffold, types as a
  single source, green build.
- **Phase 1 (API extract)** ✅ - reads go through `@helm/api` (32 modules) and
  `@helm/queries`; both apps import from `@helm/*`. Three write paths still call
  `supabase.from` directly (CMS asset delete, CMS revision insert, push-device
  upsert). Background:
  [phase-1-api-extract.md](./docs/migration/phase-1-api-extract.md).
- **Next** - move those three writes into `@helm/api`, then tighten the RLS
  policies for multi-user use (see *Deployment*).
