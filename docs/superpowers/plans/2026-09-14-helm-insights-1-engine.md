# Helm öneri motoru - Faz 1: Motor - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Günlük çalışan, metriklerden sinyal çıkarıp Claude ile TR/EN öneri üreten ve `insights` tablosuna yazan motoru kurmak.

**Architecture:** Migration 0055 iki tablo, bir durum RPC'si ve kısıtlı bir yazar rolü ekler. `packages/insights` saf TS ile (medyan/MAD/robust z) sinyal üretir, proje başına tek Claude isteğiyle metni yazdırır, kod tarafında doğrular ve tek transaction'da upsert eder. GitHub Actions her gün 05:00 UTC'de çalıştırır.

**Tech Stack:** Bun 1.3 (`bun:test`, `SQL` from `"bun"`), TypeScript strict, `@anthropic-ai/sdk` 0.125.0, zod 4, Postgres (Supabase), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-14-helm-insights-design.md`

## Global Constraints

- Repo public: proje adı, hesap adı, id, proje ref'i, anahtar ve öneri metni repoya ve Actions loglarına girmez. Testler sentetik veri kullanır.
- Model `claude-opus-5`, `thinking: { type: "adaptive" }`, `output_config.effort: "medium"`, `fallbacks: "default"` + beta `server-side-fallback-2026-07-01`.
- Claude rakam yazmaz: `evidence` her zaman koddan kopyalanır.
- Sinyal yöntemi: pencere medyanı vs taban medyan/MAD robust z; tetik `|z| ≥ 3` VE mutlak eşik; veri şartı taban 28 günün ≥ 21'i, pencere 7 günün ≥ 5'i.
- Bugün (UTC) kısmi gün olduğu için pencere dün biter.
- Para birimleri arası toplam yok: gelir metrikleri tek tek değerlendirilir (spec'teki "toplam" bu nedenle metrik başına uygulanır).
- Aynı metrik birden fazla kaynaktan geliyorsa (ör. `dau`: posthog+supabase) toplanmaz; o proje-metrik için en çok günü olan kaynak seçilir.
- Proje + sekme başına ≤ 3 öneri; başlık ≤ 80, gövde ≤ 400 karakter; sorun kodda reddedilir.
- Aylık tavan: `cost_usd` toplamı ≥ 40 → `skipped_budget`.
- Log yalnız sayı: `projects= signals= insights= cost=`.
- Commit: tek satır `type(scope): WES-000 mesaj`, `--no-verify` yok, Co-Authored-By yok.
- Migration'ı `db push` ile uygulamak kullanıcı onayı ister.

## File Structure

| Dosya | Sorumluluk |
|---|---|
| `supabase/migrations/0055_insights.sql` | Tablolar, indeksler, RLS, `helm_insight_set_status`, `helm_insights_writer`, temizlik cron'u |
| `packages/insights/package.json`, `tsconfig.json` | Workspace paketi |
| `packages/insights/src/types.ts` | Paylaşılan tipler ve sabit listeler |
| `packages/insights/src/stats.ts` | `median`, `mad`, `robustZ`, `windowStats` (saf) |
| `packages/insights/src/series.ts` | Satırları proje/metrik günlük serisine çevirme, kaynak seçimi, oran serisi (saf) |
| `packages/insights/src/detectors.ts` | Sinyal kataloğu (saf) |
| `packages/insights/src/validate.ts` | Claude çıktı şeması, doğrulama, fingerprint (saf) |
| `packages/insights/src/prompt.ts` | Sistem/kullanıcı prompt'u, Claude çağrısı, maliyet |
| `packages/insights/src/db.ts` | Bun SQL okuma/yazma |
| `packages/insights/src/run.ts` | Orkestrasyon + `--dry-run` |
| `packages/insights/src/*.test.ts` | Kritik mantık testleri |
| `.github/workflows/insights.yml` | Günlük çalıştırma |
| `.github/workflows/ci.yml` | Paket testlerini CI'a ekleme |

---

### Task 1: Migration 0055

**Files:**
- Create: `supabase/migrations/0055_insights.sql`

**Interfaces:**
- Produces: tablolar `public.insight_runs`, `public.insights`; RPC `public.helm_insight_set_status(p_id uuid, p_status text, p_snooze_until timestamptz default null) returns void`; rol `helm_insights_writer`; fonksiyon `public.helm_prune_insights(keep_days int) returns integer`.

- [ ] **Step 1: Migration dosyasını yaz**

```sql
-- Helm oneri motoru (insights) - asama 1.
-- Spec: docs/superpowers/specs/2026-09-14-helm-insights-design.md
--
-- NEDEN alert_events DEGIL: o tablo esik kurali + onay semantigi tasiyor.
-- Onerinin kanit/aksiyon/erteleme yasam dongusu farkli.

create table if not exists public.insight_runs (
  id             uuid primary key default gen_random_uuid(),
  run_date       date not null unique,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  status         text not null default 'running'
                 check (status in ('running', 'ok', 'failed', 'skipped_budget')),
  model          text not null,
  input_tokens   integer not null default 0,
  output_tokens  integer not null default 0,
  cost_usd       numeric(10, 4) not null default 0,
  signal_count   integer not null default 0,
  insight_count  integer not null default 0,
  -- Yalniz hata kodu/sinifi. Icerik ya da mesaj metni yazilmaz (repo public, loglar acik).
  error          text
);

create table if not exists public.insights (
  id                 uuid primary key default gen_random_uuid(),
  run_id             uuid not null references public.insight_runs(id),
  project_id         uuid references public.projects(id) on delete cascade,
  tab                text not null check (tab in ('overview', 'revenue', 'users', 'social')),
  kind               text not null check (kind in ('risk', 'opportunity', 'anomaly', 'data_gap')),
  severity           text not null check (severity in ('critical', 'warn', 'info')),
  text               jsonb not null,
  evidence           jsonb not null default '[]'::jsonb,
  action             jsonb,
  status             text not null default 'new'
                     check (status in ('new', 'seen', 'done', 'dismissed', 'snoozed')),
  snoozed_until      timestamptz,
  fingerprint        text not null,
  last_triggered_on  date not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  resolved_at        timestamptz
);

-- Ayni sorun her gun yeni kart acmaz: acik kayitlarda fingerprint tekil.
create unique index if not exists insights_open_fingerprint_uq
  on public.insights (fingerprint)
  where status in ('new', 'seen', 'snoozed');

-- Sekme karti sorgusu: O(log n + k).
create index if not exists insights_tab_open_idx
  on public.insights (tab, status, severity)
  where status in ('new', 'seen');

alter table public.insight_runs enable row level security;
alter table public.insights enable row level security;

create policy "owner read insight_runs" on public.insight_runs
  for select to authenticated using (public.helm_is_owner());

create policy "owner read insights" on public.insights
  for select to authenticated using (public.helm_is_owner());

-- Telefon icin tek yazma yolu: yalniz durum. Baslik/kanit degistirilemez.
create or replace function public.helm_insight_set_status(
  p_id uuid,
  p_status text,
  p_snooze_until timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.helm_is_owner() then
    raise exception 'helm: bu islem yalnizca calisma alani sahibine acik' using errcode = '42501';
  end if;
  if p_status not in ('seen', 'done', 'dismissed', 'snoozed') then
    raise exception 'helm: gecersiz oneri durumu' using errcode = '22023';
  end if;
  if p_status = 'snoozed' and (p_snooze_until is null or p_snooze_until <= now()) then
    raise exception 'helm: erteleme zamani gecersiz' using errcode = '22023';
  end if;

  update public.insights
  set status        = p_status,
      snoozed_until = case when p_status = 'snoozed' then p_snooze_until else null end,
      resolved_at   = case when p_status in ('done', 'dismissed') then now() else resolved_at end,
      updated_at    = now()
  where id = p_id
    -- 'seen' yalniz 'new'den gecer; ertelenmis ya da kapanmis kayit geri acilmaz.
    and not (p_status = 'seen' and status <> 'new');
end;
$$;

revoke all on function public.helm_insight_set_status(uuid, text, timestamptz) from public, anon;
grant execute on function public.helm_insight_set_status(uuid, text, timestamptz) to authenticated;

-- Gunluk is rolu. SIFRE BURADA YOK (repo public): kullanici bir kez
--   alter role helm_insights_writer password '...';
-- calistirir ve baglanti dizesini HELM_INSIGHTS_DB_URL secret'i olarak ekler.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'helm_insights_writer') then
    create role helm_insights_writer login noinherit;
  end if;
end;
$$;

grant usage on schema public to helm_insights_writer;
grant select on public.metrics, public.app_versions, public.projects to helm_insights_writer;
grant select, insert, update on public.insight_runs, public.insights to helm_insights_writer;

-- RLS acik tablolarda rol ancak kendi politikasiyla okur/yazar.
create policy "insights writer read metrics" on public.metrics
  for select to helm_insights_writer using (true);
create policy "insights writer read app_versions" on public.app_versions
  for select to helm_insights_writer using (true);
create policy "insights writer read projects" on public.projects
  for select to helm_insights_writer using (true);
create policy "insights writer all insight_runs" on public.insight_runs
  for all to helm_insights_writer using (true) with check (true);
create policy "insights writer all insights" on public.insights
  for all to helm_insights_writer using (true) with check (true);

-- Temizlik: 90 gunden eski kapanmis kayitlar (0042_sync_runs_retention kalibi).
create or replace function public.helm_prune_insights(keep_days int default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.insights
  where status in ('done', 'dismissed')
    and resolved_at < now() - make_interval(days => keep_days);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.helm_prune_insights(int) from public, anon, authenticated;

select cron.schedule(
  'helm-prune-insights',
  '30 3 * * *',
  $job$ select public.helm_prune_insights(90); $job$
);
```

- [ ] **Step 2: Migration isim/numara kapısını yerelde çalıştır**

Run:
```bash
cd supabase/migrations && printf '%s\n' *.sql | cut -d_ -f1 | sort | uniq -d
```
Expected: boş çıktı (çakışma yok).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0055_insights.sql
git commit -m "feat(db): WES-000 oneri motoru icin insights tablolari, durum rpc'si ve yazar rolu ekle"
```

- [ ] **Step 4: KULLANICI ONAYI - uygulama**

Kullanıcıya sor: "0055'i `supabase db push` ile uygulayayım mı?" Onay gelmeden devam etme. Onay sonrası:
```bash
supabase db push --db-url "$HELM_DB_URL"
```
Doğrulama (salt okuma):
```bash
bun -e "import {SQL} from 'bun'; const s=new SQL(process.env.HELM_DB_URL); console.log(await s\`select to_regclass('public.insights') as t, (select count(*) from pg_roles where rolname='helm_insights_writer')::int as role\`); await s.close()"
```
Expected: `t: "insights"`, `role: 1`.

---

### Task 2: Paket iskeleti ve istatistik fonksiyonları

**Files:**
- Create: `packages/insights/package.json`
- Create: `packages/insights/tsconfig.json`
- Create: `packages/insights/src/types.ts`
- Create: `packages/insights/src/stats.ts`
- Test: `packages/insights/src/stats.test.ts`
- Modify: `.github/workflows/ci.yml` (Tests (packages) adımı)

**Interfaces:**
- Produces:
  - `median(values: readonly number[]): number`
  - `mad(values: readonly number[], med: number): number`
  - `robustZ(value: number, med: number, madValue: number): number | null`
  - `windowStats(series: ReadonlyMap<string, number>, spec: WindowSpec, today: string): WindowResult | null`
  - Tipler: `Tab`, `InsightKind`, `Severity`, `MetricRow`, `VersionRow`, `Signal`, `WindowSpec`, `WindowResult`, sabitler `TABS`, `KINDS`, `SEVERITIES`, `MODEL`

- [ ] **Step 1: Paket dosyaları**

`packages/insights/package.json`:
```json
{
  "name": "@helm/insights",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/run.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "bun test",
    "start": "bun run src/run.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "0.125.0",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@types/bun": "^1.3.14"
  }
}
```

`packages/insights/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true, "types": ["bun"] },
  "include": ["src"]
}
```

`packages/insights/src/types.ts`:
```ts
export const TABS = ["overview", "revenue", "users", "social"] as const;
export const KINDS = ["risk", "opportunity", "anomaly", "data_gap"] as const;
export const SEVERITIES = ["critical", "warn", "info"] as const;
export const MODEL = "claude-opus-5";

export type Tab = (typeof TABS)[number];
export type InsightKind = (typeof KINDS)[number];
export type Severity = (typeof SEVERITIES)[number];

/** metrics tablosundan tek satir. date = YYYY-MM-DD. */
export interface MetricRow {
  project_id: string;
  date: string;
  metric: string;
  source: string;
  value: number;
}

