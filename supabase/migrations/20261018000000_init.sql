-- Heel Routine: profiles, exercise sessions and morning pain ratings.
-- Every table is private to its owner via row-level security.

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  affected_foot text not null default 'right' check (affected_foot in ('left', 'right', 'both')),
  condition_start date,
  physio_name text,
  notes text,
  -- app settings (rests, voice, theme, ...) so they follow you between devices
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- completed exercise sessions ----------
create table public.exercise_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- id generated on the device, so offline logs sync exactly once
  client_id text not null,
  exercise_id text not null,
  session_date date not null,
  completed_at timestamptz not null,
  sides text[] not null default '{}',
  manual boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);
create index exercise_sessions_user_date on public.exercise_sessions (user_id, session_date);

-- ---------- morning first-step pain (one per day) ----------
create table public.pain_ratings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rating_date date not null,
  rating smallint not null check (rating between 0 and 10),
  updated_at timestamptz not null default now(),
  primary key (user_id, rating_date)
);

-- ---------- row-level security ----------
alter table public.profiles enable row level security;
alter table public.exercise_sessions enable row level security;
alter table public.pain_ratings enable row level security;

create policy "profiles: owner reads" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: owner updates" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "profiles: owner inserts" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);

create policy "sessions: owner reads" on public.exercise_sessions for select to authenticated using ((select auth.uid()) = user_id);
create policy "sessions: owner inserts" on public.exercise_sessions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "sessions: owner updates" on public.exercise_sessions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "sessions: owner deletes" on public.exercise_sessions for delete to authenticated using ((select auth.uid()) = user_id);

create policy "pain: owner reads" on public.pain_ratings for select to authenticated using ((select auth.uid()) = user_id);
create policy "pain: owner inserts" on public.pain_ratings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "pain: owner updates" on public.pain_ratings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "pain: owner deletes" on public.pain_ratings for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- triggers ----------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger pain_touch before update on public.pain_ratings
  for each row execute function public.touch_updated_at();
