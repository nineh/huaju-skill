-- 华炬 Skill 集市：技能库（借鉴 iflytek/skillhub 的目录、发布、审核、版本、评分、收藏、操作记录）
-- 用法：在 Supabase → SQL Editor 里整段粘贴运行一次；以后升级时可重复运行，不会删除数据。
-- 运行后：
--   1. 把下面 hub_settings 里的邮箱后缀改成所里的（默认 huajulaw.com）
--   2. 在 hub_admins 里加入管理员邮箱：insert into public.hub_admins(email) values ('你的邮箱@huajulaw.com');
--   3. 再运行一次 supabase-hub-seed.sql，导入现有技能

-- ========== 设置与身份 ==========
create table if not exists public.hub_settings (
  key   text primary key,
  value text not null
);
insert into public.hub_settings(key, value) values ('email_domain', 'huajulaw.com')
on conflict (key) do nothing;
alter table public.hub_settings enable row level security;
drop policy if exists "settings_read" on public.hub_settings;
create policy "settings_read" on public.hub_settings for select to anon, authenticated using (true);

create table if not exists public.hub_admins (
  email text primary key check (email = lower(email))
);
alter table public.hub_admins enable row level security;
drop policy if exists "admins_self" on public.hub_admins;
create policy "admins_self" on public.hub_admins for select to authenticated
  using (email = lower(auth.jwt() ->> 'email'));

create or replace function public.hub_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

-- 所内同事：登录邮箱以所里的后缀结尾
create or replace function public.hub_is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from hub_settings s where s.key = 'email_domain'
      and public.hub_email() like '%@' || lower(s.value)
  );
$$;

create or replace function public.hub_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.hub_is_staff() and exists (select 1 from hub_admins a where a.email = public.hub_email());
$$;
grant execute on function public.hub_is_staff() to anon, authenticated;
grant execute on function public.hub_is_admin() to anon, authenticated;

-- 只允许所里邮箱注册（验证码登录时自动注册）
create or replace function public.hub_check_email_domain() returns trigger
language plpgsql security definer set search_path = public as $$
declare d text;
begin
  select lower(value) into d from hub_settings where key = 'email_domain';
  if d is not null and lower(coalesce(new.email, '')) not like '%@' || d then
    raise exception '只允许 @% 邮箱登录', d;
  end if;
  return new;
end $$;
drop trigger if exists hub_email_domain on auth.users;
create trigger hub_email_domain before insert on auth.users
  for each row execute function public.hub_check_email_domain();