export interface VersionRow {
  project_id: string;
  version: string;
  /** YYYY-MM-DD */
  release_date: string;
}

export interface WindowSpec {
  /** Pencere gun sayisi (dun dahil geriye). */
  curDays: number;
  /** Pencereden hemen onceki taban gun sayisi. */
  baseDays: number;
  minCur: number;
  minBase: number;
}

export interface WindowResult {
  curMedian: number;
  baseMedian: number;
  baseMad: number;
  z: number | null;
  deltaPct: number | null;
  /** Pencerenin ilk ve son gunu - kanit metni ve surum eslestirmesi icin. */
  curStart: string;
  curEnd: string;
}

/** Koddan cikan, kanit tasiyan tek bulgu. Claude bunlari yalniz id ile referanslar. */
export interface Signal {
  id: string;
  /** Proje icinde kararli anahtar: detector:metric:yon. Fingerprint buradan. */
  key: string;
  project_id: string;
  tab: Tab;
  kind: InsightKind;
  severity: Severity;
  metric: string;
  window: string;
  value: number;
  baseline: number;
  delta_pct: number | null;
  z: number | null;
  /** Ornek: "after_release". Metin degil, makine etiketi. */
  note: string | null;
}
```

`packages/insights/tsconfig.json` `types: ["bun"]` için `bun install` gerekir:
```bash
bun install
```

- [ ] **Step 2: Başarısız testi yaz**

`packages/insights/src/stats.test.ts`:
```ts
import { describe, expect, it } from "bun:test";
import { mad, median, robustZ, windowStats } from "./stats";

// Sentetik seriler - gercek metrik yok (repo public).
const day = (offset: number, today = "2026-03-01") =>
  new Date(Date.parse(`${today}T00:00:00Z`) - offset * 86_400_000).toISOString().slice(0, 10);

function series(values: Array<[offset: number, value: number]>): Map<string, number> {
  return new Map(values.map(([o, v]) => [day(o), v]));
}

const SPEC = { curDays: 7, baseDays: 28, minCur: 5, minBase: 21 };

