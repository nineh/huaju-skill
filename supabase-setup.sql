-- 华炬 Skill 集市：报名表（在 Supabase → SQL Editor 里整段粘贴运行一次）
create table if not exists public.signups (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name       text not null check (char_length(name)  between 1 and 20),
  skill      text not null check (char_length(skill) between 1 and 60),
  intro      text check (char_length(intro) <= 200),
  tools      text check (char_length(tools) <= 30),
  link       text check (char_length(link)  <= 300 and (link = '' or link ~* '^https?://'))
);

alter table public.signups enable row level security;

-- 任何人可以查看、可以新增；不能修改、不能删除（修改和删除请在 Supabase 后台操作）
drop policy if exists "signups_read"   on public.signups;
drop policy if exists "signups_insert" on public.signups;
create policy "signups_read"   on public.signups for select to anon using (true);
create policy "signups_insert" on public.signups for insert to anon with check (true);
