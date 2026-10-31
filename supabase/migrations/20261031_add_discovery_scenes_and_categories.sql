create table if not exists public.scenes (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  image_url text not null default '',
  tags text[] not null default '{}',
  category text not null default 'Roleplay',
  interaction_count integer not null default 0,
  like_count integer not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scenes_public_category_idx on public.scenes(is_public, category);
create index if not exists scenes_interactions_idx on public.scenes(interaction_count desc);

create table if not exists public.scene_characters (
  scene_id uuid references public.scenes(id) on delete cascade,
  character_id uuid references public.characters(id) on delete cascade,
  position integer not null default 0,
  primary key(scene_id, character_id)
);

create index if not exists scene_characters_character_idx on public.scene_characters(character_id);

alter table public.scenes enable row level security;
alter table public.scene_characters enable row level security;

drop policy if exists "Public scenes are readable" on public.scenes;
create policy "Public scenes are readable" on public.scenes
  for select using (is_public = true or auth.uid() = creator_id);

drop policy if exists "Creators manage own scenes" on public.scenes;
create policy "Creators manage own scenes" on public.scenes
  for all using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

drop policy if exists "Public scene characters are readable" on public.scene_characters;
create policy "Public scene characters are readable" on public.scene_characters
  for select using (
    exists (
      select 1 from public.scenes s
      where s.id = scene_id
        and (s.is_public = true or s.creator_id = auth.uid())
    )
  );

drop policy if exists "Creators manage scene characters" on public.scene_characters;
create policy "Creators manage scene characters" on public.scene_characters
  for all using (
    exists (select 1 from public.scenes s where s.id = scene_id and s.creator_id = auth.uid())
  ) with check (
    exists (select 1 from public.scenes s where s.id = scene_id and s.creator_id = auth.uid())
  );