describe("median / mad", () => {
  it("tek ve cift uzunlukta dogru medyan", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("girdiyi degistirmez", () => {
    const xs = [3, 1, 2];
    median(xs);
    expect(xs).toEqual([3, 1, 2]);
  });

  it("mad medyana mutlak sapmalarin medyani", () => {
    expect(mad([1, 2, 3, 4, 100], 3)).toBe(1);
  });
});

describe("robustZ", () => {
  it("0.6745 olcekli z", () => {
    expect(robustZ(14, 10, 2)).toBeCloseTo(1.349, 3);
  });

  it("mad sifirsa null (bolme yok)", () => {
    expect(robustZ(5, 5, 0)).toBeNull();
  });
});

describe("windowStats", () => {
  it("bugunu disarida birakir, pencere dunden baslar", () => {
    const s = series([
      [0, 9999], // bugun - kismi gun, sayilmamali
      ...Array.from({ length: 7 }, (_, i) => [i + 1, 50] as [number, number]),
      ...Array.from({ length: 28 }, (_, i) => [i + 8, 100 + (i % 3)] as [number, number]),
    ]);
    const r = windowStats(s, SPEC, day(0));
    expect(r).not.toBeNull();
    expect(r!.curMedian).toBe(50);
    expect(r!.baseMedian).toBe(101);
    expect(r!.curEnd).toBe(day(1));
    expect(r!.curStart).toBe(day(7));
    expect(r!.deltaPct).toBeCloseTo(-50.5, 1);
    expect(r!.z!).toBeLessThan(-3);
  });

  it("pencerede 5'ten az gun varsa null", () => {
    const s = series([
      ...Array.from({ length: 4 }, (_, i) => [i + 1, 50] as [number, number]),
      ...Array.from({ length: 28 }, (_, i) => [i + 8, 100] as [number, number]),
    ]);
    expect(windowStats(s, SPEC, day(0))).toBeNull();
  });

  it("tabanda 21'den az gun varsa null", () => {
    const s = series([
      ...Array.from({ length: 7 }, (_, i) => [i + 1, 50] as [number, number]),
      ...Array.from({ length: 20 }, (_, i) => [i + 8, 100] as [number, number]),
    ]);
    expect(windowStats(s, SPEC, day(0))).toBeNull();
  });

  it("taban medyani 0 ise deltaPct null", () => {
    const s = series([
      ...Array.from({ length: 7 }, (_, i) => [i + 1, 5] as [number, number]),
      ...Array.from({ length: 28 }, (_, i) => [i + 8, 0] as [number, number]),
    ]);
    expect(windowStats(s, SPEC, day(0))!.deltaPct).toBeNull();
  });
});
```

- [ ] **Step 3: Testin başarısız olduğunu gör**

Run: `cd packages/insights && bun test src/stats.test.ts`
Expected: FAIL, `Cannot find module './stats'`

- [ ] **Step 4: Uygulamayı yaz**

`packages/insights/src/stats.ts`:
```ts
import type { WindowResult, WindowSpec } from "./types";

const DAY_MS = 86_400_000;
/** Normal dagilimda MAD'i standart sapmaya ceviren sabit. */
const MAD_SCALE = 0.6745;

/** Time: O(n log n) (kopya siralama); Space: O(n). Girdi degismez. */
export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Median absolute deviation. Time: O(n log n); Space: O(n). */
export function mad(values: readonly number[], med: number): number {
  return median(values.map((v) => Math.abs(v - med)));
}

/** MAD 0 ise z tanimsiz: sabit tabanda her sapma "sonsuz" olurdu. */
export function robustZ(value: number, med: number, madValue: number): number | null {
  if (madValue === 0) return null;
  return (MAD_SCALE * (value - med)) / madValue;
}

function isoDaysBefore(today: string, n: number): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) - n * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Pencere (dun..dun-curDays+1) ile hemen onceki taban karsilastirmasi.
 * BUGUN DAHIL DEGIL: saatlik ingest yuzunden bugunun degeri kismi, sahte dusus uretir.
 * Time: O((curDays + baseDays) + k log k); Space: O(curDays + baseDays).
 */
export function windowStats(
  series: ReadonlyMap<string, number>,
  spec: WindowSpec,
  today: string,
): WindowResult | null {
  const cur: number[] = [];
  const base: number[] = [];
  for (let i = 1; i <= spec.curDays; i += 1) {
    const v = series.get(isoDaysBefore(today, i));
    if (v != null) cur.push(v);
  }
  for (let i = spec.curDays + 1; i <= spec.curDays + spec.baseDays; i += 1) {
    const v = series.get(isoDaysBefore(today, i));
    if (v != null) base.push(v);
  }
  if (cur.length < spec.minCur || base.length < spec.minBase) return null;

  const curMedian = median(cur);
  const baseMedian = median(base);
  const baseMad = mad(base, baseMedian);
  return {
    curMedian,
    baseMedian,
    baseMad,
    z: robustZ(curMedian, baseMedian, baseMad),
    deltaPct: baseMedian === 0 ? null : ((curMedian - baseMedian) / Math.abs(baseMedian)) * 100,
    curStart: isoDaysBefore(today, spec.curDays),
    curEnd: isoDaysBefore(today, 1),
  };
}
```

- [ ] **Step 5: Testlerin geçtiğini gör**

Run: `cd packages/insights && bun test src/stats.test.ts`
Expected: PASS, 9 test

- [ ] **Step 6: CI'a paket testlerini ekle**

`.github/workflows/ci.yml` içinde mevcut adımın hemen altına:
```yaml
      - name: Tests (insights)
        run: cd packages/insights && bun test
```
Mevcut `Tests (packages)` adımı: `run: cd packages/api && bun test`. Yeni adım onun altına, aynı girintiyle.

- [ ] **Step 7: Typecheck + commit**

Run: `cd packages/insights && bun run typecheck`
Expected: çıkış kodu 0

```bash
git add packages/insights .github/workflows/ci.yml bun.lock
git commit -m "feat(insights): WES-000 paket iskeleti ve robust z istatistik fonksiyonlarini ekle"
```

---

### Task 3: Seri hazırlama ve sinyal kataloğu

**Files:**
- Create: `packages/insights/src/series.ts`
- Create: `packages/insights/src/detectors.ts`
- Test: `packages/insights/src/detectors.test.ts`

**Interfaces:**
- Consumes: `windowStats`, tipler (Task 2)
- Produces:
  - `buildSeriesIndex(rows: readonly MetricRow[]): SeriesIndex` - `SeriesIndex = Map<string /*project*/, Map<string /*metric*/, Map<string /*date*/, number>>>`
  - `ratioSeries(num: ReadonlyMap<string, number> | undefined, den: ReadonlyMap<string, number> | undefined): Map<string, number>`
  - `detectSignals(rows: readonly MetricRow[], versions: readonly VersionRow[], today: string): Signal[]`
  - `CATALOG_METRICS: readonly string[]` (DB sorgusunun metrik filtresi)

- [ ] **Step 1: Başarısız testi yaz**

`packages/insights/src/detectors.test.ts`:
```ts
import { describe, expect, it } from "bun:test";
import { detectSignals } from "./detectors";
import { buildSeriesIndex } from "./series";
import type { MetricRow } from "./types";

const TODAY = "2026-03-01";
const day = (offset: number) =>
  new Date(Date.parse(`${TODAY}T00:00:00Z`) - offset * 86_400_000).toISOString().slice(0, 10);

/** 35 gunluk sentetik seri: taban (8..35) ve pencere (1..7) degerleriyle. */
function rows(
  metric: string,
  base: (i: number) => number,
  cur: (i: number) => number,
  opts: { project?: string; source?: string } = {},
): MetricRow[] {
  const out: MetricRow[] = [];
  for (let o = 1; o <= 35; o += 1) {
    out.push({
      project_id: opts.project ?? "p1",
      date: day(o),
      metric,
      source: opts.source ?? "s1",
      value: o <= 7 ? cur(o) : base(o),
    });
  }
  return out;
}

const noisy = (center: number) => (i: number) => center + ((i * 7) % 5) - 2;

describe("buildSeriesIndex", () => {
  it("coklu kaynakta toplamaz, en cok gunu olan kaynagi secer", () => {
    const a = rows("dau", () => 100, () => 100, { source: "posthog" });
    const b = rows("dau", () => 900, () => 900, { source: "supabase" }).slice(0, 10);
    const idx = buildSeriesIndex([...a, ...b]);
    expect(idx.get("p1")!.get("dau")!.get(day(1))).toBe(100);
  });
});

