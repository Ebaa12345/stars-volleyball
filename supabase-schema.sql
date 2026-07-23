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
-- @deprecated day_schedule (доор) -ээр солигдсон, зөвхөн хуучин өгөгдөл унших зорилгоор үлдсэн.
alter table public.programs add column if not exists days_of_week integer[] not null default '{}';

-- Бүтэн сарын хуанлиас admin шууд дарж сонгосон тодорхой огноонууд
-- (жишээ нь зөвхөн 7-р сарын 3, 10, 24-нд л хамаарах бол). 'YYYY-MM-DD' форматтай.
-- @deprecated date_schedule (доор) -ээр солигдсон, зөвхөн хуучин өгөгдөл унших зорилгоор үлдсэн.
alter table public.programs add column if not exists specific_dates text[] not null default '{}';

-- Долоо хоногт давтагдах өдрүүд — ӨДӨР ТУС БҮР өөрийн гэсэн цагтай:
--   [{ "day": 1, "start_time": "18:00", "end_time": "20:00" }, ...]  (0=Ням...6=Бямба)
alter table public.programs add column if not exists day_schedule jsonb not null default '[]';

-- Хуучин days_of_week массивт байсан өгөгдлийг (байвал, нэг л удаа) day_schedule руу
-- шилжүүлж, Program-ий ерөнхий start_time/end_time-г анхны утга болгож өгнө.
update public.programs
set day_schedule = (
  select coalesce(jsonb_agg(jsonb_build_object('day', d, 'start_time', start_time, 'end_time', end_time)), '[]'::jsonb)
  from unnest(days_of_week) as d
)
where days_of_week is not null and array_length(days_of_week, 1) > 0
  and (day_schedule is null or day_schedule = '[]'::jsonb);

-- Тодорхой огноонууд — ОГНОО ТУС БҮР өөрийн гэсэн цагтай:
--   [{ "date": "2026-07-03", "start_time": "18:00", "end_time": "20:00" }, ...]
alter table public.programs add column if not exists date_schedule jsonb not null default '[]';

-- Хуучин specific_dates массивт байсан өгөгдлийг (байвал, нэг л удаа) date_schedule руу
-- шилжүүлж, Program-ий ерөнхий start_time/end_time-г анхны утга болгож өгнө.
update public.programs
set date_schedule = (
  select coalesce(jsonb_agg(jsonb_build_object('date', d, 'start_time', start_time, 'end_time', end_time)), '[]'::jsonb)
  from unnest(specific_dates) as d
)
where specific_dates is not null and array_length(specific_dates, 1) > 0
  and (date_schedule is null or date_schedule = '[]'::jsonb);

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

-- Админ эсэхийг шалгах туслах функц. RLS policy дотор ШУУД
-- "exists (select 1 from public.profiles where id=auth.uid() and role='admin')"
-- гэж бичвэл, тухайн policy profiles ХҮСНЭГТ ДЭЭР Ч байвал — уг exists
-- дэд query нь profiles-ийг дахин уншина, энэ нь profiles-ийн SELECT
-- policy-г (үүнд ЯГ ЭНЭ policy өөрөө ч орно) дахин ажиллуулна, энэ нь
-- дахин profiles уншина... гэх мэтчилэн ТӨГСГӨЛГҮЙ ЭРГЭЛДЭЖ
-- ("infinite recursion detected in policy") сервер 500 алдаа өгдөг.
-- SECURITY DEFINER функц дотор ижил query бичвэл тэр дэд query RLS-г
-- бүрэн алгасдаг (bypass) тул recursion огт үүсэхгүй. Иймд БҮХ policy-д
-- "exists(...)" оронд энэ функцийг ашиглана.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated, anon;

-- ---- profiles ----
alter table public.profiles enable row level security;

-- ЗАСВАР: "using (true)" тул хэн ч (нэвтрээгүй хүн хүртэл) бүх хэрэглэгчийн
-- email-ийг агуулсан profiles мөр бүрийг шууд уншиж чадаж байсан (өгөгдлийн
-- алдагдал). Одооноос зөвхөн өөрийн мөрөө болон admin бүх мөрийг уншиж чадна.
-- Нэвтрээгүй зочдод зориулсан "аюулгүй" (email-гүй) Team жагсаалтыг доорх
-- get_public_team_members() функцээр дамжуулна.
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
  on public.profiles for update
  using (public.is_admin());

drop policy if exists "Admins can delete profiles" on public.profiles;
create policy "Admins can delete profiles"
  on public.profiles for delete
  using (public.is_admin());

