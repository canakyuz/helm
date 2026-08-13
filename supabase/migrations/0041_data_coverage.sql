-- data_coverage — hangi proje/kaynak susmus, hangisi hic baglanmamis.
--
-- NEDEN GEREKLI: alert_events 0 satir ve alert_rules da 0 satir; uyari motoru
-- (helm-alert) calisiyor ama degerlendirecek KURAL yok, dolayisiyla kokpit hic
-- uyari gostermiyor. Ustelik motorun destekledigi kosullar (drop_pct, rise_pct,
-- below, above) yalnizca DEGERE bakar — "veri akmayi kesti"yi hic goremez.
--
-- Bir kokpitte en tehlikeli hata budur: AdMob senkronu susarsa gelir ₺0
-- gorunur ve "para kazanmiyorum" diye okunur, oysa dogru okuma "olcum
-- gelmiyor"dur. Ikisi ayni ekranda ayni sekilde gorunmemeli.
--
-- NEDEN OLAY DEGIL TURETME: bayatlik ANLIK BIR DURUM, gecmis bir olay degil.
-- alert_events'e yazsaydik kaynak duzeldikten sonra da uyari orada durur, elle
-- kapatilmasi gerekirdi. Okuma aninda turetince kendini iyilestirir.
--
-- NEDEN RPC: proje x kaynak icin max(date) toplamasi. Ham metrics satirlarini
-- (2.6k+) mobile cekip orada gruplamak hem ag hem bellek israfi olurdu
-- (ayni gerekce: 0035 game_funnels).
--
-- security invoker: RLS cagiranin haklariyla uygulanir, fonksiyon yetki asmaz.

create or replace function public.data_coverage()
returns jsonb
language sql
security invoker
stable
as $$
  with per_source as (
    select m.project_id, m.source, max(m.date) as last_date
    from public.metrics m
    group by 1, 2
  ),
  -- KAYNAK granulerligi YETMIYOR: sentry hala `errors` yaziyor ama
  -- `crash_free_sessions` 12 Temmuz'da olmus. Kaynak "taze" gorunurken tek bir
  -- metrik sessizce olebiliyor ve ekranda yalnizca bos bir kutu kaliyor.
  --
  -- KAYNAGA GORE DEGIL METRIGE GORE gruplanir: ayni metrigi birden fazla kaynak
  -- yazabilir. `dau`'yu posthog 24 Mayis'ta birakmis ama supabase her gun
  -- yaziyor — metrik SAG. Kaynak-metrik ciftiyle gruplansaydi ilk acilista
  -- yanlis alarm cikardi ve alarm yorgunlugu gercek uyariyi korlestirirdi.
  per_metric as (
    select
      m.project_id,
      m.metric,
      max(m.date) as last_date,
      -- Mesajda "hangi kaynak" yazabilmek icin en son yazani tutuyoruz.
      (array_agg(m.source order by m.date desc))[1] as source
    from public.metrics m
    group by 1, 2
  ),
  per_project as (
    select
      p.id, p.name, p.type,
      (select count(*) from public.project_integrations i
        where i.project_id = p.id and i.enabled) as integrations,
      (select count(*) from public.metrics m where m.project_id = p.id) as metric_rows,
      (select count(*) from public.game_events g where g.project_id = p.id) as event_rows,
      (select max(m.date) from public.metrics m where m.project_id = p.id) as last_date
    from public.properties p
  )
  select jsonb_build_object(
    'today', current_date,
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'projectId',   ps.project_id,
        'projectName', pr.name,
        'source',      ps.source,
        'lastDate',    ps.last_date,
        'ageDays',     current_date - ps.last_date
      ) order by (current_date - ps.last_date) desc, pr.name)
      from per_source ps
      join public.properties pr on pr.id = ps.project_id
    ), '[]'::jsonb),
    'metrics', coalesce((
      select jsonb_agg(jsonb_build_object(
        'projectId',   pm.project_id,
        'projectName', pr.name,
        'source',      pm.source,
        'metric',      pm.metric,
        'lastDate',    pm.last_date,
        'ageDays',     current_date - pm.last_date
      ) order by (current_date - pm.last_date) desc, pr.name)
      from per_metric pm
      join public.properties pr on pr.id = pm.project_id
      -- Yalnizca GECIKMIS olanlar: tum metrik x proje carpimi bosuna yuk.
      where current_date - pm.last_date > 2
    ), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'projectId',    pp.id,
        'projectName',  pp.name,
        'type',         pp.type,
        'integrations', pp.integrations,
        'metricRows',   pp.metric_rows,
        'eventRows',    pp.event_rows,
        'lastDate',     pp.last_date
      ) order by pp.name)
      from per_project pp
    ), '[]'::jsonb)
  );
$$;

comment on function public.data_coverage is
  'Proje/kaynak bazinda veri tazeligi ve kapsam. Siniflandirma (taze/gec/susmus) okuma tarafinda yapilir — esikler kaynak kadansina gore degisir.';
