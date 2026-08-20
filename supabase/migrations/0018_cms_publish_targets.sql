-- helm - CMS publish hedefleri. Bir proje publish'i tetiklediğinde
-- hangi sitelere webhook (revalidate) postlanacak.
-- Array of { name, url, secret, locales? }.

alter table public.projects
  add column if not exists cms_publish_targets jsonb not null default '[]'::jsonb;

comment on column public.projects.cms_publish_targets is
  'Array<{name:text, url:text, secret:text, locales?:text[]}> - helm-cms-publish edge fn bu hedeflere POST atar.';
