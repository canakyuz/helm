-- 0048 - anlamsal arama altyapisi: pgvector + icerik gomulemeleri.
--
-- NEDEN: yorum arama bugun ilike ile calisiyor, yani kelime eslesmesi.
-- "cok yavas acilyor" diyen bir yorum, "performans" aramasinda cikmiyor.
-- Gomulemeler bu bosslugu kapatir ve RAG icin de temel olur.
--
-- OLCUM (2026-08-31): pgvector 0.8.0 bu projede kullanilabilir durumda;
-- HNSW indeksi 0.5+ ister, kosul saglaniyor.
--
-- BOYUT: vector(1536) - OpenAI text-embedding-3-small. Baska bir saglayiciya
-- (Voyage, Cohere) gecilirse boyut degisir ve bu kolon yeniden yazilmalidir;
-- bu yuzden model adi satirda saklaniyor, hangi satirin neyle uretildigi
-- geriye donuk bilinsin.

create extension if not exists vector;

create table if not exists public.content_embeddings (
  id           bigint generated always as identity primary key,
  project_id   uuid not null references public.properties(id) on delete cascade,
  source_kind  text not null check (source_kind in ('review', 'cms_entry')),
  source_id    text not null,
  content      text not null,
  -- Ayni metni iki kez gomme: hem para hem zaman israfi. Hash degismediyse atlanir.
  content_hash text not null,
  embedding    vector(1536) not null,
  model        text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (source_kind, source_id)
);

-- Yaklasik en yakin komsu. Tarama O(n) yerine O(log n)'e yakin calisir.
create index if not exists content_embeddings_hnsw_idx
  on public.content_embeddings using hnsw (embedding vector_cosine_ops);

-- Kapsam filtresi (tek app / tek tur) once daraltsin.
create index if not exists content_embeddings_scope_idx
  on public.content_embeddings (project_id, source_kind);

alter table public.content_embeddings enable row level security;

drop policy if exists "authenticated read" on public.content_embeddings;
create policy "authenticated read" on public.content_embeddings
  for select to authenticated using (true);

comment on table public.content_embeddings is
  'Anlamsal arama icin icerik gomulemeleri. Yazan: helm-embed (service_role). Okuyan: helm_match_content.';

-- ---------------------------------------------------------------------------
-- Gomulenmesi gereken icerik.
--
-- Idempotency SQL tarafinda: hic gomulmemis VEYA metni degismis kayitlar doner.
-- Edge function yalnizca gomer, "neyi gomeyim" karari burada.
-- ---------------------------------------------------------------------------
create or replace function public.helm_pending_embeddings(
  p_limit int default 200
)
returns table (
  project_id   uuid,
  source_id    text,
  content      text,
  content_hash text
)
language sql
stable
security invoker
set search_path = public
as $$
  with candidate as (
    select
      r.project_id,
      r.id::text as source_id,
      btrim(coalesce(r.title, '') || E'\n' || coalesce(r.body, '')) as content
    from public.reviews r
    where coalesce(r.title, '') <> '' or coalesce(r.body, '') <> ''
  )
  select
    c.project_id,
    c.source_id,
    c.content,
    md5(c.content) as content_hash
  from candidate c
  left join public.content_embeddings e
    on e.source_kind = 'review'
   and e.source_id   = c.source_id
  where e.id is null
     or e.content_hash is distinct from md5(c.content)
  limit greatest(1, least(p_limit, 500));
$$;

comment on function public.helm_pending_embeddings(int) is
  'Gomulmemis veya metni degismis yorumlar. Tekrar gommeyi md5 karsilastirmasi engeller.';

-- ---------------------------------------------------------------------------
-- Anlamsal arama.
--
-- `order by embedding <=> query` sirasi HNSW indeksinin kullanilmasi icin sart;
-- benzerlik esigi WHERE'de uygulanir (indeks sonrasi eleme).
-- ---------------------------------------------------------------------------
create or replace function public.helm_match_content(
  p_query_embedding vector(1536),
  p_project_id      uuid   default null,
  p_kind            text   default 'review',
  p_limit           int    default 8,
  p_min_similarity  float  default 0.0
)
returns table (
  source_kind text,
  source_id   text,
  project_id  uuid,
  content     text,
  similarity  float
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    e.source_kind,
    e.source_id,
    e.project_id,
    e.content,
    1 - (e.embedding <=> p_query_embedding) as similarity
  from public.content_embeddings e
  where (p_project_id is null or e.project_id = p_project_id)
    and (p_kind is null or e.source_kind = p_kind)
    and 1 - (e.embedding <=> p_query_embedding) >= p_min_similarity
  order by e.embedding <=> p_query_embedding
  limit greatest(1, least(p_limit, 50));
$$;

comment on function public.helm_match_content(vector, uuid, text, int, float) is
  'Kosinus benzerligine gore en yakin icerikler. p_project_id null ise tum portfoy.';

grant execute on function public.helm_pending_embeddings(int) to authenticated, service_role;
grant execute on function public.helm_match_content(vector, uuid, text, int, float) to authenticated, service_role;
