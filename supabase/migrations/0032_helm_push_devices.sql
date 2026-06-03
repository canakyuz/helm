-- helm_push_devices — cockpit cihazlarının Expo push token kayıtları.
-- Tek kullanıcı (Can) ama yine de RLS ile her kullanıcı yalnız kendi cihazını görür/yazar.
-- Token = ExponentPushToken[...]; aynı cihaz token'ı yenilenebilir → (user_id, token) unique.

create table if not exists helm_push_devices (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  token      text not null,
  platform   text not null default 'ios',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists idx_helm_push_devices_user
  on helm_push_devices (user_id);

alter table helm_push_devices enable row level security;

create policy "own devices select" on helm_push_devices
  for select using (auth.uid() = user_id);

create policy "own devices insert" on helm_push_devices
  for insert with check (auth.uid() = user_id);

create policy "own devices update" on helm_push_devices
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own devices delete" on helm_push_devices
  for delete using (auth.uid() = user_id);
