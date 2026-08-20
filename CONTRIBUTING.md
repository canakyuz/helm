# Contributing

Helm is a one-person project, written first for its author's own needs. Contributions
are welcome, but I'm selective about scope - open an issue before starting anything
large so we can agree on it. A rejected PR wastes both our time.

## Setup

```bash
bun install
make hooks    # git hooks - don't skip this
cp apps/mobile/.env.example apps/mobile/.env
```

`make hooks` installs three gates ([lefthook.yml](./lefthook.yml)):

| Hook | What it does |
|------|--------------|
| `pre-commit` | Scans staged content for secrets |
| `commit-msg` | Validates the commit format (see below) |
| `pre-push` | Type-checks every workspace |

Helm connects to a Supabase project. To stand up your own, apply the migrations in
`supabase/migrations/` (`make db-push`), then deploy the edge functions
(`make fn-deploy`).

## Development

```bash
make dev-web       # Refine + Vite console
make dev-mobile    # Expo, clean cache
make typecheck     # every workspace
```

## Expectations

**Type safety.** TypeScript strict. No `any` - use `unknown` and narrow. If it's
truly unavoidable, leave a comment explaining why.

**Layer boundaries.** `app/` holds routes only; logic goes in `src/`. Components are
presentational, data fetching lives in hooks. Details:
[docs/architecture/monorepo.md](./docs/architecture/monorepo.md).

**Design system.** If you're touching UI, read
[apps/mobile/design.md](./apps/mobile/design.md) first. Don't invent token names or
widen the palette.

**No secrets.** Real credentials belong in `.env`. `.env.example` holds placeholders
only. The pre-commit hook enforces this - see [SECURITY.md](./SECURITY.md).

## Commit format

Conventional Commits plus an issue ID, on a single line:

```
type(scope): WES-XXX what changed
```

`type`: `feat` `fix` `refactor` `chore` `docs` `style` `perf` `test` `ci` `build`
`scope`: the area affected - `mobile`, `web`, `domain`, `ingest`, `root`

Use `WES-000` if you don't have an issue ID. For example:

```
fix(ingest): WES-000 stop dropping rows when the provider omits a currency
```

Write the message about **why**, not what - the diff already shows what.

This format is enforced by the `commit-msg` hook
([scripts/check-commit-msg.sh](./scripts/check-commit-msg.sh)): single line, valid
`type`, scope required, `WES-XXX` required, no `Co-Authored-By` trailer. If the hook
is wrong, fix the script rather than reaching for `--no-verify`.

## Pull requests

- One PR, one topic. Mixed PRs get reviewed slowly.
- `make typecheck` and `make scan-secrets` must be green - CI enforces both.
- Verify behavioural changes against real data and attach a screenshot.
- If something is left broken, say so in the description. A surprise found late is
  worse than one disclosed up front.

## License

Your contributions are published under [AGPL-3.0](./LICENSE).
