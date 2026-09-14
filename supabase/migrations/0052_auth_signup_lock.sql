-- Yeni kayit kilidi - Helm tek kullanicili bir calisma alani.
--
-- NEDEN GEREKLI: Supabase auth ayarlarinda e-posta ile yeni kayit acikti ve
-- public tablolarin politikalari "authenticated her seyi okur/yazar"
-- (project_integrations dahil; saglayici anahtarlari config'te duz metin).
-- Proje URL'si ve publishable anahtar yayinlanmis web/mobil paketlerinde
-- duruyor. Yani kayit olabilen herkes tum saglayici anahtarlarini okuyabilirdi.
-- 2026-09-14 kontrolunde auth.users'ta yalnizca sahip vardi ve denetim
-- kaydinda hic kayit/davet olayi yoktu.
--
-- Dashboard'daki "Allow new users to sign up" kapatilmali; bu tetikleyici
-- ikinci kilit: ayar yanlislikla tekrar acilsa bile ilk kullanicidan sonra
-- auth.users'a satir eklenemez (anonim giris ve davet dahil).
--
-- NEDEN E-POSTA LISTESI DEGIL: repo public; sahip e-postasini migration'a
-- yazmak onu yayinlamak olurdu. "Zaten bir kullanici var mi" kontrolu ayni
-- korumayi veri tasimadan saglar.
--
-- Bilincli olarak ikinci bir kullanici eklemek gerekirse (SQL editor):
--   alter table auth.users disable trigger helm_block_new_signups;
--   -- kullaniciyi ekle / davet et
--   alter table auth.users enable trigger helm_block_new_signups;
--
-- Time: O(1) - exists() ilk satirda durur.

create or replace function public.helm_block_new_signups()
returns trigger
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  if exists (select 1 from auth.users) then
    raise exception 'helm: yeni kayit kapali'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Trigger fonksiyonu RPC ile cagrilamaz ama public schema'da duruyor;
-- rol erisimini yine de kapat (least privilege).
revoke all on function public.helm_block_new_signups() from public, anon, authenticated;

drop trigger if exists helm_block_new_signups on auth.users;
create trigger helm_block_new_signups
  before insert on auth.users
  for each row execute function public.helm_block_new_signups();

comment on function public.helm_block_new_signups() is
  'Ilk kullanicidan sonra auth.users insert''ini reddeder. Bkz. 0052_auth_signup_lock.sql.';
