-- 0020_backfill_property_modules.sql
-- Migration 0019 ile properties.enabled_modules boş array default ('{}').
-- Mevcut property'ler için type'a göre PRESET_MODULES'ı doldur (idempotent).
-- Sadece henüz seçim yapılmamış (boş) property'ler etkilenir.

update public.properties
   set enabled_modules = case type
     when 'website'     then array['content','analytics']
     when 'web_app'     then array['users','analytics','subscriptions','funnel']
     when 'mobile_app'  then array['users','analytics','subscriptions','ads','reviews','funnel','push']
     when 'desktop_app' then array['users','analytics']
     when 'game'        then array['users','analytics','ads','reviews','funnel','push']
   end
 where enabled_modules = '{}'
    or enabled_modules is null;