describe("detectSignals", () => {
  it("gelir dususunu risk olarak overview'a yazar", () => {
    const signals = detectSignals(rows("ad_revenue", noisy(100), () => 40), [], TODAY);
    const s = signals.find((x) => x.metric === "ad_revenue");
    expect(s).toBeDefined();
    expect(s!.tab).toBe("overview");
    expect(s!.kind).toBe("risk");
    expect(s!.key).toBe("revenue_shift:ad_revenue:down");
    expect(s!.value).toBe(40);
  });

  it("kucuk mutlak degisimi (esik alti) tetiklemez", () => {
    // Taban gurultulu: MAD > 0 olsun ki z hesaplansin ve testi MUTLAK esik reddetsin
    // (sabit tabanda z null olur ve test yanlis sebeple gecerdi).
    const signals = detectSignals(rows("ad_revenue", (i) => 0.5 + ((i % 5) - 2) * 0.01, () => 0.2), [], TODAY);
    expect(signals.filter((x) => x.metric === "ad_revenue")).toHaveLength(0);
  });

  it("hata artisini son 7 gunde surum varsa after_release ile isaretler", () => {
    const signals = detectSignals(
      rows("errors", noisy(20), () => 120),
      [{ project_id: "p1", version: "9.9.9", release_date: day(3) }],
      TODAY,
    );
    const s = signals.find((x) => x.key === "error_spike:errors:up");
    expect(s?.note).toBe("after_release");
    expect(s?.severity).toBe("critical");
  });

  it("hata DUSUSUNU sinyal saymaz", () => {
    const signals = detectSignals(rows("errors", noisy(100), () => 10), [], TODAY);
    expect(signals.filter((x) => x.metric === "errors")).toHaveLength(0);
  });

  it("eCPM duserken gosterim de dustuyse ecpm_shift uretmez", () => {
    const signals = detectSignals(
      [
        ...rows("ad_ecpm", noisy(10), () => 5),
        ...rows("ad_impressions", noisy(1000), () => 400),
      ],
      [],
      TODAY,
    );
    expect(signals.filter((x) => x.key.startsWith("ecpm_shift"))).toHaveLength(0);
  });

  it("dolum orani dususunu revenue sekmesine yazar", () => {
    const signals = detectSignals(
      [
        ...rows("ad_requests", () => 1000, () => 1000),
        ...rows("ad_matched_requests", (i) => 900 + (i % 5), () => 500),
      ],
      [],
      TODAY,
    );
    const s = signals.find((x) => x.key === "fill_rate_drop:fill_rate:down");
    expect(s?.tab).toBe("revenue");
  });

  it("sosyal verisi 14 gunden azsa data_gap bilgisi uretir", () => {
    const social: MetricRow[] = [1, 2, 3, 4].map((o) => ({
      project_id: "p1",
      date: day(o),
      metric: "social_impressions",
      source: "zernio",
      value: 10,
    }));
    const signals = detectSignals(social, [], TODAY);
    const s = signals.find((x) => x.tab === "social");
    expect(s?.kind).toBe("data_gap");
    expect(s?.severity).toBe("info");
  });

  it("veri sarti saglanmayan projede hic sinyal yok", () => {
    const short = rows("dau", noisy(100), () => 10).slice(0, 10);
    expect(detectSignals(short, [], TODAY)).toHaveLength(0);
  });

  it("sinyal id'leri run icinde tekil", () => {
    const signals = detectSignals(
      [...rows("ad_revenue", noisy(100), () => 40), ...rows("dau", noisy(500), () => 100)],
      [],
      TODAY,
    );
    expect(new Set(signals.map((s) => s.id)).size).toBe(signals.length);
  });
});
```

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `cd packages/insights && bun test src/detectors.test.ts`
Expected: FAIL, `Cannot find module './detectors'`

- [ ] **Step 3: `series.ts`**

```ts
import type { MetricRow } from "./types";

export type DailySeries = Map<string, number>;
export type SeriesIndex = Map<string, Map<string, DailySeries>>;

/**
 * project -> metric -> date -> value.
 * Ayni metrik iki kaynaktan geliyorsa TOPLANMAZ (dau: posthog+supabase cift sayardi);
 * en cok gunu olan kaynak secilir.
 * Time: O(n); Space: O(n).
 */
export function buildSeriesIndex(rows: readonly MetricRow[]): SeriesIndex {
  const bySource = new Map<string, Map<string, DailySeries>>();
  for (const r of rows) {
    const key = `${r.project_id}|${r.metric}`;
    let sources = bySource.get(key);
    if (!sources) bySource.set(key, (sources = new Map()));
    let s = sources.get(r.source);
    if (!s) sources.set(r.source, (s = new Map()));
    s.set(r.date, (s.get(r.date) ?? 0) + r.value);
  }

  const index: SeriesIndex = new Map();
  for (const [key, sources] of bySource) {
    const [project, metric] = key.split("|") as [string, string];
    let best: DailySeries | undefined;
    for (const s of sources.values()) if (!best || s.size > best.size) best = s;
    let metrics = index.get(project);
    if (!metrics) index.set(project, (metrics = new Map()));
    metrics.set(metric, best!);
  }
  return index;
}

/** Yalniz iki seride de olan ve payda > 0 gunler. Time: O(d). */
export function ratioSeries(
  num: ReadonlyMap<string, number> | undefined,
  den: ReadonlyMap<string, number> | undefined,
): DailySeries {
  const out: DailySeries = new Map();
  if (!num || !den) return out;
  for (const [date, n] of num) {
    const d = den.get(date);
    if (d != null && d > 0) out.set(date, n / d);
  }
  return out;
}
```

- [ ] **Step 4: `detectors.ts`**

```ts
import { windowStats } from "./stats";
import { buildSeriesIndex, ratioSeries, type DailySeries } from "./series";
import type { InsightKind, MetricRow, Severity, Signal, Tab, VersionRow, WindowResult, WindowSpec } from "./types";

const WEEK: WindowSpec = { curDays: 7, baseDays: 28, minCur: 5, minBase: 21 };
const FORTNIGHT: WindowSpec = { curDays: 14, baseDays: 28, minCur: 10, minBase: 21 };
const Z_TRIGGER = 3;
const Z_CRITICAL = 4;
const SOCIAL_WARMUP_DAYS = 14;

type Direction = "up" | "down" | "both";

interface Rule {
  detector: string;
  metric: string;
  tab: Tab;
  /** Hangi yon sinyal sayilir. */
  direction: Direction;
  /** |delta| mutlak alt sinir (metrigin kendi biriminde). */
  minAbs: number;
  /** |deltaPct| alt sinir; null = yuzde sarti yok (orn. yuzde puanli metrikler). */
  minPct: number | null;
  spec?: WindowSpec;
  /** Dusus iyi mi (errors artisi kotu, crash_free dususu kotu). */
  riskWhen: "up" | "down" | "never";
}

const REVENUE = ["ad_revenue", "app_revenue", "iap_revenue", "subscription_revenue"] as const;

const RULES: readonly Rule[] = [
  ...REVENUE.map<Rule>((metric) => ({
    detector: "revenue_shift", metric, tab: "overview", direction: "both",
    minAbs: 1, minPct: 20, riskWhen: "down",
  })),
  { detector: "error_spike", metric: "errors", tab: "overview", direction: "up", minAbs: 5, minPct: 50, riskWhen: "up" },
  { detector: "error_spike", metric: "crash_free_sessions", tab: "overview", direction: "down", minAbs: 0.5, minPct: null, riskWhen: "down" },
  { detector: "subs_momentum", metric: "mrr", tab: "revenue", direction: "both", minAbs: 1, minPct: 10, riskWhen: "down" },
  { detector: "dau_shift", metric: "dau", tab: "users", direction: "both", minAbs: 5, minPct: 20, riskWhen: "down" },
  { detector: "dau_shift", metric: "new_users", tab: "users", direction: "both", minAbs: 3, minPct: 25, riskWhen: "down" },
  { detector: "funnel_shift", metric: "pct_paused", tab: "users", direction: "up", minAbs: 3, minPct: null, riskWhen: "up" },
  { detector: "funnel_shift", metric: "pct_level1", tab: "users", direction: "both", minAbs: 3, minPct: null, riskWhen: "never" },
];

function passes(r: WindowResult, minAbs: number, minPct: number | null, direction: Direction): boolean {
  if (r.z == null || Math.abs(r.z) < Z_TRIGGER) return false;
  const diff = r.curMedian - r.baseMedian;
  if (direction === "up" && diff <= 0) return false;
  if (direction === "down" && diff >= 0) return false;
  if (Math.abs(diff) < minAbs) return false;
  if (minPct != null && (r.deltaPct == null || Math.abs(r.deltaPct) < minPct)) return false;
  return true;
}

function classify(diff: number, z: number | null, riskWhen: Rule["riskWhen"]): { kind: InsightKind; severity: Severity } {
  const dir = diff < 0 ? "down" : "up";
  if (riskWhen === "never") return { kind: "anomaly", severity: "info" };
  if (dir === riskWhen) {
    return { kind: "risk", severity: z != null && Math.abs(z) >= Z_CRITICAL ? "critical" : "warn" };
  }
  return { kind: "opportunity", severity: "info" };
}

/**
 * Tum katalog. Time: O(n) seri kurulumu + O(P · R · (w + k log k)), w=35 gun.
 * Space: O(n). Proje x kural basina tek gecis; ic ice veri taramasi yok.
 */
