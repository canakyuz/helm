-- ─────────────────────────────────────────────────────────────
-- revenue_goals: aylık gelir hedefi (kullanıcı-set).
-- project_id null = tüm projeler (genel hedef); dolu = proje bazlı.
-- İlerleme gerçek gelirden türetilir (metrics.ad_revenue ay toplamı), burada saklanmaz.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.revenue_goals (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references public.properties(id) on delete cascade, -- null = tüm projeler
  month         date not null,                                          -- ayın ilk günü (YYYY-MM-01)
  target_amount numeric not null check (target_amount >= 0),
  currency      text not null default 'USD',
  updated_at    timestamptz not null default now()
);

-- (scope, month) tekilliği. project_id null çoklu satır verirdi → coalesce sentinel ile sabitle.
create unique index if not exists revenue_goals_scope_month_idx
  on public.revenue_goals (
    coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid),
    month
  );

alter table public.revenue_goals enable row level security;

create policy "authenticated full access" on public.revenue_goals
  for all to authenticated using (true) with check (true);

-- ─────────────────────────────────────────────────────────────
-- set_revenue_goal: idempotent upsert. PostgREST onConflict, expression
-- index hedefini doğrudan kullanamadığı için RPC ile sarmalanır (edge değil).
-- SECURITY INVOKER (varsayılan) → RLS uygulanır, authenticated yetkili.
-- ─────────────────────────────────────────────────────────────
create or replace function public.set_revenue_goal(
  p_month      date,
  p_target     numeric,
  p_currency   text default 'USD',
  p_project_id uuid default null
) returns public.revenue_goals
language sql
as $$
  insert into public.revenue_goals (project_id, month, target_amount, currency, updated_at)
  values (p_project_id, date_trunc('month', p_month)::date, p_target, p_currency, now())
  on conflict (
    coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid),
    month
  )
  do update set
    target_amount = excluded.target_amount,
    currency      = excluded.currency,
    updated_at    = now()
  returning *;
$$;
