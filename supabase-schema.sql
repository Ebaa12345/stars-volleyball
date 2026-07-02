-- VolleyMN Supabase Schema
-- Run this in your Supabase SQL Editor

-- 1. Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  position text,
  jersey_number integer,
  avatar_url text,
  created_at timestamptz default now()
);

-- 2. User schedules table
create table if not exists public.user_schedules (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  week_start date not null,
  schedule_slots jsonb not null default '[]',
  created_by text default 'admin',
  created_at timestamptz default now(),
  unique(user_id, week_start)
);

-- 3. Row Level Security

-- Profiles: users can read all, update own
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

-- Schedules: users can read own, admins can read/write all
alter table public.user_schedules enable row level security;

create policy "Users can view own schedule"
  on user_schedules for select
  using (auth.uid() = user_id);

create policy "Admins can view all schedules"
  on user_schedules for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can insert schedules"
  on user_schedules for insert
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update schedules"
  on user_schedules for update
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- 4. Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. To make a user an admin, run:
-- update profiles set role = 'admin' where email = 'admin@example.com';
