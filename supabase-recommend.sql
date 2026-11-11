-- 华炬 Skill 集市：外部技能推荐表（在 Supabase → SQL Editor 里整段粘贴运行一次）
create table if not exists public.recommendations (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  recommender text not null check (char_length(recommender) between 1 and 20),
  skill       text not null check (char_length(skill) between 1 and 60),
  link        text not null check (char_length(link) <= 300 and link ~* '^https?://'),
  author      text check (char_length(author) <= 40),
  license     text check (char_length(license) <= 20),
  note        text check (char_length(note) <= 200),
  needs_account boolean not null default false
);

alter table public.recommendations enable row level security;

drop policy if exists "rec_read"   on public.recommendations;
drop policy if exists "rec_insert" on public.recommendations;
create policy "rec_read"   on public.recommendations for select to anon using (true);
create policy "rec_insert" on public.recommendations for insert to anon with check (true);
