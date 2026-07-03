-- VolleyMN Supabase Schema
-- Run this in your Supabase SQL Editor.
-- This file is idempotent (safe to re-run) — it only creates what's missing
-- and uses drop-if-exists before recreating policies.

-- ============================================================
-- 1. Profiles table (extends auth.users)
-- ============================================================
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

-- role багана эхэндээ зөвхөн 'user'/'admin' зөвшөөрдөг байсан ч supabase.ts дахь
-- UserRole төрөл 'coach'-ийг аль хэдийн агуулж байсан бөгөөд DB рүү хэзээ ч
-- бичигдэж чадаагүй (constraint татгалздаг байсан) — эндээс залруулав.
-- "coach" эрхтэй хэрэглэгч /admin панелд ороход isAdmin шалгалт дээр
-- (role === 'admin') аль хэдийн тохирохгүй тул автоматаар хориглогдоно.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'admin', 'coach'));

-- Сарын ирцийн лимит (удаагаар). Хуучин monthly_hours_limit цагаар байсныг
-- "15 удаа ирэх" гэх мэт ирцийн тоогоор тооцох болгосон.
alter table public.profiles add column if not exists monthly_visit_limit integer not null default 15;

-- Хуучин багана (deprecated) — өгөгдөл алдагдахгүйн тулд устгахгүй, гэхдээ
-- шинэ код үүнийг ашиглахгүй. Ашиглаагүй удвал дараа нь дараах мөрөөр устгаж болно:
--   alter table public.profiles drop column if exists monthly_hours_limit;
alter table public.profiles add column if not exists monthly_hours_limit integer;

-- ============================================================
-- 2. Programs — Админын урьдчилан тохируулдаг цагийн блокуудын каталог
--    (ж: "14:00–16:00", "16:00–18:00"). Зөвхөн санал болгосон бэлэн
--    сонголтууд — админ хуваарь оноохдоо эдгээрээс сонгож болно эсвэл
--    өөрөө дурын цаг оруулж болно (энэ хязгаарлалт биш, зөвхөн хурдан
--    сонголт).
-- ============================================================
create table if not exists public.programs (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  start_time text not null,
  end_time text not null,
  location text not null default '',
  type text not null default 'practice' check (type in ('practice', 'match', 'training', 'rest')),
  active boolean not null default true,
  created_at timestamptz default now()
);

-- Долоо хоногийн аль өдрүүдэд давтагддагийг заана (0=Ням...6=Бямба, JS Date.getDay()).
-- Хоосон массив ({}) бол давтамжгүй, admin гараар л оноодог хэвээр.
alter table public.programs add column if not exists days_of_week integer[] not null default '{}';

-- ============================================================
-- 3. Session assignments — Админ тухайн тоглогчид сарын АЛЬ Ч өдрийг
--    (7 хоногийн ямар ч өдөр) сонгож, цаг (Program эсвэл дурын цаг)
--    оноодог. Энэ нь долоо хоног бүр давтагддаг хуучин
--    user_schedules-г орлож, уян хатан "аль ч өдөр" загварыг дэмждэг.
-- ============================================================
create table if not exists public.session_assignments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  program_id uuid references public.programs(id) on delete set null,
  start_time text not null,
  end_time text not null,
  location text not null default '',
  type text not null default 'practice' check (type in ('practice', 'match', 'training', 'rest')),
  notes text default '',
  created_by text default 'admin',
  created_at timestamptz default now(),
  unique(user_id, date, start_time)
);

create index if not exists session_assignments_user_date_idx on public.session_assignments(user_id, date);
create index if not exists session_assignments_date_idx on public.session_assignments(date);

-- ============================================================
-- 4. Attendance — өдөр тутмын ирцийн бүртгэл (present/absent).
--    Энэ хүснэгт кодод (Admin/Schedule/Report) хэрэглэгдэж байсан
--    ч эх schema.sql-д байхгүй байсан тул нэмж баталгаажуулж байна.
--    Зөвхөн 'present' гэж тэмдэглэгдсэн өдрүүд сарын лимит (15 удаа)
--    рүү тооцогдоно.
-- ============================================================
create table if not exists public.attendance (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  status text not null check (status in ('present', 'absent')),
  created_at timestamptz default now(),
  unique(user_id, date)
);

create index if not exists attendance_user_date_idx on public.attendance(user_id, date);
create index if not exists attendance_date_idx on public.attendance(date);

-- ============================================================
-- 5. (Deprecated) Old weekly recurring schedule table.
--    Шинэ session_assignments загвар үүнийг орлосон. Устгахгүй
--    (хуучин өгөгдөл харах боломжтой байлгах), гэхдээ шинэ код
--    үүнийг цаашид ашиглахгүй.
-- ============================================================
create table if not exists public.user_schedules (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  week_start date not null,
  schedule_slots jsonb not null default '[]',
  created_by text default 'admin',
  created_at timestamptz default now(),
  unique(user_id, week_start)
);

-- ============================================================
-- 6. Row Level Security
-- ============================================================

-- ---- profiles ----
alter table public.profiles enable row level security;

drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
  on public.profiles for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins can delete profiles" on public.profiles;
create policy "Admins can delete profiles"
  on public.profiles for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---- programs ----
alter table public.programs enable row level security;

drop policy if exists "Programs are viewable by everyone" on public.programs;
create policy "Programs are viewable by everyone"
  on public.programs for select using (true);

drop policy if exists "Admins can manage programs" on public.programs;
create policy "Admins can manage programs"
  on public.programs for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ---- session_assignments ----
alter table public.session_assignments enable row level security;

drop policy if exists "Users can view own assignments" on public.session_assignments;
create policy "Users can view own assignments"
  on public.session_assignments for select
  using (auth.uid() = user_id);

drop policy if exists "Admins can manage all assignments" on public.session_assignments;
create policy "Admins can manage all assignments"
  on public.session_assignments for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ---- attendance ----
alter table public.attendance enable row level security;

drop policy if exists "Users can view own attendance" on public.attendance;
create policy "Users can view own attendance"
  on public.attendance for select
  using (auth.uid() = user_id);

drop policy if exists "Admins can manage all attendance" on public.attendance;
create policy "Admins can manage all attendance"
  on public.attendance for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ---- user_schedules (legacy, kept read-only for admins/owners) ----
alter table public.user_schedules enable row level security;

drop policy if exists "Users can view own schedule" on public.user_schedules;
create policy "Users can view own schedule"
  on public.user_schedules for select
  using (auth.uid() = user_id);

drop policy if exists "Admins can view all schedules" on public.user_schedules;
create policy "Admins can view all schedules"
  on public.user_schedules for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ============================================================
-- 7. Auto-create profile on signup
-- ============================================================
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 8. To make a user an admin, run:
-- update profiles set role = 'admin' where email = 'admin@example.com';
--
-- Санал болгож буй жишээ Programs (сонголтоор ажиллуулж болно):
-- insert into public.programs (name, start_time, end_time, type) values
--   ('1-р хөтөлбөр', '14:00', '16:00', 'practice'),
--   ('2-р хөтөлбөр', '16:00', '18:00', 'practice'),
--   ('3-р хөтөлбөр', '18:00', '20:00', 'practice');
-- ============================================================