-- ========== 技能与版本 ==========
create table if not exists public.hub_skills (
  id             bigint generated always as identity primary key,
  slug           text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' and char_length(slug) <= 64),
  display_name   text not null check (char_length(display_name) between 1 and 60),
  summary        text check (char_length(summary) <= 200),
  category       text not null default '工具' check (char_length(category) between 1 and 20),
  source         text not null default '所内' check (source in ('所内', '开源')),
  author         text not null check (char_length(author) between 1 and 40),
  license        text check (char_length(license) <= 40),
  source_url     text check (source_url is null or (char_length(source_url) <= 300 and source_url ~* '^https?://')),
  detail_url     text check (detail_url is null or char_length(detail_url) <= 300),
  visibility     text not null default 'public' check (visibility in ('public', 'internal')),
  status         text not null default 'pending' check (status in ('pending', 'published', 'hidden')),
  owner_id       uuid references auth.users(id) on delete set null,
  owner_email    text,
  latest_version text,
  download_count integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.hub_versions (
  id              bigint generated always as identity primary key,
  skill_id        bigint not null references public.hub_skills(id) on delete cascade,
  version         text not null check (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  changelog       text check (char_length(changelog) <= 500),
  skill_md        text not null check (char_length(skill_md) <= 100000),
  files           jsonb not null default '[]'::jsonb,
  meta            jsonb not null default '{}'::jsonb,   -- 提交时填写的展示信息，审核通过后才覆盖技能卡片
  storage_path    text,                                 -- 网页上传的包（存储桶 hub-packages）
  static_url      text,                                 -- 网站自带的包（downloads/ 目录）
  size_bytes      integer,
  status          text not null default 'pending' check (status in ('pending', 'published', 'rejected', 'withdrawn')),
  submitted_by    uuid references auth.users(id) on delete set null,
  submitted_email text,
  reviewed_email  text,
  review_note     text check (char_length(review_note) <= 300),
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (skill_id, version)
);
create index if not exists hub_versions_skill on public.hub_versions(skill_id);

create table if not exists public.hub_stars (
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  skill_id   bigint not null references public.hub_skills(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);

create table if not exists public.hub_ratings (
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  skill_id   bigint not null references public.hub_skills(id) on delete cascade,
  score      smallint not null check (score between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);

create table if not exists public.hub_audit (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  actor_email text,
  action      text not null,
  target      text,
  detail      jsonb
);

alter table public.hub_skills   enable row level security;
alter table public.hub_versions enable row level security;
alter table public.hub_stars    enable row level security;
alter table public.hub_ratings  enable row level security;
alter table public.hub_audit    enable row level security;

-- 技能卡片：已上架的所有人可见（所内专用的也显示卡片，但内容和下载要登录）
drop policy if exists "skills_read" on public.hub_skills;
create policy "skills_read" on public.hub_skills for select to anon, authenticated
  using (status = 'published' or owner_id = auth.uid() or public.hub_is_admin());

-- 版本内容（SKILL.md、文件列表、下载）：公开技能所有人可见；所内专用技能仅所内同事可见
drop policy if exists "versions_read" on public.hub_versions;
create policy "versions_read" on public.hub_versions for select to anon, authenticated
  using (
    (status = 'published' and exists (
      select 1 from public.hub_skills s where s.id = skill_id and s.status = 'published'
        and (s.visibility = 'public' or public.hub_is_staff())))
    or submitted_by = auth.uid()
    or public.hub_is_admin()
  );

drop policy if exists "stars_read" on public.hub_stars;
drop policy if exists "stars_write" on public.hub_stars;
drop policy if exists "stars_delete" on public.hub_stars;
create policy "stars_read"   on public.hub_stars for select to authenticated using (user_id = auth.uid());
create policy "stars_write"  on public.hub_stars for insert to authenticated with check (user_id = auth.uid() and public.hub_is_staff());
create policy "stars_delete" on public.hub_stars for delete to authenticated using (user_id = auth.uid());

drop policy if exists "ratings_read" on public.hub_ratings;
drop policy if exists "ratings_insert" on public.hub_ratings;
drop policy if exists "ratings_update" on public.hub_ratings;
create policy "ratings_read"   on public.hub_ratings for select to authenticated using (user_id = auth.uid());
create policy "ratings_insert" on public.hub_ratings for insert to authenticated with check (user_id = auth.uid() and public.hub_is_staff());
create policy "ratings_update" on public.hub_ratings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "audit_read" on public.hub_audit;
create policy "audit_read" on public.hub_audit for select to authenticated using (public.hub_is_admin());

-- 评分、收藏的汇总数字（不暴露谁评了分）
create or replace function public.hub_skill_stats()
returns table (skill_id bigint, rating_avg numeric, rating_count bigint, star_count bigint)
language sql stable security definer set search_path = public as $$
  select s.id,
         (select round(avg(r.score)::numeric, 1) from hub_ratings r where r.skill_id = s.id),
         (select count(*) from hub_ratings r where r.skill_id = s.id),
         (select count(*) from hub_stars t where t.skill_id = s.id)
  from hub_skills s;
$$;
grant execute on function public.hub_skill_stats() to anon, authenticated;

drop view if exists public.hub_catalog;
create view public.hub_catalog with (security_invoker = true) as
select s.id, s.slug, s.display_name, s.summary, s.category, s.source, s.author, s.license,
       s.source_url, s.detail_url, s.visibility, s.status, s.owner_id, s.latest_version,
       s.download_count, s.created_at, s.updated_at,
       coalesce(x.rating_avg, 0) as rating_avg, coalesce(x.rating_count, 0) as rating_count,
       coalesce(x.star_count, 0) as star_count
from public.hub_skills s
left join public.hub_skill_stats() x on x.skill_id = s.id;
grant select on public.hub_catalog to anon, authenticated;

-- ========== 操作（全部经由下面的函数，便于校验和留痕） ==========
create or replace function public.hub_log(p_action text, p_target text, p_detail jsonb default null)
returns void language sql security definer set search_path = public as $$
  insert into hub_audit(actor_email, action, target, detail) values (public.hub_email(), p_action, p_target, p_detail);
$$;
revoke execute on function public.hub_log(text, text, jsonb) from public, anon, authenticated;

create or replace function public.hub_semver(v text) returns int[]
language sql immutable as $$ select string_to_array(v, '.')::int[] $$;

-- 提交技能（新技能或新版本），进入待审核
create or replace function public.hub_submit(
  p_slug text, p_version text, p_skill_md text, p_files jsonb, p_storage_path text, p_size integer,
  p_display_name text, p_summary text, p_category text, p_author text,
  p_visibility text default 'public', p_license text default null, p_changelog text default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  sk hub_skills%rowtype;
  vid bigint;
  latest text;
begin
  if not public.hub_is_staff() then raise exception '请先用所里邮箱登录'; end if;
  if p_storage_path is null or split_part(p_storage_path, '/', 1) <> auth.uid()::text then
    raise exception '技能包路径不正确';
  end if;
  if p_visibility not in ('public', 'internal') then raise exception '可见范围不正确'; end if;
  if coalesce(trim(p_display_name), '') = '' or coalesce(trim(p_author), '') = '' then
    raise exception '请填写技能名称和作者';
  end if;

  select * into sk from hub_skills where slug = p_slug for update;
  if not found then
    insert into hub_skills(slug, display_name, summary, category, author, license, visibility, status, owner_id, owner_email)
    values (p_slug, trim(p_display_name), nullif(trim(p_summary), ''), coalesce(nullif(trim(p_category), ''), '工具'),
            trim(p_author), nullif(trim(p_license), ''), p_visibility, 'pending', auth.uid(), public.hub_email())
    returning * into sk;
  else
    if sk.owner_id is distinct from auth.uid() and not public.hub_is_admin() then
      raise exception '技能标识 % 已被占用，只有它的作者能发布新版本', p_slug;
    end if;
    if exists (select 1 from hub_versions where skill_id = sk.id and version = p_version) then
      raise exception '版本号 % 已经用过（含被驳回或撤回的），请换一个更大的版本号', p_version;
    end if;
    if exists (select 1 from hub_versions where skill_id = sk.id and status = 'pending') then
      raise exception '这个技能已有一个版本在等待审核，请等审核完成或先撤回';
    end if;
    select version into latest from hub_versions where skill_id = sk.id and status in ('published', 'pending')
      order by public.hub_semver(version) desc limit 1;
    if latest is not null and public.hub_semver(p_version) <= public.hub_semver(latest) then
      raise exception '版本号要大于当前版本 %', latest;
    end if;
  end if;

  insert into hub_versions(skill_id, version, changelog, skill_md, files, meta, storage_path, size_bytes, status, submitted_by, submitted_email)
  values (sk.id, p_version, nullif(trim(p_changelog), ''), p_skill_md, coalesce(p_files, '[]'::jsonb),
          jsonb_build_object('display_name', trim(p_display_name), 'summary', nullif(trim(p_summary), ''),
                             'category', coalesce(nullif(trim(p_category), ''), '工具'), 'author', trim(p_author),
                             'license', nullif(trim(p_license), ''), 'visibility', p_visibility),
          p_storage_path, p_size, 'pending', auth.uid(), public.hub_email())
  returning id into vid;

  perform public.hub_log('submit', p_slug || '@' || p_version, jsonb_build_object('version_id', vid));
  return vid;
end $$;
revoke execute on function public.hub_submit(text, text, text, jsonb, text, integer, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.hub_submit(text, text, text, jsonb, text, integer, text, text, text, text, text, text, text) to authenticated;

-- 作者撤回待审核的版本
create or replace function public.hub_withdraw(p_version_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v hub_versions%rowtype; s text;
begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  select * into v from hub_versions where id = p_version_id for update;
  if not found or (v.submitted_by is distinct from auth.uid() and not public.hub_is_admin()) then raise exception '找不到这个版本'; end if;
  if v.status <> 'pending' then raise exception '只能撤回待审核的版本'; end if;
  update hub_versions set status = 'withdrawn' where id = p_version_id;
  select slug into s from hub_skills where id = v.skill_id;
  perform public.hub_log('withdraw', s || '@' || v.version, null);
end $$;
revoke execute on function public.hub_withdraw(bigint) from public, anon;
grant execute on function public.hub_withdraw(bigint) to authenticated;

-- 管理员审核：通过后上架并更新卡片信息；驳回需写理由
create or replace function public.hub_review(p_version_id bigint, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v hub_versions%rowtype; sk hub_skills%rowtype; m jsonb;
begin
  if not public.hub_is_admin() then raise exception '只有管理员能审核'; end if;
  select * into v from hub_versions where id = p_version_id for update;
  if not found or v.status <> 'pending' then raise exception '这个版本不在待审核状态'; end if;
  select * into sk from hub_skills where id = v.skill_id for update;
  if not p_approve and coalesce(trim(p_note), '') = '' then raise exception '驳回请写明理由'; end if;

  update hub_versions set status = case when p_approve then 'published' else 'rejected' end,
    reviewed_email = public.hub_email(), review_note = nullif(trim(p_note), ''), reviewed_at = now()
  where id = p_version_id;

  if p_approve then
    m := v.meta;
    update hub_skills set
      display_name = coalesce(m ->> 'display_name', display_name),
      summary      = m ->> 'summary',
      category     = coalesce(m ->> 'category', category),
      author       = coalesce(m ->> 'author', author),
      license      = m ->> 'license',
      visibility   = coalesce(m ->> 'visibility', visibility),
      latest_version = case when latest_version is null or public.hub_semver(v.version) > public.hub_semver(latest_version)
                            then v.version else latest_version end,
      status       = case when status = 'hidden' then 'hidden' else 'published' end,
      updated_at   = now()
    where id = sk.id;
  end if;
  perform public.hub_log(case when p_approve then 'approve' else 'reject' end, sk.slug || '@' || v.version,
                         jsonb_build_object('note', p_note));
end $$;
revoke execute on function public.hub_review(bigint, boolean, text) from public, anon;
grant execute on function public.hub_review(bigint, boolean, text) to authenticated;

-- 管理员下架 / 重新上架
create or replace function public.hub_set_status(p_slug text, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.hub_is_admin() then raise exception '只有管理员能操作'; end if;
  if p_status not in ('published', 'hidden') then raise exception '状态不正确'; end if;
  if p_status = 'published' and not exists (
       select 1 from hub_skills s where s.slug = p_slug and (s.latest_version is not null or s.detail_url is not null)) then
    raise exception '还没有审核通过的版本，不能上架';
  end if;
  update hub_skills set status = p_status, updated_at = now() where slug = p_slug;
  if not found then raise exception '找不到技能 %', p_slug; end if;
  perform public.hub_log(case when p_status = 'hidden' then 'hide' else 'unhide' end, p_slug, null);
end $$;
revoke execute on function public.hub_set_status(text, text) from public, anon;
grant execute on function public.hub_set_status(text, text) to authenticated;

-- 下载计数（任何人都可以调用，只加一）
create or replace function public.hub_count_download(p_slug text) returns void
language sql security definer set search_path = public as $$
  update hub_skills set download_count = download_count + 1 where slug = p_slug and status = 'published';
$$;
grant execute on function public.hub_count_download(text) to anon, authenticated;

-- ========== 文件存储：技能包 ==========
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hub-packages', 'hub-packages', false, 20971520, array['application/zip', 'application/x-zip-compressed', 'application/octet-stream'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "hub_pkg_upload" on storage.objects;
create policy "hub_pkg_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'hub-packages' and public.hub_is_staff() and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "hub_pkg_delete" on storage.objects;
create policy "hub_pkg_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'hub-packages' and (storage.foldername(name))[1] = auth.uid()::text
         and not exists (select 1 from public.hub_versions v where v.storage_path = storage.objects.name));

drop policy if exists "hub_pkg_read" on storage.objects;
create policy "hub_pkg_read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'hub-packages' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.hub_is_admin()
    or exists (select 1 from public.hub_versions v join public.hub_skills s on s.id = v.skill_id
               where v.storage_path = storage.objects.name and v.status = 'published' and s.status = 'published'
                 and (s.visibility = 'public' or public.hub_is_staff()))
  ));
