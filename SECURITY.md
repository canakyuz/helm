# Security

## Reporting a vulnerability

If you find a security issue, **don't open a public issue.** Use GitHub's
[Security Advisories](https://github.com/canakyuz/helm/security/advisories/new)
so we can discuss it privately.

I aim to respond within 72 hours. Helm is a one-person project — I'm not promising
an SLA, but I will take your report seriously.

A useful report names the affected component (web / mobile / edge function /
migration), gives steps to reproduce, and explains what an attacker actually gains.

## Scope

| Area | In scope |
|------|----------|
| Code under `apps/`, `packages/`, `supabase/` | ✅ |
| RLS policies that break tenant isolation | ✅ |
| Leaked credentials (repo, history, build output) | ✅ |
| Known CVEs in dependencies | ✅ if actually exploitable through Helm |
| Misconfiguration of your own Supabase deployment | ❌ |
| Raw scanner output with no demonstrated exploit | ❌ |

## Secret management

Real credentials live in `.env` files and are never committed. `.env.example`
contains placeholders only.

Three layers guard the repository:

```bash
make hooks           # pre-commit: scans staged content
make scan-secrets    # every tracked file — also runs in CI
make audit-secrets   # the entire git history, for audits
```

The scanner lives in [`scripts/check-secrets.sh`](./scripts/check-secrets.sh) and
filters out placeholders so it doesn't cry wolf. **Don't use `--no-verify`** — if the
hook produces a false positive, the fix is to tighten the pattern.
