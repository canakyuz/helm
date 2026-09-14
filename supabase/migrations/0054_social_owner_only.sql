-- Sosyal yayin: yalnizca calisma alani sahibi okur ve yayinlar.
--
-- NEDEN GEREKLI: 0053'te okuma politikalari "authenticated using (true)" ve
-- yayin RPC'leri yalnizca "oturum var mi" diye bakiyordu. Bugun ikinci bir
-- hesap acilamiyor (0052 helm_block_new_signups), ama guvenlik tek bir
-- tetikleyiciye bagli kaliyordu. Tetikleyici bir gun kapatilirsa (migration
-- yorumunda bunun yolu yazili) yeni hesap Zernio uzerinden stüdyo adina
-- paylasim yapabilirdi. Bu migration ikinci kilidi dogrudan yayin yuzeyine koyar.
--
-- NEDEN "EN ESKI KULLANICI": properties'te owner_id yok ve repo public oldugu
-- icin sahip e-postasi migration'a yazilamaz. Helm tek kullanicili; ilk acilan
-- hesap sahiptir. Ikinci kullanici bilincli olarak eklenirse bu fonksiyon da
-- bilincli olarak degistirilmeli.
--
-- Time: O(1) - auth.users(created_at) uzerinde limit 1.

create or replace function public.helm_is_owner()
returns boolean
language sql
stable
security definer
set search_path = auth, public
as $$
  select auth.uid() is not null
     and auth.uid() = (select id from auth.users order by created_at asc limit 1);
$$;

revoke all on function public.helm_is_owner() from public, anon;
grant execute on function public.helm_is_owner() to authenticated, service_role;

comment on function public.helm_is_owner() is
  'Cagiran, calisma alaninin ilk (sahip) kullanicisi mi. Bkz. 0054_social_owner_only.sql.';

-- Cagiran kontrolu: oturum yetmez, sahip olmak gerekir. Cron (postgres) ve
-- service_role yollari 0053'teki gibi korunur.
create or replace function public.helm_social_assert_caller()
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if public.helm_is_owner() then return; end if;
  if coalesce(auth.role(), '') = 'service_role' then return; end if;
  if session_user = 'postgres' and current_setting('role') = 'none' then return; end if;
  raise exception 'helm: bu islem yalnizca calisma alani sahibine acik' using errcode = '42501';
end;
$$;

drop policy if exists "authenticated read social_library" on public.social_library;
create policy "owner read social_library" on public.social_library
  for select to authenticated using (public.helm_is_owner());

drop policy if exists "authenticated read social_posts" on public.social_posts;
create policy "owner read social_posts" on public.social_posts
  for select to authenticated using (public.helm_is_owner());
