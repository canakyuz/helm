-- revenue_events tablosunu Realtime yayinina ekler.
--
-- NEDEN GEREKLI: Supabase'de `supabase_realtime` publication'i VARSAYILAN OLARAK
-- BOSTUR. Bir tablo bu publication'a eklenmedigi surece postgres_changes
-- aboneligi hatasiz sekilde acilir ama HICBIR olay tasimaz - panel "canli"
-- gorunur, akis olur. Repo genelinde bu tabloyu yayina ekleyen bir migration
-- yoktu (grep: "supabase_realtime" hicbir dosyada gecmiyor), dolayisiyla web
-- kokpitindeki canli satin alma akisi bu satir olmadan sessizce bos kalirdi.
--
-- RLS: tablo zaten row level security ile korunuyor ve
-- 0036_revenue_events.sql'deki "authenticated read revenue_events" politikasi
-- authenticated rolune select veriyor. Realtime her satiri aboneye gondermeden
-- once ayni politikayi calistirir; yayina eklemek yetki genisletmez, sadece
-- degisiklik akisini acar. Politika ZAYIFLATILMADI.

do $$
begin
  -- Publication yoksa (self-hosted / bos proje) once olustur.
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;

  -- Idempotent: "add table" ayni tablo icin iki kez calisirsa hata verir.
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'revenue_events'
  ) then
    alter publication supabase_realtime add table public.revenue_events;
  end if;
end
$$;

-- Realtime payload'inda eski satir gerekmiyor (yalnizca INSERT dinleniyor),
-- bu yuzden REPLICA IDENTITY degistirilmedi - varsayilan primary key yeterli.