export function detectSignals(
  rows: readonly MetricRow[],
  versions: readonly VersionRow[],
  today: string,
): Signal[] {
  const index = buildSeriesIndex(rows);
  const releasesByProject = new Map<string, string[]>();
  for (const v of versions) {
    const list = releasesByProject.get(v.project_id) ?? [];
    list.push(v.release_date);
    releasesByProject.set(v.project_id, list);
  }

  const out: Signal[] = [];
  const push = (s: Omit<Signal, "id">) => out.push({ ...s, id: `s${out.length + 1}` });

  for (const [project, metrics] of index) {
    const emit = (
      detector: string,
      metric: string,
      tab: Tab,
      series: DailySeries | undefined,
      rule: Pick<Rule, "direction" | "minAbs" | "minPct" | "riskWhen" | "spec">,
    ) => {
      if (!series) return null;
      const spec = rule.spec ?? WEEK;
      const r = windowStats(series, spec, today);
      if (!r || !passes(r, rule.minAbs, rule.minPct, rule.direction)) return null;
      const diff = r.curMedian - r.baseMedian;
      const { kind, severity } = classify(diff, r.z, rule.riskWhen);
      const releases = releasesByProject.get(project) ?? [];
      const afterRelease = detector === "error_spike" && releases.some((d) => d >= r.curStart && d <= r.curEnd);
      push({
        key: `${detector}:${metric}:${diff < 0 ? "down" : "up"}`,
        project_id: project,
        tab,
        kind,
        severity,
        metric,
        window: `${spec.curDays}d/${spec.baseDays}d`,
        value: r.curMedian,
        baseline: r.baseMedian,
        delta_pct: r.deltaPct,
        z: r.z,
        note: afterRelease ? "after_release" : null,
      });
      return r;
    };

    for (const rule of RULES) emit(rule.detector, rule.metric, rule.tab, metrics.get(rule.metric), rule);

    // eCPM dustu ama gosterim sabit (±%15) -> sorun fiyatta, trafikte degil.
    const ecpm = metrics.get("ad_ecpm");
    const impressions = metrics.get("ad_impressions");
    const imp = impressions ? windowStats(impressions, WEEK, today) : null;
    if (imp && imp.deltaPct != null && Math.abs(imp.deltaPct) <= 15) {
      emit("ecpm_shift", "ad_ecpm", "revenue", ecpm, { direction: "down", minAbs: 0.1, minPct: 15, riskWhen: "down" });
    }

    emit("fill_rate_drop", "fill_rate", "revenue",
      ratioSeries(metrics.get("ad_matched_requests"), metrics.get("ad_requests")),
      { direction: "down", minAbs: 0.05, minPct: 10, riskWhen: "down" });

    emit("stickiness_trend", "stickiness", "users",
      ratioSeries(metrics.get("dau"), metrics.get("mau")),
      { direction: "down", minAbs: 0.01, minPct: 10, riskWhen: "down", spec: FORTNIGHT });

    // Deneme artiyor ama aktif abonelik artmiyor -> donusum sorunu.
    const trials = metrics.get("subs_trial");
    const subs = metrics.get("active_subs");
    const trialR = trials ? windowStats(trials, WEEK, today) : null;
    const subsR = subs ? windowStats(subs, WEEK, today) : null;
    if (trialR && subsR && passes(trialR, 1, 20, "up") && (subsR.deltaPct ?? 0) <= 2) {
      push({
        key: "subs_momentum:subs_trial:up",
        project_id: project, tab: "revenue", kind: "risk", severity: "warn",
        metric: "subs_trial", window: "7d/28d",
        value: trialR.curMedian, baseline: trialR.baseMedian,
        delta_pct: trialR.deltaPct, z: trialR.z, note: "subs_flat",
      });
    }

    // Sosyal: 14 gun dolana kadar yalniz bilgi.
    let socialDays = 0;
    for (const [metric, s] of metrics) if (metric.startsWith("social_")) socialDays = Math.max(socialDays, s.size);
    if (socialDays > 0 && socialDays < SOCIAL_WARMUP_DAYS) {
      push({
        key: "social_warmup:social:days",
        project_id: project, tab: "social", kind: "data_gap", severity: "info",
        metric: "social_days", window: `${SOCIAL_WARMUP_DAYS}d`,
        value: socialDays, baseline: SOCIAL_WARMUP_DAYS, delta_pct: null, z: null, note: null,
      });
    }
  }
  return out;
}

/** DB sorgusunun metrik filtresi - katalog disi satir cekilmez. */
export const CATALOG_METRICS: readonly string[] = [
  ...new Set([
    ...RULES.map((r) => r.metric),
    "ad_ecpm", "ad_impressions", "ad_matched_requests", "ad_requests",
    "mau", "subs_trial", "active_subs",
    "social_followers", "social_impressions", "social_reach", "social_engagements", "social_posts_published",
  ]),
];
```

- [ ] **Step 5: Testlerin geçtiğini gör**

Run: `cd packages/insights && bun test`
Expected: PASS (stats 8 + detectors 10). Bir eşik testi düşerse eşiği değil sentetik veriyi değil **kuralı** kontrol et: test beklentileri spec'teki davranışı anlatıyor.

- [ ] **Step 6: Typecheck + commit**

Run: `cd packages/insights && bun run typecheck`

```bash
git add packages/insights/src/series.ts packages/insights/src/detectors.ts packages/insights/src/detectors.test.ts
git commit -m "feat(insights): WES-000 metrik serilerinden sinyal katalogunu cikar"
```

---

### Task 4: Claude çıktı şeması, doğrulama ve fingerprint

**Files:**
- Create: `packages/insights/src/validate.ts`
- Test: `packages/insights/src/validate.test.ts`

**Interfaces:**
- Consumes: `Signal`, `TABS`, `KINDS`, `SEVERITIES` (Task 2)
- Produces:
  - `ClaudeOutputSchema` (zod) ve `type ClaudeOutput`
  - `interface InsightRecord { project_id: string; tab: Tab; kind: InsightKind; severity: Severity; text: InsightTexts; evidence: Evidence[]; action: InsightAction | null; fingerprint: string }`
  - `validateInsights(output: ClaudeOutput, signals: readonly Signal[]): InsightRecord[]`
  - `fingerprint(projectId: string, signalKeys: readonly string[]): string`
  - `TITLE_MAX = 80`, `BODY_MAX = 400`, `PER_TAB_MAX = 3`

- [ ] **Step 1: Başarısız testi yaz**

`packages/insights/src/validate.test.ts`:
```ts
import { describe, expect, it } from "bun:test";
import { fingerprint, validateInsights, type ClaudeOutput } from "./validate";
import type { Signal } from "./types";

const sig = (id: string, extra: Partial<Signal> = {}): Signal => ({
  id,
  key: `dau_shift:dau:down`,
  project_id: "p1",
  tab: "users",
  kind: "risk",
  severity: "warn",
  metric: "dau",
  window: "7d/28d",
  value: 40,
  baseline: 100,
  delta_pct: -60,
  z: -5,
  note: null,
  ...extra,
});

const text = (title = "Baslik", body = "Govde") => ({ tr: { title, body }, en: { title, body } });

const item = (over: Partial<ClaudeOutput["insights"][number]> = {}): ClaudeOutput["insights"][number] => ({
  signal_ids: ["s1"],
  tab: "users",
  kind: "risk",
  severity: "warn",
  text: text(),
  action: null,
  ...over,
});

describe("validateInsights", () => {
  it("kaniti sinyalden kopyalar, Claude rakam getiremez", () => {
    const [r] = validateInsights({ insights: [item()] }, [sig("s1")]);
    expect(r!.evidence).toEqual([
      { signal_id: "s1", metric: "dau", window: "7d/28d", value: 40, baseline: 100, delta_pct: -60 },
    ]);
  });

  it("bilinmeyen sinyal id'si olan oneriyi reddeder", () => {
    expect(validateInsights({ insights: [item({ signal_ids: ["s9"] })] }, [sig("s1")])).toHaveLength(0);
  });

  it("farkli projelerin sinyallerini birlestiren oneriyi reddeder", () => {
    const signals = [sig("s1"), sig("s2", { project_id: "p2", key: "x:y:up" })];
    expect(validateInsights({ insights: [item({ signal_ids: ["s1", "s2"] })] }, signals)).toHaveLength(0);
  });

  it("sekme, sinyallerin sekmelerinden biri olmali", () => {
    expect(validateInsights({ insights: [item({ tab: "revenue" })] }, [sig("s1")])).toHaveLength(0);
  });

  it("uzun baslik ya da govdeyi reddeder", () => {
    const long = item({ text: text("x".repeat(81)) });
    expect(validateInsights({ insights: [long] }, [sig("s1")])).toHaveLength(0);
  });

  it("proje + sekme basina en fazla 3 oneri, sirayi korur", () => {
    const signals = [1, 2, 3, 4].map((n) => sig(`s${n}`, { key: `k${n}:m:up` }));
    const out = validateInsights(
      { insights: [1, 2, 3, 4].map((n) => item({ signal_ids: [`s${n}`], text: text(`T${n}`) })) },
      signals,
    );
    expect(out.map((r) => r.text.tr.title)).toEqual(["T1", "T2", "T3"]);
  });

  it("bos cikti gecerli", () => {
    expect(validateInsights({ insights: [] }, [sig("s1")])).toEqual([]);
  });
});

