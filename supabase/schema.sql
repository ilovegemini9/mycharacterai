-- MyCharacter database foundation for Supabase.
-- Apply only after choosing the Supabase project for this site.
-- Every exposed table uses RLS; private chats/messages are owner-scoped.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  role text not null default '',
  description text not null default '',
  greeting text not null default '',
  backstory text not null default '',
  scenario text not null default '',
  personality text not null default '',
  image_url text not null default '',
  tags text[] not null default '{}',
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender text not null check (sender in ('user', 'character')),
  content text not null check (char_length(content) <= 20000),
  created_at timestamptz not null default now()
);

create table if not exists public.saved_characters (
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, character_id)
);

create index if not exists characters_creator_id_idx on public.characters(creator_id);
create index if not exists characters_public_created_idx on public.characters(is_public, created_at desc);
create index if not exists chats_user_updated_idx on public.chats(user_id, updated_at desc);
create index if not exists messages_chat_created_idx on public.messages(chat_id, created_at);
create index if not exists saved_characters_user_idx on public.saved_characters(user_id);

alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.saved_characters enable row level security;

-- Profiles: authenticated users can read public profile fields; only owners edit.
create policy "Profiles are readable by signed-in users"
  on public.profiles for select to authenticated using (true);
create policy "Users insert their own profile"
  on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "Users update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Public characters are discoverable; drafts and edits belong to their creator.
create policy "Public characters and own characters are readable"
  on public.characters for select to anon, authenticated
  using (is_public = true or (select auth.uid()) = creator_id);
create policy "Signed-in users create their own characters"
  on public.characters for insert to authenticated
  with check ((select auth.uid()) = creator_id);
create policy "Creators update their own characters"
  on public.characters for update to authenticated
  using ((select auth.uid()) = creator_id)
  with check ((select auth.uid()) = creator_id);
create policy "Creators delete their own characters"
  on public.characters for delete to authenticated
  using ((select auth.uid()) = creator_id);

-- Chats belong only to the signed-in user who created them.
create policy "Users read their own chats"
  on public.chats for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users create their own chats"
  on public.chats for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users update their own chats"
  on public.chats for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users delete their own chats"
  on public.chats for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Message access is inherited from ownership of the parent chat.
create policy "Users read messages in their own chats"
  on public.messages for select to authenticated
  using (exists (
    select 1 from public.chats c
    where c.id = chat_id and c.user_id = (select auth.uid())
  ));
create policy "Users add messages to their own chats"
  on public.messages for insert to authenticated
  with check (exists (
    select 1 from public.chats c
    where c.id = chat_id and c.user_id = (select auth.uid())
  ));
create policy "Users delete messages in their own chats"
  on public.messages for delete to authenticated
  using (exists (
    select 1 from public.chats c
    where c.id = chat_id and c.user_id = (select auth.uid())
  ));

create policy "Users read their saved characters"
  on public.saved_characters for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users save characters for themselves"
  on public.saved_characters for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users unsave their own characters"
  on public.saved_characters for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Prevent duplicate policy creation errors if this script is intentionally rerun:
-- This file is a first-time setup script; apply once to the selected project.