-- ЗАСВАР: "Users can update own profile" policy нь ЗӨВХӨН мөрийн ЭЗЭМШЛИЙГ
-- шалгадаг (auth.uid() = id), гэхдээ АЛЬ БАГАНЫГ өөрчилж болохыг хязгаарладаггүй
-- байсан тул хэн ч browser devtools-оор шууд
-- `update profiles set role='admin' where id=auth.uid()` гэж бичээд өөрийгөө
-- admin болгож чаддаг байсан ноцтой цоорхой. Энэ trigger role баганыг зөвхөн
-- admin өөрчилж болохоор хамгаална (бусад баганад нөлөөлөхгүй).
create or replace function public.prevent_role_self_escalation()
returns trigger as $$
begin
  if new.role is distinct from old.role then
    -- auth.uid() зөвхөн бодит client (browser/app) session-с ирсэн хүсэлтэд
    -- утгатай байдаг. SQL Editor дээрээс шууд "update profiles set
    -- role='admin' ..." гэж ажиллуулахад auth.uid() NULL байна (зөвхөн
    -- project owner хандах боломжтой SQL Editor нь итгэмжлэгдсэн орчин тул
    -- энэ шалгалтыг тэнд алгасна) — эс тэгвээс ЭХНИЙ admin-г хэзээ ч
    -- SQL-ээр үүсгэж чадахгүй хэвээр гацах зөрчилдөөнд (chicken-and-egg)
    -- орно (admin болгохын тулд admin байх шаардлагатай гэсэн мухардал).
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'Зөвхөн admin эрх бүхий хэрэглэгч role-ийг өөрчилж чадна.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists prevent_role_self_escalation on public.profiles;
create trigger prevent_role_self_escalation
  before update on public.profiles
  for each row execute procedure public.prevent_role_self_escalation();

-- ---- programs ----
alter table public.programs enable row level security;

drop policy if exists "Programs are viewable by everyone" on public.programs;
create policy "Programs are viewable by everyone"
  on public.programs for select using (true);

drop policy if exists "Admins can manage programs" on public.programs;
create policy "Admins can manage programs"
  on public.programs for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---- session_assignments ----
alter table public.session_assignments enable row level security;

drop policy if exists "Users can view own assignments" on public.session_assignments;
create policy "Users can view own assignments"
  on public.session_assignments for select
  using (auth.uid() = user_id);

drop policy if exists "Admins can manage all assignments" on public.session_assignments;
create policy "Admins can manage all assignments"
  on public.session_assignments for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---- attendance ----
alter table public.attendance enable row level security;

drop policy if exists "Users can view own attendance" on public.attendance;
create policy "Users can view own attendance"
  on public.attendance for select
  using (auth.uid() = user_id);

drop policy if exists "Admins can manage all attendance" on public.attendance;
create policy "Admins can manage all attendance"
  on public.attendance for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---- user_schedules (legacy, kept read-only for admins/owners) ----
alter table public.user_schedules enable row level security;

drop policy if exists "Users can view own schedule" on public.user_schedules;
create policy "Users can view own schedule"
  on public.user_schedules for select
  using (auth.uid() = user_id);

drop policy if exists "Admins can view all schedules" on public.user_schedules;
create policy "Admins can view all schedules"
  on public.user_schedules for select
  using (public.is_admin());

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
-- 8. Admin-аас хэрэглэгчийг ЭЦСИЙН БАЙДЛААР устгах (auth.users талаас нь).
--    Edge Function ШААРДАХГҮЙ — зөвхөн SQL "security definer" функц
--    ашиглана (энэ нь функцийг үүсгэсэн "postgres" роль-ийн эрхээр
--    ажилладаг тул auth.users хүснэгтэд хүрч чаддаг, харин client
--    (anon/authenticated) роль өөрөө auth.users-д шууд хүрч чадахгүй).
--    auth.users-ээс устгахад profiles мөр нь (FK ... on delete cascade)
--    автоматаар дагаад устдаг тул session_assignments/attendance ч мөн
--    цэвэрлэгдэнэ — тусад нь устгах шаардлагагүй.
-- ============================================================
create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Зөвхөн admin эрхтэй, нэвтэрсэн хэрэглэгч дуудаж болно
  if not public.is_admin() then
    raise exception 'Зөвхөн admin энэ үйлдлийг хийх боломжтой.';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Өөрийгөө устгах боломжгүй.';
  end if;

  delete from auth.users where id = target_user_id;
end;
$$;

grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ============================================================
-- 9. Тоглогч/дасгалжуулагчийн зургийг хадгалах Storage bucket.
--    Admin.tsx-ийн профайл засах хэсгээс компьютер/утаснаас (камер эсвэл
--    галерей) шууд зураг сонгож upload хийх боломж олгоно.
--    Bucket public тул зургийг хэн ч (нэвтрээгүй ч гэсэн) харж чадна,
--    харин зөвхөн admin эрхтэй хэрэглэгч upload/солих/устгах хийж чадна.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly viewable" on storage.objects;
create policy "Avatar images are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Admins can upload avatars" on storage.objects;
create policy "Admins can upload avatars"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and public.is_admin());

drop policy if exists "Admins can update avatars" on storage.objects;
create policy "Admins can update avatars"
  on storage.objects for update
  using (bucket_id = 'avatars' and public.is_admin());

drop policy if exists "Admins can delete avatars" on storage.objects;
create policy "Admins can delete avatars"
  on storage.objects for delete
  using (bucket_id = 'avatars' and public.is_admin());

-- ============================================================
-- 10. Admin.tsx-ийн "Санах хэмжээ" мэдээллийн самбарт харуулах зорилгоор,
--     нийт database-ийн одоогийн хэрэглэж буй хэмжээг (byte-аар) буцаана.
--     Зөвхөн admin эрхтэй хэрэглэгч дуудаж болно. Supabase Free (Nano) tier
--     дээр санал болгож буй дээд хэмжээ 500 MB тул клиент талд үүнтэй харьцуулж
--     хувиар (%) харуулна.
-- ============================================================
create or replace function public.admin_get_db_size()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Зөвхөн admin энэ мэдээллийг харах боломжтой.';
  end if;

  return pg_database_size(current_database());
end;
$$;

grant execute on function public.admin_get_db_size() to authenticated;

-- ============================================================
-- 11. Contact.tsx-ийн "Санал хүсэлт" форм — EmailJS-ээр бодит и-мэйл рүү
--     явуулахаас гадна, Admin панелд ч харагдаж байхын тулд Supabase-д мөн
--     хадгална. Нэвтрээгүй зочин (anon) ч мессеж илгээж чадах ёстой тул
--     insert public, харин select/delete зөвхөн admin эрхтэй.
-- ============================================================
create table if not exists public.contact_messages (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz default now()
);

alter table public.contact_messages enable row level security;

drop policy if exists "Anyone can submit a contact message" on public.contact_messages;
create policy "Anyone can submit a contact message"
  on public.contact_messages for insert
  with check (true);

drop policy if exists "Admins can view contact messages" on public.contact_messages;
create policy "Admins can view contact messages"
  on public.contact_messages for select
  using (public.is_admin());

drop policy if exists "Admins can update contact messages" on public.contact_messages;
create policy "Admins can update contact messages"
  on public.contact_messages for update
  using (public.is_admin());

drop policy if exists "Admins can delete contact messages" on public.contact_messages;
create policy "Admins can delete contact messages"
  on public.contact_messages for delete
  using (public.is_admin());

-- ============================================================
-- 12. Team.tsx (нэвтрээгүй зочид ч үздэг public хуудас) дасгалжуулагчдын
--     жагсаалтыг харуулахдаа profiles хүснэгтийг шууд уншихгүй (email leak-ээс
--     сэргийлж дээрх RLS-ээр хаагдсан) — оронд нь зөвхөн аюулгүй (email-гүй)
--     талбаруудыг буцаадаг энэ функцийг ашиглана.
-- ============================================================
-- "position" нь Postgres-д function-like reserved үг тул "returns table(...)"
-- жагсаалтад ишлэлгүйгээр (bare) бичвэл syntax error өгдөг — quote хийж заслаа.
create or replace function public.get_public_team_members()
returns table (
  id uuid,
  full_name text,
  role text,
  "position" text,
  jersey_number integer,
  avatar_url text
)
language sql
security definer
set search_path = public
as $$
  select id, full_name, role, position, jersey_number, avatar_url
  from public.profiles
  where role = 'coach'
  order by full_name;
$$;

grant execute on function public.get_public_team_members() to anon, authenticated;

-- ============================================================
-- 13. To make a user an admin, run:
-- update profiles set role = 'admin' where email = 'admin@example.com';
--
-- Санал болгож буй жишээ Programs (сонголтоор ажиллуулж болно):
-- insert into public.programs (name, start_time, end_time, type) values
--   ('1-р хөтөлбөр', '14:00', '16:00', 'practice'),
--   ('2-р хөтөлбөр', '16:00', '18:00', 'practice'),
--   ('3-р хөтөлбөр', '18:00', '20:00', 'practice');
-- ============================================================