describe("fingerprint", () => {
  it("sinyal sirasindan bagimsiz ve projeye bagli", () => {
    expect(fingerprint("p1", ["b", "a"])).toBe(fingerprint("p1", ["a", "b"]));
    expect(fingerprint("p1", ["a"])).not.toBe(fingerprint("p2", ["a"]));
    expect(fingerprint("p1", ["a"])).toHaveLength(32);
  });
});
```

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `cd packages/insights && bun test src/validate.test.ts`
Expected: FAIL, `Cannot find module './validate'`

- [ ] **Step 3: `validate.ts`**

```ts
import { createHash } from "node:crypto";
import { z } from "zod";
import { KINDS, SEVERITIES, TABS, type InsightKind, type Severity, type Signal, type Tab } from "./types";

export const TITLE_MAX = 80;
export const BODY_MAX = 400;
export const PER_TAB_MAX = 3;

const ROUTES = ["overview", "revenue", "users", "social", "health"] as const;

// Uzunluk sinirlari BILEREK semada degil, kodda: structured output'un hangi
// JSON Schema anahtarlarini zorladigina guvenmiyoruz; ihlal kodda reddedilir.
const TextSchema = z.object({ title: z.string(), body: z.string() });

export const ClaudeOutputSchema = z.object({
  insights: z.array(
    z.object({
      signal_ids: z.array(z.string()),
      tab: z.enum(TABS),
      kind: z.enum(KINDS),
      severity: z.enum(SEVERITIES),
      text: z.object({ tr: TextSchema, en: TextSchema }),
      action: z
        .object({
          type: z.enum(["open_route", "check_version"]),
          params: z.object({ route: z.enum(ROUTES) }),
        })
        .nullable(),
    }),
  ),
});

export type ClaudeOutput = z.infer<typeof ClaudeOutputSchema>;
export type InsightTexts = ClaudeOutput["insights"][number]["text"];
export type InsightAction = NonNullable<ClaudeOutput["insights"][number]["action"]>;

export interface Evidence {
  signal_id: string;
  metric: string;
  window: string;
  value: number;
  baseline: number;
  delta_pct: number | null;
}

export interface InsightRecord {
  project_id: string;
  tab: Tab;
  kind: InsightKind;
  severity: Severity;
  text: InsightTexts;
  evidence: Evidence[];
  action: InsightAction | null;
  fingerprint: string;
}

/** Sira bagimsiz: ayni sinyal kumesi her gun ayni kaydi gunceller. */
export function fingerprint(projectId: string, signalKeys: readonly string[]): string {
  const material = `${projectId}|${[...signalKeys].sort().join(",")}`;
  return createHash("sha256").update(material).digest("hex").slice(0, 32);
}

const withinLimits = (t: InsightTexts) =>
  [t.tr, t.en].every((x) => x.title.length > 0 && x.title.length <= TITLE_MAX && x.body.length <= BODY_MAX);

/**
 * Claude ciktisini koda baglar. Reddedilen oneri sessizce duser (log yalniz sayi).
 * Time: O(s + i·k), s=sinyal, i=oneri, k=oneri basina sinyal. Space: O(s + i).
 */
