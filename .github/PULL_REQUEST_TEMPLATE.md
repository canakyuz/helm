<!--
Title follows the commit format: type(scope): WES-XXX what changed
Example: fix(ingest): WES-000 stop dropping revenue rows when the provider omits currency
-->

## What changed

<!-- One paragraph. Don't restate the diff — say why it changed. -->

## Why

<!-- Which problem? What behaviour was wrong? Link the issue if there is one. -->

## How you verified it

<!--
Against real data. "It works" isn't enough — what did you run, what did you see?
For UI changes, attach before/after screenshots.
-->

## Left out of scope

<!-- Things you noticed but deliberately didn't fix here. Write "none" if there are none. -->

---

- [ ] `make typecheck` is green
- [ ] `make scan-secrets` is green — no real credentials added
- [ ] Behavioural changes verified against real data
- [ ] One topic — nothing unrelated mixed in
