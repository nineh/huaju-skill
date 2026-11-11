-- 华炬 Skill 集市：访问统计（在 Supabase → SQL Editor 里整段粘贴运行一次）
create table if not exists public.page_views (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  path       text check (char_length(path) <= 200),
  vid        text check (char_length(vid) <= 40)
);
alter table public.page_views enable row level security;
drop policy if exists "pv_insert" on public.page_views;
create policy "pv_insert" on public.page_views for insert to anon with check (true);
-- 不开放逐条读取；只通过下面的函数给出汇总数字

create or replace function public.site_stats()
returns json language sql security definer set search_path = public as $$
  select json_build_object(
    'pv',    (select count(*) from page_views),
    'uv',    (select count(distinct vid) from page_views),
    'today', (select count(*) from page_views
              where created_at >= (date_trunc('day', now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai'))
  );
$$;
grant execute on function public.site_stats() to anon;

-- 在后台看明细时可以运行：
-- select path, count(*) as 次数, count(distinct vid) as 人数 from page_views group by path order by 次数 desc;
-- select date(created_at at time zone 'Asia/Shanghai') as 日期, count(*) as 次数, count(distinct vid) as 人数 from page_views group by 1 order by 1 desc;