export function validateInsights(output: ClaudeOutput, signals: readonly Signal[]): InsightRecord[] {
  const byId = new Map(signals.map((s) => [s.id, s]));
  const perTab = new Map<string, number>();
  const out: InsightRecord[] = [];

  for (const item of output.insights) {
    if (item.signal_ids.length === 0) continue;
    const linked = item.signal_ids.map((id) => byId.get(id));
    if (linked.some((s) => s == null)) continue;
    const sigs = linked as Signal[];
    const project = sigs[0]!.project_id;
    if (sigs.some((s) => s.project_id !== project)) continue;
    if (!sigs.some((s) => s.tab === item.tab)) continue;
    if (!withinLimits(item.text)) continue;

    const slot = `${project}|${item.tab}`;
    const used = perTab.get(slot) ?? 0;
    if (used >= PER_TAB_MAX) continue;
    perTab.set(slot, used + 1);

    out.push({
      project_id: project,
      tab: item.tab,
      kind: item.kind,
      severity: item.severity,
      text: item.text,
      evidence: sigs.map((s) => ({
        signal_id: s.id,
        metric: s.metric,
        window: s.window,
        value: s.value,
        baseline: s.baseline,
        delta_pct: s.delta_pct,
      })),
      action: item.action,
      fingerprint: fingerprint(project, sigs.map((s) => s.key)),
    });
  }
  return out;
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `cd packages/insights && bun test`
Expected: PASS (tüm dosyalar)

- [ ] **Step 5: Commit**

```bash
git add packages/insights/src/validate.ts packages/insights/src/validate.test.ts
git commit -m "feat(insights): WES-000 claude cikti semasi, kodda dogrulama ve fingerprint ekle"
```

---

### Task 5: Prompt, Claude çağrısı ve maliyet

**Files:**
- Create: `packages/insights/src/prompt.ts`
- Test: `packages/insights/src/prompt.test.ts`

**Interfaces:**
- Consumes: `Signal`, `MODEL` (Task 2); `ClaudeOutputSchema`, `ClaudeOutput` (Task 4)
- Produces:
  - `buildUserPrompt(signals: readonly Signal[]): string`
  - `costUsd(usage: { input_tokens: number; output_tokens: number }): number`
  - `class InsightError extends Error { code: string }`
  - `requestInsights(client: Anthropic, signals: readonly Signal[]): Promise<{ output: ClaudeOutput; inputTokens: number; outputTokens: number }>`

- [ ] **Step 1: Başarısız testi yaz**

`packages/insights/src/prompt.test.ts`:
```ts
import { describe, expect, it } from "bun:test";
import { buildUserPrompt, costUsd } from "./prompt";
import type { Signal } from "./types";

const s: Signal = {
  id: "s1", key: "dau_shift:dau:down", project_id: "0b6c2f0e-0000-4000-8000-000000000000",
  tab: "users", kind: "risk", severity: "warn", metric: "dau", window: "7d/28d",
  value: 40, baseline: 100, delta_pct: -60, z: -5.2, note: null,
};

describe("buildUserPrompt", () => {
  it("proje id'sini gondermez, sinyal alanlarini gonderir", () => {
    const p = buildUserPrompt([s]);
    expect(p).not.toContain(s.project_id);
    const parsed = JSON.parse(p) as { signals: Array<Record<string, unknown>> };
    expect(parsed.signals[0]).toMatchObject({ id: "s1", metric: "dau", tab: "users", delta_pct: -60 });
  });
});

describe("costUsd", () => {
  it("opus 5 fiyatiyla hesaplar ($5 / $25 per MTok)", () => {
    expect(costUsd({ input_tokens: 1_000_000, output_tokens: 100_000 })).toBeCloseTo(7.5, 6);
  });
});
```

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `cd packages/insights && bun test src/prompt.test.ts`
Expected: FAIL, `Cannot find module './prompt'`

- [ ] **Step 3: `prompt.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { MODEL, type Signal } from "./types";
import { ClaudeOutputSchema, type ClaudeOutput, BODY_MAX, TITLE_MAX, PER_TAB_MAX } from "./validate";

/** Opus 5 birinci taraf fiyati (per token). Fallback baska modelde calisirsa yaklasiktir. */
const INPUT_PER_TOKEN = 5 / 1_000_000;
const OUTPUT_PER_TOKEN = 25 / 1_000_000;

export class InsightError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "InsightError";
  }
}

const SYSTEM_PROMPT = `Sen tek kisilik bir uygulama portfoyunun analistisin. Sana, kodun metriklerden hesapladigi sinyaller verilir. Her sinyal bir metrigin son pencere medyanini (value), onceki taban medyanini (baseline), yuzde degisimi (delta_pct) ve robust z skorunu (z) tasir.

Gorevin: bu sinyallerden sahibin bugun bakmaya deger bulacagi onerileri cikarmak.

Kurallar:
- Yalniz verilen sinyallere dayan. Her oneri signal_ids ile en az bir sinyale baglanir.
- Metinde rakam yazma; rakamlar kartta koddan gosterilir. "Belirgin dustu", "iki katina cikti" gibi niteleyiciler kullan.
- Proje, uygulama ya da hesap adi yazma; kart proje adini ayrica gosterir.
- Iliskili sinyalleri tek oneride birlestir (ornegin note=after_release olan hata artisi ile surum). Birlestirdigin sinyaller ayni projeden olmali.
- tab, bagli sinyallerden birinin tab degeri olmali.
- Her proje ve sekme icin en fazla ${PER_TAB_MAX} oneri; onem sirasina gore diz.
- text.tr ve text.en ayni anlami tasir. Baslik en fazla ${TITLE_MAX}, govde en fazla ${BODY_MAX} karakter.
- Govde: ne oldu, olasi neden, somut ilk adim. Tahmini "olasi" diye isaretle.
- action: sahibin once bakacagi ekran varsa open_route (overview|revenue|users|social), surumle ilgiliyse check_version + route health. Yoksa null.
- kind=data_gap sinyallerini abartma; tek kisa bilgi yeterli.
- Soylenecek anlamli bir sey yoksa insights bos dizi olsun.`;

/**
 * Proje id'si GONDERILMEZ: Claude'un ihtiyaci yok ve metne sizmasin.
 * JSON sabit anahtar sirasinda - ayni sinyal kumesi ayni istek.
 */
export function buildUserPrompt(signals: readonly Signal[]): string {
  return JSON.stringify({
    signals: signals.map((s) => ({
      id: s.id,
      tab: s.tab,
      kind: s.kind,
      severity: s.severity,
      metric: s.metric,
      window: s.window,
      value: s.value,
      baseline: s.baseline,
      delta_pct: s.delta_pct,
      z: s.z,
      note: s.note,
    })),
  });
}

export function costUsd(usage: { input_tokens: number; output_tokens: number }): number {
  return usage.input_tokens * INPUT_PER_TOKEN + usage.output_tokens * OUTPUT_PER_TOKEN;
}

/** Tek proje, tek istek. Reddetme ya da ayristirma hatasi InsightError firlatir. */
export async function requestInsights(
  client: Anthropic,
  signals: readonly Signal[],
): Promise<{ output: ClaudeOutput; inputTokens: number; outputTokens: number }> {
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: betaZodOutputFormat(ClaudeOutputSchema) },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(signals) }],
  });

  if (response.stop_reason === "refusal") throw new InsightError("refusal");
  if (response.stop_reason === "max_tokens") throw new InsightError("max_tokens");
  if (response.parsed_output == null) throw new InsightError("unparsed");

  return {
    output: response.parsed_output,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
```

- [ ] **Step 4: Testlerin geçtiğini gör + typecheck**

Run: `cd packages/insights && bun test && bun run typecheck`
Expected: PASS ve typecheck çıkış kodu 0. Typecheck `fallbacks` ya da `parsed_output` tipinde hata verirse SDK sürümünü kontrol et (`@anthropic-ai/sdk` 0.125.0 `BetaFallbacksParam = Array<...> | 'default'` içerir).

- [ ] **Step 5: Commit**

```bash
git add packages/insights/src/prompt.ts packages/insights/src/prompt.test.ts
git commit -m "feat(insights): WES-000 sinyallerden claude oneri istegi ve maliyet hesabi ekle"
```

---

### Task 6: DB katmanı, orkestrasyon ve dry-run

**Files:**
- Create: `packages/insights/src/db.ts`
- Create: `packages/insights/src/run.ts`

**Interfaces:**
- Consumes: `detectSignals`, `CATALOG_METRICS` (Task 3); `validateInsights`, `InsightRecord` (Task 4); `requestInsights`, `costUsd`, `InsightError` (Task 5)
- Produces (Faz 2/3 bu tablolardaki satırları okur):
  - `openRun(sql, runDate): Promise<string | null>`
  - `fetchMetricRows(sql, since): Promise<MetricRow[]>`, `fetchVersions(sql, since): Promise<VersionRow[]>`
  - `monthCost(sql, runDate): Promise<number>`
  - `persistRun(sql, runId, records, triggeredOn, totals): Promise<void>`
  - `markRun(sql, runId, status, fields): Promise<void>`
  - CLI: `bun run packages/insights/src/run.ts [--dry-run]`

- [ ] **Step 1: `db.ts`**

```ts
import type { SQL } from "bun";
import { MODEL, type MetricRow, type VersionRow } from "./types";
import type { InsightRecord } from "./validate";

/** Acik kabul edilen durumlar - migration 0055'teki kismi indeksle ayni. */
const OPEN = ["new", "seen", "snoozed"];
const AUTO_CLOSE_AFTER_DAYS = 3;

/**
 * Gunun kosusunu acar. Ayni gun basarili/suren kosu varsa null (idempotent).
 * Basarisiz kosu elle tetiklemeyle yeniden denenebilir.
 */
export async function openRun(sql: SQL, runDate: string): Promise<string | null> {
  const rows = await sql`
    insert into public.insight_runs (run_date, status, model)
    values (${runDate}, 'running', ${MODEL})
    on conflict (run_date) do update
      set status = 'running', started_at = now(), finished_at = null, error = null
      where public.insight_runs.status = 'failed'
    returning id`;
  return rows.length === 0 ? null : (rows[0].id as string);
}

export async function fetchMetricRows(sql: SQL, since: string, metrics: readonly string[]): Promise<MetricRow[]> {
  const rows = await sql`
    select project_id::text as project_id, to_char(date, 'YYYY-MM-DD') as date,
           metric, source, value::float8 as value
    from public.metrics
    where date >= ${since} and metric in ${sql(metrics as string[])}`;
  return rows as MetricRow[];
}

export async function fetchVersions(sql: SQL, since: string): Promise<VersionRow[]> {
  const rows = await sql`
    select project_id::text as project_id, version, to_char(release_date, 'YYYY-MM-DD') as release_date
    from public.app_versions
    where release_date >= ${since}`;
  return rows as VersionRow[];
}

export async function monthCost(sql: SQL, runDate: string): Promise<number> {
  const [row] = await sql`
    select coalesce(sum(cost_usd), 0)::float8 as total
    from public.insight_runs
    where run_date >= date_trunc('month', ${runDate}::date)`;
  return Number(row.total);
}

export async function markRun(
  sql: SQL,
  runId: string,
  status: "ok" | "failed" | "skipped_budget",
  fields: { error?: string; signalCount?: number },
): Promise<void> {
  await sql`
    update public.insight_runs
    set status = ${status}, finished_at = now(),
        error = ${fields.error ?? null},
        signal_count = ${fields.signalCount ?? 0}
    where id = ${runId}`;
}

/**
 * Tek transaction: erteleme suresi dolanlari ac, upsert, otomatik kapanis, kosuyu kapat.
 * Hata olursa hicbir satir degismez; mevcut oneriler bozulmaz.
 * Time: O(r) sorgu, r = oneri sayisi (gunde birkac).
 */
export async function persistRun(
  sql: SQL,
  runId: string,
  records: readonly InsightRecord[],
  triggeredOn: string,
  totals: { inputTokens: number; outputTokens: number; costUsd: number; signalCount: number },
): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`
      update public.insights
      set status = 'new', snoozed_until = null, updated_at = now()
      where status = 'snoozed' and snoozed_until <= now()`;

    for (const r of records) {
      // Kapatilmis (dismissed) ayni fingerprint varsa yeniden acilmaz.
      await tx`
        insert into public.insights
          (run_id, project_id, tab, kind, severity, text, evidence, action, fingerprint, last_triggered_on)
        select ${runId}, ${r.project_id}, ${r.tab}, ${r.kind}, ${r.severity},
               ${JSON.stringify(r.text)}::jsonb, ${JSON.stringify(r.evidence)}::jsonb,
               ${r.action == null ? null : JSON.stringify(r.action)}::jsonb,
               ${r.fingerprint}, ${triggeredOn}
        where not exists (
          select 1 from public.insights
          where fingerprint = ${r.fingerprint} and status = 'dismissed'
        )
        on conflict (fingerprint) where status in ('new', 'seen', 'snoozed')
        do update set
          run_id = excluded.run_id, kind = excluded.kind, severity = excluded.severity,
          text = excluded.text, evidence = excluded.evidence, action = excluded.action,
          last_triggered_on = excluded.last_triggered_on, updated_at = now()`;
    }

    await tx`
      update public.insights
      set status = 'done', resolved_at = now(), updated_at = now()
      where status in ${tx(OPEN)}
        and last_triggered_on <= ${triggeredOn}::date - ${AUTO_CLOSE_AFTER_DAYS}::int`;

    await tx`
      update public.insight_runs
      set status = 'ok', finished_at = now(),
          input_tokens = ${totals.inputTokens}, output_tokens = ${totals.outputTokens},
          cost_usd = ${totals.costUsd}, signal_count = ${totals.signalCount},
          insight_count = ${records.length}
      where id = ${runId}`;
  });
}
```

- [ ] **Step 2: `run.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import { SQL } from "bun";
import { CATALOG_METRICS, detectSignals } from "./detectors";
import { fetchMetricRows, fetchVersions, markRun, monthCost, openRun, persistRun } from "./db";
import { costUsd, InsightError, requestInsights } from "./prompt";
import type { Signal } from "./types";
import { validateInsights, type InsightRecord } from "./validate";

const MONTHLY_CAP_USD = 40;
const LOOKBACK_DAYS = 36;
const DAY_MS = 86_400_000;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new InsightError(`missing_env_${name.toLowerCase()}`);
  return v;
}

function groupByProject(signals: readonly Signal[]): Map<string, Signal[]> {
  const out = new Map<string, Signal[]>();
  for (const s of signals) {
    const list = out.get(s.project_id) ?? [];
    list.push(s);
    out.set(s.project_id, list);
  }
  return out;
}

/** Hata kodu - mesaj metni DEGIL (loglar public). */
function errorCode(err: unknown): string {
  if (err instanceof InsightError) return err.code;
  if (err instanceof Anthropic.APIError) return `api_${err.status ?? "network"}`;
  return "unknown";
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - LOOKBACK_DAYS * DAY_MS).toISOString().slice(0, 10);
  // Dry-run yerelde tam yetkili URL ile de calisir; yazma yapmaz.
  const url = dryRun ? process.env.HELM_INSIGHTS_DB_URL ?? env("HELM_DB_URL") : env("HELM_INSIGHTS_DB_URL");
  const sql = new SQL(url);

  try {
    const [rows, versions] = await Promise.all([
      fetchMetricRows(sql, since, CATALOG_METRICS),
      fetchVersions(sql, since),
    ]);
    const signals = detectSignals(rows, versions, today);
    const byProject = groupByProject(signals);

    if (dryRun) {
      console.log(`dry-run projects=${byProject.size} signals=${signals.length}`);
      return;
    }

    const runId = await openRun(sql, today);
    if (runId == null) {
      console.log("already ran today");
      return;
    }

    try {
      if (signals.length === 0) {
        await persistRun(sql, runId, [], today, { inputTokens: 0, outputTokens: 0, costUsd: 0, signalCount: 0 });
        console.log("projects=0 signals=0 insights=0 cost=0.00");
        return;
      }
      if ((await monthCost(sql, today)) >= MONTHLY_CAP_USD) {
        await markRun(sql, runId, "skipped_budget", { signalCount: signals.length });
        console.log(`skipped_budget signals=${signals.length}`);
        return;
      }

      const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
      const records: InsightRecord[] = [];
      let inputTokens = 0;
      let outputTokens = 0;
      // Sirali: gunde ~3 istek; paralellik rate limit riskinden baska bir sey kazandirmaz.
      for (const projectSignals of byProject.values()) {
        const res = await requestInsights(client, projectSignals);
        inputTokens += res.inputTokens;
        outputTokens += res.outputTokens;
        records.push(...validateInsights(res.output, projectSignals));
      }

      const cost = costUsd({ input_tokens: inputTokens, output_tokens: outputTokens });
      await persistRun(sql, runId, records, today, { inputTokens, outputTokens, costUsd: cost, signalCount: signals.length });
      console.log(`projects=${byProject.size} signals=${signals.length} insights=${records.length} cost=${cost.toFixed(2)}`);
    } catch (err) {
      await markRun(sql, runId, "failed", { error: errorCode(err), signalCount: signals.length });
      throw err;
    }
  } finally {
    await sql.close();
  }
}

main().catch((err: unknown) => {
  console.error(`insights failed code=${errorCode(err)}`);
  process.exit(1);
});
```

- [ ] **Step 3: Typecheck + testler**

Run: `cd packages/insights && bun run typecheck && bun test`
Expected: çıkış kodu 0, tüm testler PASS

- [ ] **Step 4: Dry-run (Task 1 Step 4 uygulandıktan sonra, salt okuma)**

Run: `set -a && . apps/mobile/.env && set +a && bun run packages/insights/src/run.ts --dry-run`
Expected: `dry-run projects=N signals=M`. Proje adı, rakam ya da metin basılmamalı.

- [ ] **Step 5: Commit**

```bash
git add packages/insights/src/db.ts packages/insights/src/run.ts
git commit -m "feat(insights): WES-000 gunluk kosu orkestrasyonu, transaction yazimi ve dry-run ekle"
```

---

### Task 7: GitHub Actions iş akışı

**Files:**
- Create: `.github/workflows/insights.yml`

**Interfaces:**
- Consumes: `packages/insights/src/run.ts` (Task 6); secret'lar `ANTHROPIC_API_KEY`, `HELM_INSIGHTS_DB_URL`

- [ ] **Step 1: Workflow**

```yaml
# Gunluk oneri motoru. Spec: docs/superpowers/specs/2026-09-14-helm-insights-design.md
#
# NEDEN pull_request YOK: repo public; fork PR'lari secret goremez ama tetik
# listesini dar tutmak sizinti yuzeyini sifirlar. Yalniz zamanlanmis + elle.
# Loglar herkese acik: run.ts yalniz sayi basar.
name: Insights

on:
  schedule:
    - cron: "0 5 * * *" # 08:00 Istanbul
  workflow_dispatch:

concurrency:
  group: insights
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  run:
    name: Daily insights
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v7

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - run: bun install --frozen-lockfile

      - name: Run engine
        run: bun run packages/insights/src/run.ts
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          HELM_INSIGHTS_DB_URL: ${{ secrets.HELM_INSIGHTS_DB_URL }}
```

- [ ] **Step 2: YAML sözdizimi kontrolü**

Run: `bun -e "const t=await Bun.file('.github/workflows/insights.yml').text(); console.log(t.includes('workflow_dispatch') && !t.includes('pull_request:') ? 'ok' : 'bad')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/insights.yml
git commit -m "ci(insights): WES-000 gunluk oneri motoru is akisini ekle"
```

- [ ] **Step 4: KULLANICI ADIMLARI (ajan yapmaz, kullanıcıya listele)**

1. `alter role helm_insights_writer password '<güçlü şifre>';` (Supabase SQL editor)
2. GitHub → Settings → Secrets: `ANTHROPIC_API_KEY`, `HELM_INSIGHTS_DB_URL` (kullanıcı adı `helm_insights_writer` ile, Supabase pooler bağlantı dizesi).
3. Actions → Insights → Run workflow. Beklenen log: `projects=… signals=… insights=… cost=…`.

---

## Self-Review (yazar)

- Spec §1 veri modeli → Task 1 (tablolar, indeksler, RLS, RPC, rol, temizlik). `last_triggered_on` ve `skipped_budget` dahil.
- Spec §2 katalog → Task 3. Spec'ten iki bilinçli sapma Global Constraints'te yazılı: gelir metrik başına (para birimi), çoklu kaynak seçimi.
- Spec §3 günlük iş → Task 5-7 (Messages API, adaptive + medium, fallbacks default, doğrulama, transaction, otomatik kapanış, $40 tavan, dry-run, sayı-only log).
- Faz 2 (sekme kartları) ve Faz 3 (AI sayfası) ayrı plan dosyalarında.
