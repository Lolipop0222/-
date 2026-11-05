-- ┌──────────────────────────────────────────────────────────────────────
-- │ 02-security.sql — 보안·문의함·비밀번호 찾기·계정 삭제·관리자
-- │ 실행 순서: supabase/parts의 번호 순. 이 파일 앞에 필요한 것: 01
-- │ 여러 번 실행해도 안전하다(idempotent). 바뀐 파일만 SQL Editor에 붙여넣고 Run.
-- │ 고치면 `npm run schema`로 supabase/schema.sql(전체본)을 다시 만든다.
-- └──────────────────────────────────────────────────────────────────────

-- ═════════════════════════ 보안 · 문의함 · 비밀번호 찾기 · 계정 삭제 ═════════════════════════
-- 비밀번호 해시와 무작위 코드에 쓴다 (Supabase에는 이미 extensions 스키마에 있다)
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- 설정 테이블은 앱(anon·authenticated)이 아예 건드리지 못하게 (RLS에 더해 권한도 뺀다)
revoke all on app_settings from anon, authenticated;
-- 로그인 안 한 사람(anon)은 학생 데이터 테이블에 권한 자체가 없게 (RLS 정책도 authenticated만 허용하지만 한 겹 더)
do $$
declare t text;
begin
  foreach t in array array['profiles', 'sessions', 'routines', 'tasks', 'planner_days', 'ddays'] loop
    execute format('revoke all on %I from anon', t);
  end loop;
end $$;

-- ───────────────────────── 입력 범위 제한 (데이터 폭탄 막기) ─────────────────────────
-- 날짜를 아주 먼 과거·미래로 바꿔 가며 끝없이 쌓는 것을 막는다.
create or replace function date_range_guard() returns trigger
language plpgsql set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
begin
  -- 테이블마다 열 이름이 달라서 조건을 따로 확인한다 (한 줄로 쓰면 없는 열을 읽다 오류가 난다)
  if tg_table_name = 'tasks' then
    if new.task_date not between today - 400 and today + 400 then
      raise exception '플래너 날짜는 오늘 앞뒤 400일 안에서만 쓸 수 있어요';
    end if;
  elsif tg_table_name = 'planner_days' then
    if new.day not between today - 400 and today + 400 then
      raise exception '플래너 날짜는 오늘 앞뒤 400일 안에서만 쓸 수 있어요';
    end if;
  elsif tg_table_name = 'ddays' then
    if new.target_date not between today - 400 and today + 3650 then
      raise exception '디데이 날짜를 확인해 주세요';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists tasks_date_range on tasks;
create trigger tasks_date_range before insert or update of task_date on tasks for each row execute function date_range_guard();
drop trigger if exists planner_days_date_range on planner_days;
create trigger planner_days_date_range before insert or update of day on planner_days for each row execute function date_range_guard();
drop trigger if exists ddays_date_range on ddays;
create trigger ddays_date_range before insert or update of target_date on ddays for each row execute function date_range_guard();

-- 직접 쓰는 '기타' 기록: 하루 24시간 안, 미래 금지, 하루 30개까지
create or replace function etc_session_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  -- 학생이 직접 쓰는 경우만 본다 (start_session·end_session 같은 함수 안에서는 current_user가 함수 주인)
  if new.subject <> '기타' or current_user <> 'authenticated' then
    return new;
  end if;
  if new.started_at < now() - interval '400 days' or new.started_at > now() + interval '10 minutes'
     or (new.ended_at is not null and (new.ended_at > now() + interval '10 minutes' or new.ended_at > new.started_at + interval '24 hours')) then
    raise exception '기록 시각을 확인해 주세요 (미래 시각이나 24시간이 넘는 기록은 안 돼요)';
  end if;
  if tg_op = 'INSERT' and (
    select count(*) from sessions
    where user_id = new.user_id and subject = '기타'
      and (started_at at time zone 'Asia/Seoul')::date = (new.started_at at time zone 'Asia/Seoul')::date
  ) >= 30 then
    raise exception '기타 기록은 하루 30개까지 만들 수 있어요';
  end if;
  return new;
end $$;
drop trigger if exists sessions_etc_guard on sessions;
create trigger sessions_etc_guard before insert or update on sessions for each row execute function etc_session_guard();

-- ───────────────────────── 관리자 ─────────────────────────
-- 문의 답변·복구 코드 발급을 하는 사람. 앱에서는 추가할 수 없고 SQL Editor에서만 넣는다:
--   insert into admins (user_id) select id from profiles where nickname = '내닉네임' on conflict do nothing;
create table if not exists admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table admins enable row level security;
revoke all on admins from anon, authenticated;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;

