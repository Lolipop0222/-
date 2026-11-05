-- ┌──────────────────────────────────────────────────────────────────────
-- │ 05-storage.sql — 사진 프로필·프린트 아카이브 (Supabase Storage)·관리자 사진 검토/계정 삭제
-- │ 실행 순서: supabase/parts의 번호 순. 이 파일 앞에 필요한 것: 01~04
-- │ 여러 번 실행해도 안전하다(idempotent). 바뀐 파일만 SQL Editor에 붙여넣고 Run.
-- │ 고치면 `npm run schema`로 supabase/schema.sql(전체본)을 다시 만든다.
-- └──────────────────────────────────────────────────────────────────────

-- ═════════════════════════ 사진 프로필 · 프린트 아카이브 (Supabase Storage) ═════════════════════════
-- 파일은 Supabase Storage 버킷 두 개에 둔다.
--   avatars (공개): 학생 프로필 사진. 경로 = '<내 user id>/<무작위 16자>.webp|jpg'. 앱이 320px로 줄이고 사진 정보(위치 등)를 지운 뒤 올린다.
--   prints  (비공개): 관리자가 올리는 수행평가 자료·학습지. 가입한 학생만 열 수 있고(서명된 주소), 올리기·지우기는 관리자만.
-- 부적절한 사진은 관리자가 내리거나(admin_remove_avatar) 계정을 지운다(admin_delete_user).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 307200, array['image/webp', 'image/jpeg'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prints', 'prints', false, 52428800, null)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- avatars: 내 폴더에만 올리고 지운다. 관리자는 아무 사진이나 지울 수 있다. (공개 주소로 보기는 정책 없이 된다)
drop policy if exists "프로필 사진 올리기" on storage.objects;
create policy "프로필 사진 올리기" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
              and storage.extension(name) in ('webp', 'jpg')
              and exists (select 1 from public.profiles where id = auth.uid()));
drop policy if exists "프로필 사진 목록" on storage.objects;
create policy "프로필 사진 목록" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "프로필 사진 지우기" on storage.objects;
create policy "프로필 사진 지우기" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- prints: 프로필이 있는(초대코드로 가입한) 학생만 열기, 관리자만 올리기·지우기
drop policy if exists "프린트 보기" on storage.objects;
create policy "프린트 보기" on storage.objects for select to authenticated
  using (bucket_id = 'prints' and exists (select 1 from public.profiles where id = auth.uid()));
drop policy if exists "프린트 올리기" on storage.objects;
create policy "프린트 올리기" on storage.objects for insert to authenticated
  with check (bucket_id = 'prints' and public.is_admin());
drop policy if exists "프린트 지우기" on storage.objects;
create policy "프린트 지우기" on storage.objects for delete to authenticated
  using (bucket_id = 'prints' and public.is_admin());

-- 관리자: 사진 프로필 목록 (최근에 바꾼 순)
create or replace function admin_list_photos()
returns table (nickname text, grade int, class_no int, avatar text, avatar_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception '관리자만 볼 수 있어요';
  end if;
  return query
    select p.nickname, p.grade, p.class_no, p.avatar, p.avatar_at
    from profiles p where p.avatar like 'photo:%'
    order by p.avatar_at desc nulls last
    limit 300;
end $$;

-- 관리자: 사진 내리기 → 내린 사진 경로를 돌려준다 (앱이 저장소에서 파일도 지운다)
create or replace function admin_remove_avatar(p_nickname text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  old text;
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있어요';
  end if;
  select avatar into old from profiles where nickname = p_nickname;
  if not found then
    raise exception '그 닉네임의 학생이 없어요';
  end if;
  update profiles set avatar = null where nickname = p_nickname;
  return case when old like 'photo:%' then substr(old, 7) else null end;
end $$;

-- 관리자: 계정 삭제 (부적절한 사진 등). 관리자 계정은 지울 수 없다. 공부 기록·칭호 등 모두 함께 삭제
create or replace function admin_delete_user(p_nickname text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid;
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있어요';
  end if;
  select id into uid from profiles where nickname = p_nickname;
  if uid is null then
    raise exception '그 닉네임의 학생이 없어요';
  end if;
  if exists (select 1 from admins where user_id = uid) then
    raise exception '관리자 계정은 여기서 지울 수 없어요';
  end if;
  delete from auth.users where id = uid;
end $$;

-- ───────────────────────── 프린트 아카이브 ─────────────────────────
create table if not exists prints (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(trim(title)) between 1 and 80),
  category   text not null default '학습지' check (category in ('수행평가', '학습지', '시험 대비', '기타')),
  subject    text check (subject in ('국어', '영어', '수학', '과학', '사회', '한국사', '기타')),  -- null = 공통
  grade      int check (grade between 1 and 3),                                                   -- null = 전 학년
  memo       text check (char_length(memo) <= 300),
  file_path  text not null unique check (file_path ~ '^[0-9a-f-]{36}\.[a-z0-9]{1,5}$'),            -- prints 버킷 안 경로
  file_name  text not null check (char_length(file_name) between 1 and 200),                      -- 내려받을 때 이름
  file_size  bigint not null default 0 check (file_size >= 0),
  mime       text,
  created_by uuid default auth.uid() references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists prints_created_idx on prints (created_at desc);
alter table prints enable row level security;
revoke all on prints from anon;
drop policy if exists "프린트 목록" on prints;
create policy "프린트 목록" on prints for select to authenticated
  using (exists (select 1 from profiles where id = auth.uid()));
drop policy if exists "프린트 추가" on prints;
create policy "프린트 추가" on prints for insert to authenticated with check (is_admin());
drop policy if exists "프린트 수정" on prints;
create policy "프린트 수정" on prints for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "프린트 삭제" on prints;
create policy "프린트 삭제" on prints for delete to authenticated using (is_admin());

revoke execute on function admin_list_photos() from public, anon;
revoke execute on function admin_remove_avatar(text) from public, anon;
revoke execute on function admin_delete_user(text) from public, anon;
grant execute on function admin_list_photos() to authenticated;
grant execute on function admin_remove_avatar(text) to authenticated;
grant execute on function admin_delete_user(text) to authenticated;
