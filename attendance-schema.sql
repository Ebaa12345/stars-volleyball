-- ⚠️ ХУУЧИРСАН (deprecated): attendance table болон түүний policy-г одоо
-- supabase-schema.sql (4-р хэсэг, "Attendance") дотор бүрэн тодорхойлдог.
-- Энэ файлыг ДАХИН АЖИЛЛУУЛАХ ШААРДЛАГАГҮЙ — зөвхөн түүхийн хувьд үлдээв.
-- (Өмнө нь энэ файлын create policy-нүүд drop-if-exists-гүй байсан тул
-- supabase-schema.sql-ийг эхлээд ажиллуулсны дараа үүнийг дахин ажиллуулбал
-- "policy already exists" алдаатай зогсдог байсныг idempotent болгож заслаа.)
--
-- Ирцийн систем: attendance table

create table if not exists public.attendance (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  status text not null default 'absent' check (status in ('present', 'absent')),
  marked_by uuid references public.profiles(id),
  notes text,
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table public.attendance enable row level security;

-- Хэрэглэгч өөрийн ирцийг харна
drop policy if exists "Users can view own attendance" on attendance;
create policy "Users can view own attendance"
  on attendance for select
  using (auth.uid() = user_id);

-- Admin бүгдийг харна
drop policy if exists "Admins can view all attendance" on attendance;
create policy "Admins can view all attendance"
  on attendance for select
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Admin тэмдэглэж/засаж чадна
drop policy if exists "Admins can insert attendance" on attendance;
create policy "Admins can insert attendance"
  on attendance for insert
  with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "Admins can update attendance" on attendance;
create policy "Admins can update attendance"
  on attendance for update
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "Admins can delete attendance" on attendance;
create policy "Admins can delete attendance"
  on attendance for delete
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create index if not exists idx_attendance_user_date on attendance(user_id, date);