-- ───────────────────────── 문의함 ─────────────────────────
-- 학생은 내 문의만 쓰고·보고·지운다. 답변은 관리자만 (admin_reply_inquiry).
create table if not exists inquiries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references profiles (id) on delete cascade,
  category   text not null check (category in ('질문', '오류 신고', '제안', '기타')),
  body       text not null check (char_length(trim(body)) between 5 and 1000),
  reply      text check (char_length(reply) <= 1000),
  replied_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists inquiries_user_idx on inquiries (user_id, created_at);
create index if not exists inquiries_created_idx on inquiries (created_at);
alter table inquiries enable row level security;
revoke all on inquiries from anon;
drop policy if exists "내 문의 조회" on inquiries;
create policy "내 문의 조회" on inquiries for select to authenticated using (auth.uid() = user_id);
drop policy if exists "내 문의 쓰기" on inquiries;
create policy "내 문의 쓰기" on inquiries for insert to authenticated
  with check (auth.uid() = user_id and reply is null and replied_at is null);
drop policy if exists "내 문의 삭제" on inquiries;
create policy "내 문의 삭제" on inquiries for delete to authenticated using (auth.uid() = user_id);
-- 수정 정책 없음 = 보낸 문의는 고칠 수 없다 (답변 칸을 학생이 채우지 못하게)

-- 시각은 서버가 정하고, 하루 5개까지
create or replace function inquiries_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  new.created_at := now();
  if (select count(*) from inquiries where user_id = new.user_id and created_at > now() - interval '1 day') >= 5 then
    raise exception '문의는 하루 5개까지 보낼 수 있어요';
  end if;
  return new;
end $$;
drop trigger if exists inquiries_guard on inquiries;
create trigger inquiries_guard before insert on inquiries for each row execute function inquiries_guard();

create or replace function admin_list_inquiries()
returns table (id uuid, nickname text, grade int, class_no int, category text, body text, reply text, replied_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception '관리자만 볼 수 있어요';
  end if;
  return query
    select i.id, p.nickname, p.grade, p.class_no, i.category, i.body, i.reply, i.replied_at, i.created_at
    from inquiries i join profiles p on p.id = i.user_id
    order by (i.reply is null) desc, i.created_at desc
    limit 300;
end $$;

create or replace function admin_reply_inquiry(p_id uuid, p_reply text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception '관리자만 답변할 수 있어요';
  end if;
  update inquiries
  set reply = nullif(trim(p_reply), ''),
      replied_at = case when nullif(trim(p_reply), '') is null then null else now() end
  where id = p_id;
end $$;

-- ───────────────────────── 비밀번호 찾기 (복구 코드) ─────────────────────────
-- 메일 인증을 꺼 둬서(무료 메일 한도) 메일로 재설정할 수 없다. 대신 로그인했을 때 "복구 코드"를 만들어 적어 두고,
-- 비밀번호를 잊으면 이메일 + 복구 코드로 새 비밀번호를 정한다. 코드는 해시만 저장하고, 한 번 쓰면 없어진다.
-- 코드를 잃어버렸으면 관리자가 닉네임으로 새 코드를 만들어 직접 전해 준다 (admin_issue_recovery_code).
create table if not exists recovery_codes (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  code_hash  text not null,
  created_at timestamptz not null default now()
);
alter table recovery_codes enable row level security;
revoke all on recovery_codes from anon, authenticated;

-- 새 코드를 만들어 해시를 저장하고 원래 코드를 돌려준다 (앱에서는 직접 못 부름)
-- 32글자(헷갈리는 0·O·1·I 뺌) × 12자리 = 60비트. 바이트 % 32는 치우침이 없다.
create or replace function issue_recovery_code(p_user uuid) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(12);
  code text := '';
begin
  for i in 0..11 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  insert into recovery_codes (user_id, code_hash, created_at)
  values (p_user, extensions.crypt(code, extensions.gen_salt('bf', 8)), now())
  on conflict (user_id) do update set code_hash = excluded.code_hash, created_at = excluded.created_at;
  return substr(code, 1, 4) || '-' || substr(code, 5, 4) || '-' || substr(code, 9, 4);
end $$;

-- 내 복구 코드 새로 만들기 (예전 코드는 못 쓰게 된다)
create or replace function create_recovery_code() returns text
language plpgsql volatile security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = auth.uid()) then
    raise exception '프로필이 없습니다';
  end if;
  return issue_recovery_code(auth.uid());
end $$;

-- 내 복구 코드를 만든 시각 (없으면 null)
create or replace function recovery_code_created_at() returns timestamptz
language sql stable security definer set search_path = public as $$
  select created_at from recovery_codes where user_id = auth.uid()
$$;

-- 관리자: 닉네임으로 그 학생의 새 복구 코드 만들기 (학생 본인 확인은 직접 만나서)
create or replace function admin_issue_recovery_code(p_nickname text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid;
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있어요';
  end if;
  select id into uid from profiles where nickname = trim(p_nickname);
  if uid is null then
    raise exception '그 닉네임의 학생이 없어요';
  end if;
  return issue_recovery_code(uid);
end $$;

-- 이메일 + 복구 코드로 새 비밀번호 정하기 (로그인 전이라 anon도 부를 수 있다)
-- 돌려주는 값: 'ok' | 'invalid'(이메일이나 코드가 틀림 — 어느 쪽인지는 알려 주지 않는다) | 'locked'(15분에 5번 틀림) | 'weak'
-- 틀린 기록을 남겨야 하므로 오류를 던지지 않고 결과 글자를 돌려준다.
create or replace function reset_password_with_code(p_email text, p_code text, p_password text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  em   text := lower(trim(coalesce(p_email, '')));
  norm text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  uid  uuid;
  h    text;
begin
  if char_length(coalesce(p_password, '')) < 8 or octet_length(p_password) > 72 then
    return 'weak';
  end if;
  delete from security_attempts where at < now() - interval '1 day';
  if (select count(*) from security_attempts where kind = 'recovery' and subject = em and at > now() - interval '15 minutes') >= 5 then
    return 'locked';
  end if;

  select u.id into uid from auth.users u where lower(u.email) = em;
  select c.code_hash into h from recovery_codes c where c.user_id = uid;
  -- 코드가 없을 때도 같은 시간이 걸리게 한 번 계산한다 (응답 시간으로 가입 여부를 알 수 없게)
  if h is null then
    perform extensions.crypt(norm, extensions.gen_salt('bf', 8));
  end if;
  if h is null or extensions.crypt(norm, h) <> h then
    insert into security_attempts (kind, subject) values ('recovery', em);
    return 'invalid';
  end if;

  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)), updated_at = now()
  where id = uid;
  delete from auth.sessions where user_id = uid;   -- 다른 기기에서 로그인된 것도 모두 끊는다
  delete from recovery_codes where user_id = uid;  -- 한 번 쓴 코드는 버린다
  delete from security_attempts where kind = 'recovery' and subject = em;
  return 'ok';
end $$;

-- ───────────────────────── 계정 삭제 ─────────────────────────
-- 로그인 계정(auth.users)을 지우면 프로필 → 공부 기록·플래너·디데이·문의·복구 코드가 모두 함께 지워진다 (on delete cascade).
create or replace function delete_my_account() returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

-- ───────────────────────── 함수 실행 권한 ─────────────────────────
-- Supabase는 새 함수를 누구나(anon 포함) 부를 수 있게 만든다 → 하나하나 정한다.
revoke execute on function issue_recovery_code(uuid) from public, anon, authenticated;
revoke execute on function date_range_guard() from public, anon, authenticated;
revoke execute on function etc_session_guard() from public, anon, authenticated;
revoke execute on function inquiries_guard() from public, anon, authenticated;
revoke execute on function planner_limits() from public, anon, authenticated;
revoke execute on function ddays_limit() from public, anon, authenticated;

revoke execute on function is_admin() from public, anon;
revoke execute on function admin_list_inquiries() from public, anon;
revoke execute on function admin_reply_inquiry(uuid, text) from public, anon;
revoke execute on function admin_issue_recovery_code(text) from public, anon;
revoke execute on function create_recovery_code() from public, anon;
revoke execute on function recovery_code_created_at() from public, anon;
revoke execute on function delete_my_account() from public, anon;
grant execute on function is_admin() to authenticated;
grant execute on function admin_list_inquiries() to authenticated;
grant execute on function admin_reply_inquiry(uuid, text) to authenticated;
grant execute on function admin_issue_recovery_code(text) to authenticated;
grant execute on function create_recovery_code() to authenticated;
grant execute on function recovery_code_created_at() to authenticated;
grant execute on function delete_my_account() to authenticated;

-- 비밀번호 찾기는 로그인 전에 쓴다
revoke execute on function reset_password_with_code(text, text, text) from public;
grant execute on function reset_password_with_code(text, text, text) to anon, authenticated;
