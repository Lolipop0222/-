-- 대고 일품타 · Supabase 스키마 전체본 (자동 생성 — 직접 고치지 말 것)
-- 원본: supabase/parts/01-core.sql, 02-security.sql, 03-groups.sql, 04-titles.sql, 05-storage.sql, 06-subjects.sql, 07-words.sql, 08-levels.sql
-- 고칠 때는 parts의 파일을 고치고 `npm run schema`. 평소에는 바뀐 parts 파일만 SQL Editor에서 실행하면 된다.
-- 새 프로젝트에 처음 넣을 때만 이 파일을 통째로 실행한다 (여러 번 실행해도 안전).

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 01-core.sql — 기본: 설정·프로필·공부 기록·플래너·디데이·타이머 함수
-- │ 실행 순서: supabase/parts의 번호 순. 이 파일 앞에 필요한 것: 없음 (맨 처음)
-- │ 여러 번 실행해도 안전하다(idempotent). 바뀐 파일만 SQL Editor에 붙여넣고 Run.
-- │ 고치면 `npm run schema`로 supabase/schema.sql(전체본)을 다시 만든다.
-- └──────────────────────────────────────────────────────────────────────

-- 대고 일품타 · Supabase 스키마 (프로필 · 공부 기록 · 과목별 순위 · 디데이 · 플래너)
--
-- 원칙 (계획서 3장, 6.1)
-- - 공부 시간은 숫자로 받지 않는다. 시작·종료 시각만 서버 시각(now())으로 저장하고 길이는 계산한다.
-- - 모든 테이블에 RLS를 켠다. 기록 쓰기는 아래 함수로만 한다 (클라이언트가 시각을 정하지 못하게).
-- - 순위는 닉네임·학년·반·합계만 내보낸다.

-- ───────────────────────── 설정 ─────────────────────────

-- 가입 초대코드 (외부인 차단, 계획서 7장). 클라이언트에서는 읽을 수 없다.
create table if not exists app_settings (
  key   text primary key,
  value text not null
);
alter table app_settings enable row level security;
insert into app_settings (key, value) values ('invite_code', 'DAEGO2026') on conflict (key) do nothing;
-- 초대코드 바꾸기: update app_settings set value = '새코드' where key = 'invite_code';

-- ───────────────────────── 테이블 ─────────────────────────

-- users (계획서 3.1) — 실명은 받지 않는다
create table if not exists profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nickname   text not null unique check (char_length(nickname) between 2 and 12),
  grade      int  not null check (grade between 1 and 3),
  class_no   int  not null check (class_no between 1 and 20),
  created_at timestamptz not null default now()
);

-- sessions (계획서 3.2) — 공부 시간의 원본 기록
create table if not exists sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id) on delete cascade,
  subject    text not null check (subject in ('국어', '영어', '수학', '과학', '사회', '한국사', '인강', '기타')),
  started_at timestamptz not null default now(),  -- 서버 시각
  ended_at   timestamptz,
  away_count int not null default 0,              -- 앱 이탈 횟수
  -- 길이는 저장하지 않고 계산한다
  duration   int generated always as (extract(epoch from (ended_at - started_at))::int) stored
);
create index if not exists sessions_user_started_idx on sessions (user_id, started_at);
create index if not exists sessions_started_idx on sessions (started_at);

-- ───────────────────────── RLS ─────────────────────────

alter table profiles enable row level security;
alter table sessions enable row level security;

drop policy if exists "내 프로필 조회" on profiles;
create policy "내 프로필 조회" on profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "내 프로필 수정" on profiles;
create policy "내 프로필 수정" on profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "내 기록만 조회" on sessions;
create policy "내 기록만 조회" on sessions for select to authenticated using (auth.uid() = user_id);

-- 과목 목록 제약(sessions·tasks·routines)은 06-subjects.sql 한 곳에서 정한다 (과목이 바뀌면 거기만 고친다)
-- 기타 기록 이름 (예: 독서, 운동)
alter table sessions add column if not exists label text;
alter table sessions drop constraint if exists sessions_label_check;
alter table sessions add constraint sessions_label_check check (label is null or char_length(label) <= 20);
alter table sessions drop constraint if exists sessions_time_order;
alter table sessions add constraint sessions_time_order check (ended_at is null or ended_at >= started_at);
-- ───────────────────────── 플래너 ─────────────────────────
-- 데일리 루틴: 요일마다 반복되는 과제. 플래너를 열면 그날 과제로 자동으로 들어간다 (materialize_routines)
create table if not exists routines (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references profiles (id) on delete cascade,
  title      text not null check (char_length(trim(title)) between 1 and 60),
  subject    text check (subject in ('국어', '영어', '수학', '과학', '사회', '한국사', '인강', '기타')),
  weekdays   int[] not null default '{0,1,2,3,4,5,6}'  -- 0=일 … 6=토
             check (cardinality(weekdays) >= 1 and weekdays <@ array[0, 1, 2, 3, 4, 5, 6]),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- 그날의 과제 (TASKS). subject가 있으면 이 과제로 잰 시간이 그 과목 공부 시간이 된다
create table if not exists tasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references profiles (id) on delete cascade,
  task_date  date not null,
  title      text not null check (char_length(trim(title)) between 1 and 60),
  subject    text check (subject in ('국어', '영어', '수학', '과학', '사회', '한국사', '인강', '기타')),
  done       boolean not null default false,
  skipped    boolean not null default false,  -- 루틴 과제를 그날만 지운 것 (다시 생기지 않게 남겨 둔다)
  routine_id uuid references routines (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists tasks_user_date_idx on tasks (user_id, task_date);
create unique index if not exists tasks_routine_date_uq on tasks (routine_id, task_date) where routine_id is not null;

-- 그날의 COMMENT / MEMO
create table if not exists planner_days (
  user_id    uuid not null default auth.uid() references profiles (id) on delete cascade,
  day        date not null,
  comment    text check (char_length(comment) <= 100),
  memo       text check (char_length(memo) <= 1000),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- 공부 기록이 어떤 과제였는지 (과제를 지우면 기록은 남고 연결만 끊긴다)
alter table sessions add column if not exists task_id uuid references tasks (id) on delete set null;

-- (task_id 열이 생긴 다음에 만들어야 한다 — 처음 스키마에서 바로 올라오는 DB에는 task_id가 없다)
-- '기타' 기록만 학생이 직접 추가·고치기·지우기 가능 (순위에 안 들어가므로). 공부 과목 기록은 여전히 함수로만
drop policy if exists "기타 기록 추가" on sessions;
create policy "기타 기록 추가" on sessions for insert to authenticated
  with check (auth.uid() = user_id and subject = '기타' and task_id is null);
drop policy if exists "기타 기록 수정" on sessions;
create policy "기타 기록 수정" on sessions for update to authenticated
  using (auth.uid() = user_id and subject = '기타')
  with check (auth.uid() = user_id and subject = '기타');
drop policy if exists "기타 기록 삭제" on sessions;
create policy "기타 기록 삭제" on sessions for delete to authenticated
  using (auth.uid() = user_id and subject = '기타');


alter table routines enable row level security;
alter table tasks enable row level security;
alter table planner_days enable row level security;

do $$
declare t text;
begin
  -- 세 테이블 모두 "내 것만" 보기·추가·수정·삭제
  foreach t in array array['routines', 'tasks', 'planner_days'] loop
    execute format('drop policy if exists "내 것만 조회" on %I', t);
    execute format('create policy "내 것만 조회" on %I for select to authenticated using (auth.uid() = user_id)', t);
    execute format('drop policy if exists "내 것만 추가" on %I', t);
    execute format('create policy "내 것만 추가" on %I for insert to authenticated with check (auth.uid() = user_id)', t);
    execute format('drop policy if exists "내 것만 수정" on %I', t);
    execute format('create policy "내 것만 수정" on %I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('drop policy if exists "내 것만 삭제" on %I', t);
    execute format('create policy "내 것만 삭제" on %I for delete to authenticated using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- 개수 제한: 하루 과제 30개, 루틴 20개
create or replace function planner_limits() returns trigger
language plpgsql set search_path = public as $$
begin
  -- 테이블마다 다른 열을 읽으므로 조건을 나눠서 확인한다 (routines에는 task_date가 없다)
  if tg_table_name = 'tasks' then
    if (select count(*) from tasks where user_id = new.user_id and task_date = new.task_date) >= 30 then
      raise exception '과제는 하루 30개까지 만들 수 있어요';
    end if;
  elsif tg_table_name = 'routines' then
    if (select count(*) from routines where user_id = new.user_id) >= 20 then
      raise exception '루틴은 20개까지 만들 수 있어요';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists tasks_limit on tasks;
create trigger tasks_limit before insert on tasks for each row execute function planner_limits();
drop trigger if exists routines_limit on routines;
create trigger routines_limit before insert on routines for each row execute function planner_limits();

-- ───────────────────────── 규칙 ─────────────────────────
-- 한 세션 4시간, 하루 16시간이 상한 (계획서 6.1). 4시간이 넘은 세션은 합계에서 빠진다.

-- 이번 주 월요일 0시 (한국 시간) — 순위는 매주 월요일에 초기화 (계획서 6.2)
create or replace function kst_week_start() returns timestamptz
language sql stable set search_path = public as $$
  select date_trunc('week', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'
$$;

-- 오늘 0시 (한국 시간)
create or replace function kst_day_start() returns timestamptz
language sql stable set search_path = public as $$
  select date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'
$$;

-- ───────────────────────── 함수 (앱이 부르는 것) ─────────────────────────

-- 가입 마무리: 닉네임·학년·반 + 초대코드 확인
-- 초대코드를 마구 넣어 보는 것을 막는다: 15분에 5번 틀리면 잠시 막힘.
-- 틀린 기록을 남기려면 오류를 던지면 안 된다(던지면 기록도 되돌아감) → 틀리면 빈 값을 돌려주고, 앱이 "코드가 틀림"으로 보여 준다.
create table if not exists security_attempts (
  id      bigint generated always as identity primary key,
  kind    text not null,   -- 'invite' | 'recovery'
  subject text not null,   -- 사용자 id 또는 이메일
  at      timestamptz not null default now()
);
create index if not exists security_attempts_idx on security_attempts (kind, subject, at);
alter table security_attempts enable row level security;  -- 정책 없음 = 앱에서 못 읽고 못 씀
revoke all on security_attempts from anon, authenticated;

create or replace function create_profile(p_nickname text, p_grade int, p_class_no int, p_invite_code text)
returns profiles
language plpgsql security definer set search_path = public as $$
declare
  r profiles;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;
  delete from security_attempts where at < now() - interval '1 day';
  if (select count(*) from security_attempts
      where kind = 'invite' and subject = auth.uid()::text and at > now() - interval '15 minutes') >= 5 then
    raise exception '초대코드를 여러 번 틀렸어요. 15분 뒤에 다시 해 주세요';
  end if;
  if p_invite_code is distinct from (select value from app_settings where key = 'invite_code') then
    insert into security_attempts (kind, subject) values ('invite', auth.uid()::text);
    return null;  -- 앱이 "초대코드가 맞지 않습니다"로 보여 준다
  end if;
  insert into profiles (id, nickname, grade, class_no)
  values (auth.uid(), trim(p_nickname), p_grade, p_class_no)
  on conflict (id) do update set nickname = excluded.nickname, grade = excluded.grade, class_no = excluded.class_no
  returning * into r;
  return r;
end $$;

-- 공부 시작 start_session은 06-subjects.sql에 있다 (세부 항목·인강을 받는다)

-- 공부 끝: 서버가 ended_at을 찍는다.
-- p_end_at: 앱을 벗어난 순간처럼 "지금보다 이른" 종료 시각을 줄 수 있다 (시간을 줄이는 쪽으로만 반영).
create or replace function end_session(p_session_id uuid, p_away_count int default 0, p_end_at timestamptz default null)
returns sessions
language plpgsql security definer set search_path = public as $$
declare
  r sessions;
begin
  update sessions
  set ended_at   = greatest(started_at, least(now(), coalesce(p_end_at, now()))),
      away_count = greatest(0, coalesce(p_away_count, 0))
  where id = p_session_id and user_id = auth.uid() and ended_at is null
  returning * into r;

  if r.id is null then  -- 이미 끝난 세션이면 그대로 돌려준다
    select * into r from sessions where id = p_session_id and user_id = auth.uid();
  end if;
  return r;
end $$;

-- 이번 주 순위 get_ranking은 06-subjects.sql에 있다

-- ───────────────────────── 디데이 (직접 만든 것) ─────────────────────────
-- 학교 시험 디데이는 NEIS 학사일정에서 자동으로 만든다. 여기에는 학생이 직접 추가한 날만 저장한다.

create table if not exists ddays (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references profiles (id) on delete cascade,
  title       text not null check (char_length(trim(title)) between 1 and 30),
  target_date date not null,
  created_at  timestamptz not null default now()
);
create index if not exists ddays_user_idx on ddays (user_id, target_date);

alter table ddays enable row level security;
drop policy if exists "내 디데이 조회" on ddays;
create policy "내 디데이 조회" on ddays for select to authenticated using (auth.uid() = user_id);
drop policy if exists "내 디데이 추가" on ddays;
create policy "내 디데이 추가" on ddays for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "내 디데이 수정" on ddays;
create policy "내 디데이 수정" on ddays for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "내 디데이 삭제" on ddays;
create policy "내 디데이 삭제" on ddays for delete to authenticated using (auth.uid() = user_id);

-- 한 사람당 30개까지
create or replace function ddays_limit() returns trigger
language plpgsql set search_path = public as $$
begin
  if (select count(*) from ddays where user_id = new.user_id) >= 30 then
    raise exception '디데이는 30개까지 만들 수 있어요';
  end if;
  return new;
end $$;
drop trigger if exists ddays_limit on ddays;
create trigger ddays_limit before insert on ddays for each row execute function ddays_limit();

-- 데일리 루틴을 그날 과제로 넣는다 (플래너를 열 때 부른다). 이미 있거나 그날만 지운 루틴은 건너뛴다.
-- 루틴을 만든 날 이전 날짜에는 넣지 않는다. 내 권한으로 실행된다 (RLS 그대로).
create or replace function materialize_routines(p_date date)
returns void
language sql security invoker set search_path = public as $$
  insert into tasks (user_id, task_date, title, subject, routine_id)
  select auth.uid(), p_date, r.title, r.subject, r.id
  from routines r
  where r.user_id = auth.uid()
    and r.active
    and extract(dow from p_date)::int = any (r.weekdays)
    and p_date >= (r.created_at at time zone 'Asia/Seoul')::date
  on conflict (routine_id, task_date) where routine_id is not null do nothing
$$;

-- 함수는 로그인한 사용자만 부를 수 있다
revoke execute on function create_profile(text, int, int, text) from public, anon;
revoke execute on function materialize_routines(date) from public, anon;
revoke execute on function end_session(uuid, int, timestamptz) from public, anon;
grant execute on function create_profile(text, int, int, text) to authenticated;
grant execute on function materialize_routines(date) to authenticated;
grant execute on function end_session(uuid, int, timestamptz) to authenticated;

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

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 03-groups.sql — 스터디그룹
-- │ 실행 순서: supabase/parts의 번호 순. 이 파일 앞에 필요한 것: 01, 02
-- │ 여러 번 실행해도 안전하다(idempotent). 바뀐 파일만 SQL Editor에 붙여넣고 Run.
-- │ 고치면 `npm run schema`로 supabase/schema.sql(전체본)을 다시 만든다.
-- └──────────────────────────────────────────────────────────────────────

-- ═════════════════════════ 스터디그룹 ═════════════════════════
-- 친구끼리 6자리 초대코드로 모여 이번 주 공부 시간을 겨룬다.
-- 테이블은 앱이 직접 못 읽는다(RLS 정책 없음 + 권한 없음). 모든 일은 아래 함수로만 한다 — 그룹원이 아니면 아무것도 볼 수 없다.
-- 제한: 한 사람이 들어가는 그룹 5개, 내가 만든 그룹 3개, 그룹 인원 30명, 코드 15분에 10번 틀리면 잠김.
create table if not exists study_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 2 and 20),
  invite_code text not null unique check (invite_code ~ '^[A-Z2-9]{6}$'),
  owner_id    uuid references profiles (id) on delete set null,  -- 방장이 계정을 지우면 아래 트리거가 다음 사람에게 넘긴다
  created_at  timestamptz not null default now()
);

create table if not exists group_members (
  group_id  uuid not null references study_groups (id) on delete cascade,
  user_id   uuid not null references profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on group_members (user_id);

alter table study_groups enable row level security;
alter table group_members enable row level security;
revoke all on study_groups from anon, authenticated;
revoke all on group_members from anon, authenticated;

-- 누가 나가거나(계정 삭제 포함) 내보내지면: 방장이 없어졌으면 가장 먼저 들어온 사람이 방장, 아무도 없으면 그룹 삭제
create or replace function group_member_left() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  next_owner uuid;
begin
  if not exists (select 1 from study_groups where id = old.group_id) then
    return old;  -- 그룹째 지워지는 중
  end if;
  select user_id into next_owner from group_members where group_id = old.group_id order by joined_at, user_id limit 1;
  if next_owner is null then
    delete from study_groups where id = old.group_id;
  else
    update study_groups set owner_id = next_owner
    where id = old.group_id and (owner_id is null or owner_id = old.user_id);
  end if;
  return old;
end $$;
drop trigger if exists group_member_left on group_members;
create trigger group_member_left after delete on group_members for each row execute function group_member_left();

-- 겹치지 않는 6자리 코드 (헷갈리는 0·O·1·I 뺀 32글자, 약 10억 가지)
create or replace function new_group_code() returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea;
  code text;
begin
  loop
    bytes := extensions.gen_random_bytes(6);
    code := '';
    for i in 0..5 loop
      code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from study_groups where invite_code = code);
  end loop;
  return code;
end $$;

create or replace function require_group_member(p_group uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from group_members where group_id = p_group and user_id = auth.uid()) then
    raise exception '이 그룹의 멤버가 아니에요';
  end if;
end $$;

create or replace function require_group_owner(p_group uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from study_groups where id = p_group and owner_id = auth.uid()) then
    raise exception '방장만 할 수 있어요';
  end if;
end $$;

-- 내 그룹 목록
create or replace function my_groups()
returns table (id uuid, name text, invite_code text, member_count bigint, is_owner boolean, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.invite_code,
         (select count(*) from group_members x where x.group_id = g.id),
         g.owner_id = auth.uid(), m.joined_at
  from group_members m join study_groups g on g.id = m.group_id
  where m.user_id = auth.uid()
  order by m.joined_at
$$;

-- 그룹 만들기 → 새 그룹 id
create or replace function create_group(p_name text) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  gid uuid;
begin
  if not exists (select 1 from profiles where id = auth.uid()) then
    raise exception '프로필이 없습니다';
  end if;
  if (select count(*) from study_groups where owner_id = auth.uid()) >= 3 then
    raise exception '그룹은 3개까지 만들 수 있어요';
  end if;
  if (select count(*) from group_members where user_id = auth.uid()) >= 5 then
    raise exception '그룹은 5개까지 들어갈 수 있어요';
  end if;
  insert into study_groups (name, invite_code, owner_id) values (trim(p_name), new_group_code(), auth.uid()) returning id into gid;
  insert into group_members (group_id, user_id) values (gid, auth.uid());
  return gid;
end $$;

-- 코드로 들어가기 → 그룹 id. 코드가 틀리면 null (틀린 횟수를 남기려고 오류를 던지지 않는다)
create or replace function join_group(p_code text) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  gid uuid;
begin
  if not exists (select 1 from profiles where id = auth.uid()) then
    raise exception '프로필이 없습니다';
  end if;
  delete from security_attempts where at < now() - interval '1 day';
  if (select count(*) from security_attempts where kind = 'group' and subject = auth.uid()::text and at > now() - interval '15 minutes') >= 10 then
    raise exception '코드를 여러 번 틀렸어요. 15분 뒤에 다시 해 주세요';
  end if;
  select id into gid from study_groups where invite_code = code;
  if gid is null then
    insert into security_attempts (kind, subject) values ('group', auth.uid()::text);
    return null;
  end if;
  if exists (select 1 from group_members where group_id = gid and user_id = auth.uid()) then
    return gid;  -- 이미 들어가 있음
  end if;
  if (select count(*) from group_members where user_id = auth.uid()) >= 5 then
    raise exception '그룹은 5개까지 들어갈 수 있어요';
  end if;
  if (select count(*) from group_members where group_id = gid) >= 30 then
    raise exception '이 그룹은 꽉 찼어요 (30명)';
  end if;
  insert into group_members (group_id, user_id) values (gid, auth.uid());
  return gid;
end $$;

create or replace function leave_group(p_group uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  delete from group_members where group_id = p_group and user_id = auth.uid();
end $$;

create or replace function rename_group(p_group uuid, p_name text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  perform require_group_owner(p_group);
  update study_groups set name = trim(p_name) where id = p_group;
end $$;

-- 코드가 밖으로 퍼졌을 때 새 코드로 (예전 코드로는 못 들어온다)
create or replace function regenerate_group_code(p_group uuid) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  code text;
begin
  perform require_group_owner(p_group);
  code := new_group_code();
  update study_groups set invite_code = code where id = p_group;
  return code;
end $$;

create or replace function kick_group_member(p_group uuid, p_nickname text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid;
begin
  perform require_group_owner(p_group);
  select p.id into uid from profiles p join group_members m on m.user_id = p.id and m.group_id = p_group
  where p.nickname = p_nickname;
  if uid is null then
    raise exception '그 멤버를 찾을 수 없어요';
  end if;
  if uid = auth.uid() then
    raise exception '나 자신은 내보낼 수 없어요. 그룹 나가기를 써 주세요';
  end if;
  delete from group_members where group_id = p_group and user_id = uid;
end $$;

create or replace function delete_group(p_group uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  perform require_group_owner(p_group);
  delete from study_groups where id = p_group;
end $$;

-- 그룹 안 순위 get_group_ranking도 파일 끝 '칭호 · 프로필 그림' 부분에 있다

revoke execute on function group_member_left() from public, anon, authenticated;
revoke execute on function new_group_code() from public, anon, authenticated;
revoke execute on function require_group_member(uuid) from public, anon, authenticated;
revoke execute on function require_group_owner(uuid) from public, anon, authenticated;
revoke execute on function my_groups() from public, anon;
revoke execute on function create_group(text) from public, anon;
revoke execute on function join_group(text) from public, anon;
revoke execute on function leave_group(uuid) from public, anon;
revoke execute on function rename_group(uuid, text) from public, anon;
revoke execute on function regenerate_group_code(uuid) from public, anon;
revoke execute on function kick_group_member(uuid, text) from public, anon;
revoke execute on function delete_group(uuid) from public, anon;
grant execute on function my_groups() to authenticated;
grant execute on function create_group(text) to authenticated;
grant execute on function join_group(text) to authenticated;
grant execute on function leave_group(uuid) to authenticated;
grant execute on function rename_group(uuid, text) to authenticated;
grant execute on function regenerate_group_code(uuid) to authenticated;
grant execute on function kick_group_member(uuid, text) to authenticated;
grant execute on function delete_group(uuid) to authenticated;

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 04-titles.sql — 칭호·프로필 그림/사진 규칙 (판정 값 title_stats와 순위 함수는 06)
-- │ 실행 순서: supabase/parts의 번호 순. 이 파일 앞에 필요한 것: 01, 02, 03
-- │ 여러 번 실행해도 안전하다(idempotent). 바뀐 파일만 SQL Editor에 붙여넣고 Run.
-- │ 고치면 `npm run schema`로 supabase/schema.sql(전체본)을 다시 만든다.
-- └──────────────────────────────────────────────────────────────────────

-- ═════════════════════════ 칭호 · 프로필 그림 ═════════════════════════
-- 조건을 채우면 칭호를 얻고(영구 보관), 얻은 칭호 하나를 닉네임 옆에 단다. 판정은 전부 서버(check_titles)가 한다.
-- 공부 시간은 순위와 같은 기준: '기타' 제외, 한 기록 1초~4시간만. 날짜·요일·시각은 한국 시간, 기록은 "시작한 날"에 센다.
-- 칭호를 더하려면: title_defs에 한 줄(아래 insert)만 넣으면 된다. 새로운 종류의 조건이면 06-subjects.sql의 title_stats()에 값을 하나 더 계산한다.
-- (단어 퀴즈 점수를 서버에 저장하게 되면 title_stats()에 'quiz_…' 값을 더하고 칭호 줄을 추가하면 된다.)

-- 프로필 그림·사진. avatar = '그림:색'(예 'cat:s-math', 목록은 앱 lib/titles.ts) 또는 'photo:<내 user id>/<16자>.webp|jpg'(05-storage의 사진).
-- 사진·그림 규칙은 여기 한 곳에만 둔다 (다른 파일에서 이 제약을 다시 만들면, 사진을 올린 학생이 있을 때 다시 실행하다 오류가 난다)
alter table profiles add column if not exists avatar text;
alter table profiles add column if not exists avatar_at timestamptz;  -- 그림을 마지막으로 바꾼 시각 (관리자 사진 검토 순서)
alter table profiles drop constraint if exists profiles_avatar_check;
alter table profiles add constraint profiles_avatar_check check (
  avatar is null
  or avatar ~ '^[a-z0-9-]{1,20}:[a-z0-9-]{1,20}$'
  or avatar ~ '^photo:[0-9a-f-]{36}/[0-9a-f]{16}\.(webp|jpg)$'
);

create or replace function profiles_avatar_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.avatar is distinct from old.avatar then
    if new.avatar like 'photo:%' and split_part(substr(new.avatar, 7), '/', 1) <> new.id::text then
      raise exception '내 사진만 프로필로 쓸 수 있어요';
    end if;
    new.avatar_at := now();
  end if;
  return new;
end $$;
drop trigger if exists profiles_avatar_guard on profiles;
create trigger profiles_avatar_guard before update of avatar on profiles for each row execute function profiles_avatar_guard();

alter table profiles add column if not exists title_code text;

create table if not exists title_defs (
  code        text primary key check (code ~ '^[a-z0-9_]{2,40}$'),
  name        text not null,
  grade       text not null check (grade in ('common', 'rare', 'epic', 'legendary', 'hidden')),  -- hidden = 얻기 전엔 이름·조건 비공개
  category    text not null,
  description text not null,
  metric      text not null,   -- title_stats()가 돌려주는 값 이름
  goal        numeric not null,  -- metric이 이 값 이상이면 지급
  unit        text not null default 'flag' check (unit in ('flag', 'hour', 'day', 'count')),  -- 진행도 표시용 (hour는 초 단위로 저장)
  sort        int not null default 0,
  active      boolean not null default true
);
alter table title_defs enable row level security;
revoke all on title_defs from anon, authenticated;  -- 히든 칭호 이름이 새지 않게 직접 읽기 금지 (my_titles로만)

create table if not exists user_titles (
  user_id   uuid not null references profiles (id) on delete cascade,
  code      text not null references title_defs (code) on delete cascade,
  earned_at timestamptz not null default now(),
  seen      boolean not null default false,  -- 앱이 알림(토스트)을 띄웠는지
  primary key (user_id, code)
);
alter table user_titles enable row level security;  -- 정책 없음 + 권한 없음 = 학생이 직접 읽기·쓰기 불가. 함수로만
revoke all on user_titles from anon, authenticated;

alter table profiles drop constraint if exists profiles_title_code_fkey;
alter table profiles add constraint profiles_title_code_fkey foreign key (title_code) references title_defs (code) on delete set null;

-- 학생이 프로필에서 직접 고칠 수 있는 열(열 권한)은 06-subjects.sql에서 정한다 (계열 열이 거기서 생기므로)

insert into title_defs (code, name, grade, category, description, metric, goal, unit, sort) values
  ('first_page',    '첫 페이지',        'common',    '누적 공부', '첫 공부 기록(1분 이상)을 남기기',                        'first_record',   1,       'flag',  10),
  ('study_10h',     '공부 입문자',      'common',    '누적 공부', '누적 공부 10시간',                                      'total_sec',      36000,   'hour',  11),
  ('study_50h',     '반백 시간',        'rare',      '누적 공부', '누적 공부 50시간',                                      'total_sec',      180000,  'hour',  12),
  ('study_100h',    '백 시간 클럽',     'epic',      '누적 공부', '누적 공부 100시간',                                     'total_sec',      360000,  'hour',  13),
  ('study_500h',    '서울대의 자질',    'legendary', '누적 공부', '누적 공부 500시간',                                     'total_sec',      1800000, 'hour',  14),
  ('day_3h',        '오늘도 열공',      'common',    '하루 공부', '하루에 3시간 공부',                                     'max_day_sec',    10800,   'hour',  20),
  ('day_6h',        '하루를 바친 자',   'rare',      '하루 공부', '하루에 6시간 공부',                                     'max_day_sec',    21600,   'hour',  21),
  ('day_10h',       '열 시간의 영웅',   'epic',      '하루 공부', '하루에 10시간 공부',                                    'max_day_sec',    36000,   'hour',  22),
  ('focus_2h',      '부동자세',         'rare',      '집중',      '한 번에 2시간 이상, 앱을 한 번도 벗어나지 않고 공부',      'focus_2h',       1,       'flag',  30),
  ('streak_3',      '작심삼일 돌파',    'common',    '연속 출석', '하루 30분 이상 공부한 날 3일 연속',                      'max_streak',     3,       'day',   40),
  ('streak_7',      '일주일 개근',      'rare',      '연속 출석', '하루 30분 이상 공부한 날 7일 연속',                      'max_streak',     7,       'day',   41),
  ('streak_30',     '한 달의 끈기',     'epic',      '연속 출석', '하루 30분 이상 공부한 날 30일 연속',                     'max_streak',     30,      'day',   42),
  ('streak_100',    '백일의 기적',      'legendary', '연속 출석', '하루 30분 이상 공부한 날 100일 연속',                    'max_streak',     100,     'day',   43),
  ('subj_kor',      '독해 장인',        'rare',      '과목',      '국어 누적 50시간',                                      'sub_kor',        180000,  'hour',  50),
  ('subj_eng',      '99프로 미국인',    'rare',      '과목',      '영어 누적 50시간',                                      'sub_eng',        180000,  'hour',  51),
  ('subj_math',     '수학 괴물',        'rare',      '과목',      '수학 누적 50시간',                                      'sub_math',       180000,  'hour',  52),
  ('subj_sci',      '실험실 주인',      'rare',      '과목',      '과학 누적 50시간',                                      'sub_sci',        180000,  'hour',  53),
  ('subj_soc',      '사회 박사',        'rare',      '과목',      '사회 누적 50시간',                                      'sub_soc',        180000,  'hour',  54),
  ('subj_his',      '역사 지킴이',      'rare',      '과목',      '역사 누적 50시간',                                    'sub_his',        180000,  'hour',  55),
  ('all_rounder',   '올라운더',         'rare',      '골고루',    '하루에 서로 다른 5과목을 각각 20분 이상',                 'allround',       1,       'flag',  60),
  ('week_class',    '우리 반 에이스',   'rare',      '주간 순위', '반 주간 1위 (그 주 5시간 이상, 반에 기록 있는 학생 3명 이상)',   'week_class_top',  1, 'flag', 70),
  ('week_grade',    '학년 1짱',         'epic',      '주간 순위', '학년 주간 1위 (그 주 5시간 이상, 학년에 기록 있는 학생 3명 이상)', 'week_grade_top',  1, 'flag', 71),
  ('week_school',   '대고 일품인',      'legendary', '주간 순위', '전교 주간 1위 (그 주 5시간 이상, 기록 있는 학생 3명 이상)',     'week_school_top', 1, 'flag', 72),
  ('planner_100',   '계획의 달인',      'epic',      '플래너·야자', '플래너 과제 누적 100개 완료',                          'tasks_done',     100,     'count', 80),
  ('yaja_king',     '야자의 왕',        'epic',      '플래너·야자', '평일 18시~22시에 2시간 이상 공부한 날 누적 20일',        'yaja_days',      20,      'day',   81),
  ('reset_hunter',  '리셋 사냥꾼',      'hidden',    '히든',      '순위가 초기화되는 월요일 0시~0시 5분에 공부 시작',          'reset_hunter',   1,       'flag',  90),
  ('on_the_hour',   '정각 장인',        'hidden',    '히든',      '한 번의 기록이 정확히 1시간',                            'hour_exact',     1,       'flag',  91),
  ('three_minutes', '작심삼분',         'hidden',    '히든',      '1분 이상 3분 미만으로 끝난 기록 10번',                    'short_count',    10,      'count', 92),
  ('christmas',     '메리 스터디마스',  'hidden',    '히든',      '12월 25일에 3시간 이상 공부',                            'xmas',           1,       'flag',  93),
  ('new_year',      '새해 첫 공부',     'hidden',    '히든',      '1월 1일 0시대에 공부 중',                                'newyear',        1,       'flag',  94),
  ('bug_hunter',    '오류를 찾는 자',   'hidden',    '히든',      '오류 신고 문의에 관리자가 답변함',                        'bug_finder',     1,       'flag',  95)
on conflict (code) do update set
  name = excluded.name, grade = excluded.grade, category = excluded.category, description = excluded.description,
  metric = excluded.metric, goal = excluded.goal, unit = excluded.unit, sort = excluded.sort;

-- 칭호 판정용 값 title_stats()는 06-subjects.sql에 있다 (과목·인강 규칙을 쓰므로)

-- 판정 + 새로 얻은 칭호 알려 주기. 여러 번 불러도 같은 칭호는 한 번만 생긴다 (primary key + on conflict).
-- 돌려주는 것 = 아직 알림을 안 띄운 칭호들 (부르면 '봤음'으로 바뀐다). 앱 열기·공부 끝·과제 완료·내정보 열기에서 부른다.
create or replace function check_titles()
returns table (code text, name text, grade text)
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  stats jsonb;
begin
  if uid is null or not exists (select 1 from profiles where id = uid) then
    return;
  end if;
  stats := title_stats(uid);
  insert into user_titles (user_id, code)
  select uid, t.code from title_defs t
  where t.active and coalesce((stats ->> t.metric)::numeric, 0) >= t.goal
  on conflict do nothing;

  return query
    with fresh as (
      update user_titles u set seen = true
      where u.user_id = uid and not u.seen
      returning u.code, u.earned_at
    )
    select t.code, t.name, t.grade from fresh f join title_defs t on t.code = f.code order by t.sort;
end $$;

-- 칭호 목록 (내 것). 못 얻은 히든 칭호는 이름·조건을 '???'로 가린다. progress·goal은 진행도 표시용 (hour는 초)
create or replace function my_titles()
returns table (code text, name text, grade text, category text, description text, unit text, goal numeric, progress numeric, earned_at timestamptz, equipped boolean, sort int)
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  stats jsonb;
  eq text;
begin
  if uid is null or not exists (select 1 from profiles where id = uid) then
    return;
  end if;
  stats := title_stats(uid);
  select p.title_code into eq from profiles p where p.id = uid;
  return query
    select t.code,
           case when t.grade = 'hidden' and u.code is null then '???' else t.name end,
           t.grade,
           t.category,
           case when t.grade = 'hidden' and u.code is null then '???' else t.description end,
           t.unit,
           case when t.grade = 'hidden' and u.code is null then null else t.goal end,
           case when t.grade = 'hidden' and u.code is null then null
                else least(coalesce((stats ->> t.metric)::numeric, 0), t.goal) end,
           u.earned_at,
           t.code = eq,
           t.sort
    from title_defs t
    left join user_titles u on u.code = t.code and u.user_id = uid
    where t.active
    order by t.sort;
end $$;

-- 대표 칭호 달기 (null이면 떼기). 얻은 칭호만
create or replace function set_title(p_code text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if p_code is not null and not exists (select 1 from user_titles where user_id = auth.uid() and code = p_code) then
    raise exception '아직 얻지 못한 칭호예요';
  end if;
  update profiles set title_code = p_code where id = auth.uid();
end $$;

-- 순위 get_ranking·get_group_ranking은 06-subjects.sql에 있다 (과목·인강 규칙을 쓰므로)

revoke execute on function profiles_avatar_guard() from public, anon, authenticated;
revoke execute on function check_titles() from public, anon;
revoke execute on function my_titles() from public, anon;
revoke execute on function set_title(text) from public, anon;
grant execute on function check_titles() to authenticated;
grant execute on function my_titles() to authenticated;
grant execute on function set_title(text) to authenticated;

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

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 06-subjects.sql — 계열(문과/이과)·과목 목록(국영수사과역+기타)·세부 항목·인강, 그리고 이 규칙을 쓰는 함수
-- │                   (start_session, title_stats, get_ranking, get_group_ranking)
-- │ 실행 순서: supabase/parts의 번호 순. 이 파일 앞에 필요한 것: 01~05
-- │ 여러 번 실행해도 안전하다(idempotent). 바뀐 파일만 SQL Editor에 붙여넣고 Run.
-- │ 고치면 `npm run schema`로 supabase/schema.sql(전체본)을 다시 만든다.
-- └──────────────────────────────────────────────────────────────────────

-- 계열·과목·세부 항목·인강 (2026-11-06)
-- 과목: 국어·영어·수학·사회·과학·역사 (순위에 들어감) + 기타 (나만 보는 기록). 예전 '한국사'는 '역사'로 바꾸고,
--       예전 '인강' 과목은 없앴다 → 이제 인강은 각 과목 기록에 붙는 표시(lecture)다.
-- 세부 항목(detail): 미적분Ⅰ·통합과학1 같은 과목 안의 갈래. 고를 수 있는 목록은 계열(문과/이과)에 따라 앱(lib/subjects.ts)이 정하고,
--       DB는 길이만 검사한다. 순위는 과목까지만 나눈다.
-- 인강(lecture): TIMETABLE에는 보이지만 공부 합계·순위·칭호·16시간 상한·"공부 중" 표시에서는 빠진다 (기타와 같은 취급).
-- 과목 목록 제약은 이 파일에만 둔다. 과목을 바꾸면 여기와 lib/subjects.ts를 같이 고친다.

-- ───────────────────────── 계열 ─────────────────────────
alter table profiles add column if not exists track text;
alter table profiles drop constraint if exists profiles_track_check;
alter table profiles add constraint profiles_track_check check (track is null or track in ('문과', '이과'));

-- 학생이 프로필에서 직접 고칠 수 있는 열은 닉네임·학년·반·그림·계열뿐. 대표 칭호는 set_title()로만 (얻은 칭호인지 확인)
revoke update on profiles from authenticated;
grant update (nickname, grade, class_no, avatar, track) on profiles to authenticated;

-- ───────────────────────── 세부 항목·인강 열 ─────────────────────────
alter table sessions add column if not exists detail text;
alter table sessions add column if not exists lecture boolean not null default false;
alter table tasks add column if not exists detail text;
alter table tasks add column if not exists lecture boolean not null default false;
alter table sessions drop constraint if exists sessions_detail_check;
alter table sessions add constraint sessions_detail_check check (detail is null or char_length(detail) between 1 and 20);
alter table tasks drop constraint if exists tasks_detail_check;
alter table tasks add constraint tasks_detail_check check (detail is null or char_length(detail) between 1 and 20);
-- 기타에는 인강 표시를 붙이지 않는다
alter table sessions drop constraint if exists sessions_lecture_check;
alter table sessions add constraint sessions_lecture_check check (not (lecture and subject = '기타'));
alter table tasks drop constraint if exists tasks_lecture_check;
alter table tasks add constraint tasks_lecture_check check (not (lecture and subject = '기타'));

-- ───────────────────────── 과목 목록 (예전 기록도 새 목록으로) ─────────────────────────
alter table sessions drop constraint if exists sessions_subject_check;
alter table tasks drop constraint if exists tasks_subject_check;
alter table routines drop constraint if exists routines_subject_check;
alter table prints drop constraint if exists prints_subject_check;

-- 예전 '한국사' → 과목 '역사' + 세부 항목 '한국사'
update sessions set subject = '역사', detail = coalesce(detail, '한국사') where subject = '한국사';
update tasks set subject = '역사', detail = coalesce(detail, '한국사') where subject = '한국사';
update routines set subject = '역사' where subject = '한국사';
update prints set subject = '역사' where subject = '한국사';
-- 예전 '인강' 과목: 어느 과목인지 알 수 없어서 기록은 '기타'(이름 '인강')로, 과제·루틴은 과목 없음으로 옮긴다
update sessions set subject = '기타', label = coalesce(label, '인강') where subject = '인강';
update tasks set subject = null where subject = '인강';
update routines set subject = null where subject = '인강';

alter table sessions add constraint sessions_subject_check check (subject in ('국어', '영어', '수학', '사회', '과학', '역사', '기타'));
alter table tasks add constraint tasks_subject_check check (subject in ('국어', '영어', '수학', '사회', '과학', '역사', '기타'));
alter table routines add constraint routines_subject_check check (subject in ('국어', '영어', '수학', '사회', '과학', '역사', '기타'));
alter table prints add constraint prints_subject_check check (subject in ('국어', '영어', '수학', '사회', '과학', '역사', '기타'));

update title_defs set description = '역사 누적 50시간' where code = 'subj_his';

-- ───────────────────────── 공부 시작 ─────────────────────────
-- 서버가 started_at을 찍는다. 켜져 있던 세션은 지금 시각으로 끝낸다.
-- p_task_id: 플래너 과제와 연결 (내 과제만) / p_detail: 세부 항목 / p_lecture: 인강
drop function if exists start_session(text);        -- 예전(과목만 받던) 버전
drop function if exists start_session(text, uuid);  -- 예전(세부 항목 없던) 버전
create or replace function start_session(p_subject text, p_task_id uuid default null, p_detail text default null, p_lecture boolean default false)
returns sessions
language plpgsql security definer set search_path = public as $$
declare
  r sessions;
  today_sec int;
begin
  if not exists (select 1 from profiles where id = auth.uid()) then
    raise exception '프로필이 없습니다';
  end if;
  if p_task_id is not null and not exists (select 1 from tasks where id = p_task_id and user_id = auth.uid()) then
    raise exception '과제를 찾을 수 없습니다';
  end if;

  update sessions set ended_at = now() where user_id = auth.uid() and ended_at is null;

  -- 하루 16시간 상한은 공부 합계(기타·인강 제외)로 센다
  select coalesce(sum(duration), 0) into today_sec
  from sessions
  where user_id = auth.uid() and started_at >= kst_day_start() and duration between 1 and 14400 and subject <> '기타' and not lecture;
  if today_sec >= 16 * 3600 then
    raise exception '오늘은 16시간을 넘게 공부해서 더 기록할 수 없습니다';
  end if;

  insert into sessions (user_id, subject, task_id, detail, lecture)
  values (auth.uid(), p_subject, p_task_id, nullif(trim(p_detail), ''), coalesce(p_lecture, false) and p_subject <> '기타')
  returning * into r;
  return r;
end $$;

-- 한 학생의 칭호 판정용 값들 (앱에서 직접 못 부름). 값은 모두 숫자, 예/아니오는 1/0
create or replace function title_stats(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r jsonb;
begin
  with
  -- 순위와 같은 기준의 공부 기록 (기타·인강 제외, 1초~4시간). ls/le = 한국 시각
  v as (
    select s.subject, s.duration, s.away_count,
           s.started_at at time zone 'Asia/Seoul' as ls,
           s.ended_at at time zone 'Asia/Seoul' as le
    from sessions s
    where s.user_id = p_user and s.subject <> '기타' and not s.lecture and s.duration between 1 and 14400
  ),
  -- 히든 조건용: 진행 중인 기록도 포함 (기타·인강 제외, 4시간 넘게 켜 둔 것은 제외)
  a as (
    select s.duration,
           s.started_at at time zone 'Asia/Seoul' as ls,
           coalesce(s.ended_at, now()) at time zone 'Asia/Seoul' as le
    from sessions s
    where s.user_id = p_user and s.subject <> '기타' and not s.lecture
      and (s.duration between 0 and 14400 or (s.ended_at is null and s.started_at > now() - interval '4 hours'))
  ),
  d as (select ls::date as day, sum(duration) as sec from v group by 1),
  ds as (select ls::date as day, subject, sum(duration) as sec from v group by 1, 2),
  st as (
    select day - (row_number() over (order by day))::int as grp from d where sec >= 1800
  ),
  -- 평일 18~22시에 들어간 공부 시간 (기록이 시작된 날의 18~22시와 겹치는 만큼)
  yj as (
    select ls::date as day,
           sum(greatest(0, extract(epoch from (least(le, ls::date + time '22:00') - greatest(ls, ls::date + time '18:00'))))) as sec
    from v
    where extract(isodow from ls) between 1 and 5
    group by 1
  ),
  -- 지난 모든 주(이번 주 제외)의 학생별 합계 — 주간 순위 칭호는 끝난 주만 본다
  wk as (
    select s.user_id, date_trunc('week', s.started_at at time zone 'Asia/Seoul') as w, sum(s.duration) as t
    from sessions s
    where s.subject <> '기타' and not s.lecture and s.duration between 1 and 14400 and s.started_at < kst_week_start()
    group by 1, 2
  ),
  wp as (select wk.w, wk.t, wk.user_id, p.grade, p.class_no from wk join profiles p on p.id = wk.user_id),
  mine as (select * from wp where user_id = p_user and t >= 18000)
  select jsonb_build_object(
    'first_record',   (exists (select 1 from v where duration >= 60))::int,
    'total_sec',      coalesce((select sum(duration) from v), 0),
    'max_day_sec',    coalesce((select max(sec) from d), 0),
    'focus_2h',       (exists (select 1 from v where duration >= 7200 and away_count = 0))::int,
    'max_streak',     coalesce((select max(c) from (select count(*) as c from st group by grp) x), 0),
    'sub_kor',        coalesce((select sum(duration) from v where subject = '국어'), 0),
    'sub_eng',        coalesce((select sum(duration) from v where subject = '영어'), 0),
    'sub_math',       coalesce((select sum(duration) from v where subject = '수학'), 0),
    'sub_sci',        coalesce((select sum(duration) from v where subject = '과학'), 0),
    'sub_soc',        coalesce((select sum(duration) from v where subject = '사회'), 0),
    'sub_his',        coalesce((select sum(duration) from v where subject = '역사'), 0),
    'allround',       (exists (select 1 from ds where sec >= 1200 group by day having count(*) >= 5))::int,
    'week_class_top', (exists (select 1 from mine m
                        where (select count(*) from wp x where x.w = m.w and x.grade = m.grade and x.class_no = m.class_no) >= 3
                          and m.t >= (select max(x.t) from wp x where x.w = m.w and x.grade = m.grade and x.class_no = m.class_no)))::int,
    'week_grade_top', (exists (select 1 from mine m
                        where (select count(*) from wp x where x.w = m.w and x.grade = m.grade) >= 3
                          and m.t >= (select max(x.t) from wp x where x.w = m.w and x.grade = m.grade)))::int,
    'week_school_top',(exists (select 1 from mine m
                        where (select count(*) from wp x where x.w = m.w) >= 3
                          and m.t >= (select max(x.t) from wp x where x.w = m.w)))::int,
    'tasks_done',     (select count(*) from tasks where user_id = p_user and done and not skipped),
    'yaja_days',      (select count(*) from yj where sec >= 7200),
    'reset_hunter',   (exists (select 1 from a where extract(isodow from ls) = 1 and ls::time < time '00:06'))::int,
    'hour_exact',     (exists (select 1 from v where duration between 3600 and 3604))::int,
    'short_count',    (select count(*) from a where duration >= 60 and duration < 180),
    'xmas',           (exists (select 1 from d where extract(month from day) = 12 and extract(day from day) = 25 and sec >= 10800))::int,
    'newyear',        (exists (select 1 from a where le > date_trunc('year', le) and ls < date_trunc('year', le) + interval '1 hour'))::int,
    'bug_finder',     (exists (select 1 from inquiries where user_id = p_user and category = '오류 신고' and reply is not null))::int
  ) into r;
  return r;
end $$;

-- 이번 주 순위. p_scope: 'school' | 'grade' | 'class', p_subject: null이면 전체 과목
-- 닉네임·학년·반·합계·공부 중 여부·프로필 그림·대표 칭호만 내보낸다. 진행 중인 세션은 끝나야 합계에 들어간다.
drop function if exists get_ranking(text, text);  -- 돌려주는 열이 바뀌어서 지우고 다시 만든다
create function get_ranking(p_scope text default 'school', p_subject text default null)
returns table (rank bigint, nickname text, grade int, class_no int, total_sec bigint, studying boolean, is_me boolean,
               avatar text, title_name text, title_grade text)
language sql stable security definer set search_path = public as $$
  with me as (
    select grade, class_no from profiles where id = auth.uid()
  ),
  totals as (
    select user_id, sum(duration)::bigint as total
    from sessions
    where started_at >= kst_week_start()
      and duration between 1 and 14400
      and subject <> '기타' and not lecture  -- 기타·인강은 순위에 안 들어간다
      and (p_subject is null or subject = p_subject)
    group by user_id
  ),
  live as (
    select distinct user_id from sessions
    where ended_at is null and started_at > now() - interval '4 hours' and subject <> '기타' and not lecture
  )
  select rank() over (order by coalesce(t.total, 0) desc) as rank,
         p.nickname, p.grade, p.class_no,
         coalesce(t.total, 0) as total_sec,
         l.user_id is not null as studying,
         p.id = auth.uid() as is_me,
         p.avatar, td.name, td.grade
  from profiles p
  cross join me
  left join totals t on t.user_id = p.id
  left join live l on l.user_id = p.id
  left join title_defs td on td.code = p.title_code
  where p_scope = 'school'
     or (p_scope = 'grade' and p.grade = me.grade)
     or (p_scope = 'class' and p.grade = me.grade and p.class_no = me.class_no)
  order by rank, p.nickname
$$;

-- 그룹 안 이번 주 순위 (그룹원만). 오늘 시간·공부 중 여부도 같이. 규칙은 get_ranking과 같다 (4시간 넘는 세션·기타·인강 제외)
drop function if exists get_group_ranking(uuid, text);
create function get_group_ranking(p_group uuid, p_subject text default null)
returns table (rank bigint, nickname text, grade int, class_no int, total_sec bigint, today_sec bigint, studying boolean, is_me boolean, is_owner boolean,
               avatar text, title_name text, title_grade text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_group_member(p_group);
  return query
    with members as (
      select m.user_id from group_members m where m.group_id = p_group
    ),
    totals as (
      select s.user_id,
             sum(s.duration)::bigint as total,
             (sum(s.duration) filter (where s.started_at >= kst_day_start()))::bigint as today
      from sessions s
      where s.user_id in (select user_id from members)
        and s.started_at >= kst_week_start()
        and s.duration between 1 and 14400
        and s.subject <> '기타' and not s.lecture
        and (p_subject is null or s.subject = p_subject)
      group by s.user_id
    ),
    live as (
      select distinct s.user_id from sessions s
      where s.user_id in (select user_id from members)
        and s.ended_at is null and s.started_at > now() - interval '4 hours' and s.subject <> '기타' and not s.lecture
    )
    select rank() over (order by coalesce(t.total, 0) desc),
           p.nickname, p.grade, p.class_no,
           coalesce(t.total, 0), coalesce(t.today, 0),
           l.user_id is not null,
           p.id = auth.uid(),
           p.id = (select g.owner_id from study_groups g where g.id = p_group),
           p.avatar, td.name, td.grade
    from members mb
    join profiles p on p.id = mb.user_id
    left join totals t on t.user_id = p.id
    left join live l on l.user_id = p.id
    left join title_defs td on td.code = p.title_code
    order by 1, p.nickname;
end $$;

revoke execute on function start_session(text, uuid, text, boolean) from public, anon;
revoke execute on function title_stats(uuid) from public, anon, authenticated;
revoke execute on function get_ranking(text, text) from public, anon;
revoke execute on function get_group_ranking(uuid, text) from public, anon;
grant execute on function start_session(text, uuid, text, boolean) to authenticated;
grant execute on function get_ranking(text, text) to authenticated;
grant execute on function get_group_ranking(uuid, text) to authenticated;

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 07-words.sql — 워마(워드마스터 수능 2000) 암기 진도: 복습 상자 5단계 + DAY별 퀴즈 최고 점수
-- │ 실행 순서: supabase/parts의 번호 순. 이 파일 앞에 필요한 것: 01 (profiles)
-- │ 여러 번 실행해도 안전하다(idempotent). 바뀐 파일만 SQL Editor에 붙여넣고 Run.
-- │ 고치면 `npm run schema`로 supabase/schema.sql(전체본)을 다시 만든다.
-- └──────────────────────────────────────────────────────────────────────

-- 단어 데이터(뜻·예문·관련어)는 DB에 넣지 않는다 — 앱의 public/wordmaster/*.json (모두에게 같은 읽기 전용 자료).
-- DB에는 학생마다 "어떤 단어를 몇 단계까지 외웠는지"만 둔다.
-- 단어 번호(word_id)는 1~2000이고 DAY 순서대로 40개씩이다 → DAY = (word_id - 1) / 40 + 1.
--
-- 복습 상자 (라이트너 방식, 2026-11-06)
--   상자 1~5: 1 → 내일, 2 → 3일 뒤, 3 → 7일 뒤, 4 → 16일 뒤, 5 → 35일 뒤에 다시 나온다. 6 = 외움(더 안 나옴).
--   처음 보는 단어: 알면(맞히면) 2단계, 모르면(틀리면) 1단계.
--   복습할 날이 된 단어: 맞히면 한 칸 위로(5단계에서 맞히면 외움), 틀리면 1단계로.
--   아직 날이 안 된 단어를 또 맞혀도 단계는 그대로(하루에 여러 번 눌러 올리는 것 막기), 틀리면 1단계로.
--   날짜는 한국 시간 기준이고, 단계·날짜 계산은 모두 서버가 한다(앱은 맞았는지만 보낸다).

-- ───────────────────────── 단어별 진도 ─────────────────────────
create table if not exists word_progress (
  user_id   uuid not null references profiles (id) on delete cascade,
  word_id   smallint not null check (word_id between 1 and 2000),
  box       smallint not null check (box between 1 and 6),
  due       date,                                   -- 다음 복습 날짜(한국 날짜). 외움(6)이면 null
  seen      int not null default 0,                 -- 답한 횟수
  wrong     int not null default 0,                 -- 틀린 횟수
  first_at  timestamptz not null default now(),
  last_at   timestamptz not null default now(),
  primary key (user_id, word_id),
  check ((box = 6) = (due is null))
);
create index if not exists word_progress_due_idx on word_progress (user_id, due);

alter table word_progress enable row level security;
revoke all on word_progress from anon, authenticated;
grant select on word_progress to authenticated;     -- 쓰기는 아래 함수로만
drop policy if exists "word_progress_select_own" on word_progress;
create policy "word_progress_select_own" on word_progress for select to authenticated using (user_id = auth.uid());

-- ───────────────────────── DAY별 퀴즈 최고 점수 ─────────────────────────
create table if not exists word_quiz_best (
  user_id  uuid not null references profiles (id) on delete cascade,
  day      smallint not null check (day between 1 and 50),
  mode     text not null check (mode in ('meaning', 'reverse', 'blank', 'relation')),
  correct  smallint not null check (correct >= 0),
  total    smallint not null check (total between 1 and 40 and correct <= total),
  at       timestamptz not null default now(),
  primary key (user_id, day, mode)
);

alter table word_quiz_best enable row level security;
revoke all on word_quiz_best from anon, authenticated;
grant select on word_quiz_best to authenticated;
drop policy if exists "word_quiz_best_select_own" on word_quiz_best;
create policy "word_quiz_best_select_own" on word_quiz_best for select to authenticated using (user_id = auth.uid());

-- ───────────────────────── 함수 ─────────────────────────

-- 상자 → 다음 복습까지 며칠
create or replace function wm_interval(p_box int) returns int
language sql immutable set search_path = public as $$
  select case p_box when 1 then 1 when 2 then 3 when 3 then 7 when 4 then 16 when 5 then 35 end
$$;

-- 답한 결과 기록: p_results = [{"id": 단어 번호, "ok": 맞았는지}, …] (한 번에 200개까지)
-- 바뀐 단어들의 (word_id, box, due)를 돌려준다.
create or replace function wm_record(p_results jsonb)
returns table (word_id smallint, box smallint, due date)
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_item  jsonb;
  v_id    int;
  v_ok    boolean;
  v_row   word_progress%rowtype;
  v_box   int;
begin
  if v_uid is null or not exists (select 1 from profiles where id = v_uid) then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if jsonb_typeof(p_results) <> 'array' or jsonb_array_length(p_results) > 200 then
    raise exception '한 번에 200개까지 기록할 수 있어요' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_results) loop
    v_id := (v_item ->> 'id')::int;
    v_ok := coalesce((v_item ->> 'ok')::boolean, false);
    if v_id is null or v_id < 1 or v_id > 2000 then
      continue;
    end if;

    select * into v_row from word_progress wp where wp.user_id = v_uid and wp.word_id = v_id for update;
    if not found then
      v_box := case when v_ok then 2 else 1 end;
      insert into word_progress (user_id, word_id, box, due, seen, wrong)
      values (v_uid, v_id, v_box, v_today + wm_interval(v_box), 1, case when v_ok then 0 else 1 end);
    else
      if not v_ok then
        v_box := 1;
      elsif v_row.box < 6 and v_row.due <= v_today then
        v_box := v_row.box + 1;               -- 복습할 날이 된 단어를 맞힘 → 한 칸 위로
      else
        v_box := v_row.box;                   -- 날이 안 됐거나 이미 외운 단어 → 그대로
      end if;
      update word_progress wp set
        box   = v_box,
        due   = case when v_box = 6 then null
                     when v_box = v_row.box and v_ok then v_row.due
                     else v_today + wm_interval(v_box) end,
        seen  = wp.seen + 1,
        wrong = wp.wrong + case when v_ok then 0 else 1 end,
        last_at = now()
      where wp.user_id = v_uid and wp.word_id = v_id;
    end if;
  end loop;

  return query
    select wp.word_id, wp.box, wp.due from word_progress wp
    where wp.user_id = v_uid
      and wp.word_id in (select (e ->> 'id')::int from jsonb_array_elements(p_results) e where (e ->> 'id') ~ '^\d{1,4}$');
end;
$$;

-- 이 기기에만 저장돼 있던 진도(07을 실행하기 전에 쓴 것)를 계정으로 옮긴다. 이미 있는 단어는 건드리지 않는다.
-- p_rows = [{"id", "box", "due": "YYYY-MM-DD"|null, "seen", "wrong"}, …] (2000개까지)
create or replace function wm_import(p_rows jsonb)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_count int;
begin
  if v_uid is null or not exists (select 1 from profiles where id = v_uid) then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 2000 then
    raise exception '옮길 수 있는 단어는 2000개까지예요' using errcode = '22023';
  end if;

  with src as (
    select (e ->> 'id')::int as id,
           (e ->> 'box')::int as box,
           nullif(e ->> 'due', '')::date as due,
           least(greatest(coalesce((e ->> 'seen')::int, 1), 1), 10000) as seen,
           least(greatest(coalesce((e ->> 'wrong')::int, 0), 0), 10000) as wrong
    from jsonb_array_elements(p_rows) e
    where (e ->> 'id') ~ '^\d{1,4}$' and (e ->> 'box') ~ '^[1-6]$'
      and coalesce(e ->> 'due', '') ~ '^(\d{4}-\d{2}-\d{2})?$'
  ), ok as (
    -- 날짜는 오늘 기준 1년 전 ~ 35일 뒤만 받는다 (외움은 날짜 없음)
    select distinct on (id) * from src
    where id between 1 and 2000
      and ((box = 6 and due is null) or (box < 6 and due between v_today - 365 and v_today + 35))
    order by id
  )
  insert into word_progress (user_id, word_id, box, due, seen, wrong)
  select v_uid, id, box, due, seen, least(wrong, seen) from ok
  on conflict (user_id, word_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- DAY 하나(또는 null이면 전부)의 진도를 지우고 처음부터 다시
create or replace function wm_reset(p_day int)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  delete from word_progress wp
  where wp.user_id = v_uid and (p_day is null or (wp.word_id - 1) / 40 + 1 = p_day);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 퀴즈 결과 저장: 그 DAY·방식의 최고 점수(맞힌 비율, 같으면 문제 수가 많은 쪽)만 남긴다. 저장된 최고 점수를 돌려준다.
create or replace function wm_save_quiz(p_day int, p_mode text, p_correct int, p_total int)
returns table (correct smallint, total smallint)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (select 1 from profiles where id = v_uid) then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if p_day not between 1 and 50 or p_mode not in ('meaning', 'reverse', 'blank', 'relation')
     or p_total not between 1 and 40 or p_correct not between 0 and p_total then
    raise exception '잘못된 퀴즈 결과예요' using errcode = '22023';
  end if;

  insert into word_quiz_best as b (user_id, day, mode, correct, total)
  values (v_uid, p_day, p_mode, p_correct, p_total)
  on conflict (user_id, day, mode) do update set correct = excluded.correct, total = excluded.total, at = now()
  where excluded.correct::numeric / excluded.total > b.correct::numeric / b.total
     or (excluded.correct::numeric / excluded.total = b.correct::numeric / b.total and excluded.total > b.total);

  return query select b.correct, b.total from word_quiz_best b where b.user_id = v_uid and b.day = p_day and b.mode = p_mode;
end;
$$;

revoke execute on function wm_interval(int) from public, anon;
revoke execute on function wm_record(jsonb) from public, anon;
revoke execute on function wm_import(jsonb) from public, anon;
revoke execute on function wm_reset(int) from public, anon;
revoke execute on function wm_save_quiz(int, text, int, int) from public, anon;
grant execute on function wm_interval(int) to authenticated;
grant execute on function wm_record(jsonb) to authenticated;
grant execute on function wm_import(jsonb) to authenticated;
grant execute on function wm_reset(int) to authenticated;
grant execute on function wm_save_quiz(int, text, int, int) to authenticated;

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 08-levels.sql — 레벨(1~99)·캐릭터(진화 단계·표정)·닉네임 테두리
-- │ 실행 순서: supabase/parts의 번호 순. 이 파일 앞에 필요한 것: 01, 06 (sessions.lecture·과목 이름 '역사')
-- │ 여러 번 실행해도 안전하다(idempotent). 바뀐 파일만 SQL Editor에 붙여넣고 Run.
-- │ 고치면 `npm run schema`로 supabase/schema.sql(전체본)을 다시 만든다.
-- └──────────────────────────────────────────────────────────────────────

-- 레벨 (2026-11-09)
--   경험치 = 과목별 공부 시간의 합. 단, 과목마다 만렙에 필요한 시간까지만 센다:
--     국어·영어·수학 각 500시간, 사회·과학(탐구) 각 300시간, 역사 150시간 → 합계 2,250시간 = 만렙(99)
--   공부 시간은 순위와 같은 기준: 끝난 기록, 기타·인강 제외, 한 기록 1초~4시간.
--   레벨 = 1 + floor(98 × √(경험치 / 2,250시간)) — 처음엔 빨리 오르고 갈수록 느려진다 (레벨 2는 약 14분, 10은 약 19시간).
--   앱(lib/levels.ts)도 같은 식으로 계산한다. 바꾸면 둘 다 고친다.
-- 보상 (사용자가 정한 표, 2026-11-11): 1 캐릭터 스킨 1단계 · 10 표정 · 20 칭호 · 30 프로필 사진 · 40 스킨 2단계 · 50 칭호
--   · 60 테마 · 70 스킨 3단계 · 80 닉네임 테두리 · 90 칭호 · 99 스킨 최종. (칭호·프로필 사진·테마는 아직 준비 중)
-- 닉네임 테두리 (디스코드 이름표 같은 것): 80레벨에 10종이 한꺼번에 열린다. name_frame_min_level()과 lib/levels.ts의 NAME_FRAMES를 같게.
-- 캐릭터: profiles.character_skin = '<history|science|math|society>:<단계 1~4>:<표정 1~3>'.
--   단계가 열리는 레벨 1·40·70·99, 표정(1번 말고)은 10레벨. character_allowed()와 lib/characters.ts를 같게.

-- ───────────────────────── 닉네임 테두리 열 ─────────────────────────
alter table profiles add column if not exists name_frame text;
alter table profiles drop constraint if exists profiles_name_frame_check;
alter table profiles add constraint profiles_name_frame_check check (name_frame is null or name_frame ~ '^[a-z0-9-]{1,32}$');
-- 직접 수정 권한은 06의 열 권한(nickname·grade·class_no·avatar·track)에 없으므로 set_name_frame()으로만 바뀐다.

-- ───────────────────────── 캐릭터 열 ─────────────────────────
alter table profiles add column if not exists character_skin text;
alter table profiles drop constraint if exists profiles_character_check;
alter table profiles add constraint profiles_character_check check (character_skin is null or character_skin ~ '^(history|science|math|society):[1-4]:[1-3]$');
-- 이 열도 06의 열 권한에 없으므로 set_character()로만 바뀐다.

-- ───────────────────────── 계산 ─────────────────────────

-- 과목별 만렙 시간(초). 순위에 들어가는 6과목만
create or replace function level_subject_cap(p_subject text) returns int
language sql immutable set search_path = public as $$
  select case p_subject
    when '국어' then 500 * 3600 when '영어' then 500 * 3600 when '수학' then 500 * 3600
    when '사회' then 300 * 3600 when '과학' then 300 * 3600
    when '역사' then 150 * 3600
    else 0 end
$$;

-- 만렙 경험치(초) = 2,250시간
create or replace function level_max_xp() returns bigint
language sql immutable set search_path = public as $$
  select (500 * 3 + 300 * 2 + 150)::bigint * 3600
$$;

-- 경험치(초) → 레벨 1~99
create or replace function level_from_xp(p_xp bigint) returns int
language sql immutable set search_path = public as $$
  select least(99, 1 + floor(98 * sqrt(greatest(p_xp, 0)::numeric / level_max_xp()))::int)
$$;

-- 테두리 → 열리는 레벨 (없는 테두리는 null)
create or replace function name_frame_min_level(p_code text) returns int
language sql immutable set search_path = public as $$
  select case when p_code in ('sprout', 'wave', 'blossom', 'bronze', 'silver', 'gold', 'amethyst', 'aurora', 'starlight', 'daepumta') then 80 end
$$;

-- 이 레벨에서 그 캐릭터(단계·표정)를 쓸 수 있는지
create or replace function character_allowed(p_level int, p_value text) returns boolean
language sql immutable set search_path = public as $$
  select p_value ~ '^(history|science|math|society):[1-4]:[1-3]$'
     and p_level >= (array[1, 40, 70, 99])[split_part(p_value, ':', 2)::int]
     and (split_part(p_value, ':', 3) = '1' or p_level >= 10)
$$;

-- 학생 여럿의 경험치 (내부용 — 앱이 직접 부르지 못함)
create or replace function level_xp_of(p_users uuid[])
returns table (user_id uuid, xp bigint)
language sql stable security definer set search_path = public as $$
  with per as (
    select s.user_id, s.subject, sum(s.duration)::bigint as sec
    from sessions s
    where s.user_id = any (p_users)
      and s.subject in ('국어', '영어', '수학', '사회', '과학', '역사')
      and not s.lecture
      and s.duration between 1 and 14400
    group by 1, 2
  )
  select u.id, coalesce(sum(least(per.sec, level_subject_cap(per.subject))), 0)::bigint
  from unnest(p_users) as u(id)
  left join per on per.user_id = u.id
  group by u.id
$$;

-- ───────────────────────── 앱이 부르는 함수 ─────────────────────────

-- 내 레벨: {level, xp, max_xp, frame, character, subjects: [{subject, sec, cap}]} (sec는 만렙 시간까지만 센 값이 아니라 실제 시간)
create or replace function my_level()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_xp bigint;
  v_subjects jsonb;
  v_frame text;
  v_character text;
begin
  if v_uid is null or not exists (select 1 from profiles where id = v_uid) then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('subject', subj, 'sec', coalesce(sec, 0), 'cap', level_subject_cap(subj)) order by ord), '[]'::jsonb)
    into v_subjects
  from unnest(array['국어', '영어', '수학', '사회', '과학', '역사']) with ordinality as t(subj, ord)
  left join lateral (
    select sum(s.duration)::bigint as sec from sessions s
    where s.user_id = v_uid and s.subject = t.subj and not s.lecture and s.duration between 1 and 14400
  ) x on true;
  select xp into v_xp from level_xp_of(array[v_uid]);
  select name_frame, character_skin into v_frame, v_character from profiles where id = v_uid;
  -- 레벨이 내려가서(기록 삭제 등) 못 쓰게 된 테두리는 보여 주지 않는다
  if v_frame is not null and coalesce(name_frame_min_level(v_frame), 999) > level_from_xp(v_xp) then
    v_frame := null;
  end if;
  -- 레벨이 내려가 못 쓰게 된 캐릭터 단계·표정은 보여 주지 않는다
  if v_character is not null and not character_allowed(level_from_xp(v_xp), v_character) then
    v_character := null;
  end if;
  return jsonb_build_object('level', level_from_xp(v_xp), 'xp', v_xp, 'max_xp', level_max_xp(), 'frame', v_frame, 'character', v_character, 'subjects', v_subjects);
end;
$$;

-- 닉네임 테두리 달기(null이면 떼기). 그 레벨이 안 되면 'locked', 없는 테두리면 'invalid'
create or replace function set_name_frame(p_code text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_need int;
  v_level int;
begin
  if v_uid is null or not exists (select 1 from profiles where id = v_uid) then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if p_code is not null then
    v_need := name_frame_min_level(p_code);
    if v_need is null then
      return 'invalid';
    end if;
    select level_from_xp(xp) into v_level from level_xp_of(array[v_uid]);
    if v_level < v_need then
      return 'locked';
    end if;
  end if;
  update profiles set name_frame = p_code where id = v_uid;
  return 'ok';
end;
$$;

-- 캐릭터 고르기(null이면 안 고름). 그 레벨이 안 되면 'locked', 모양이 틀리면 'invalid'
create or replace function set_character(p_value text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_level int;
begin
  if v_uid is null or not exists (select 1 from profiles where id = v_uid) then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if p_value is not null then
    if p_value !~ '^(history|science|math|society):[1-4]:[1-3]$' then
      return 'invalid';
    end if;
    select level_from_xp(xp) into v_level from level_xp_of(array[v_uid]);
    if not character_allowed(v_level, p_value) then
      return 'locked';
    end if;
  end if;
  update profiles set character_skin = p_value where id = v_uid;
  return 'ok';
end;
$$;

-- 순위·그룹 화면에 보이는 학생들의 레벨·테두리 (닉네임으로, 100명까지).
-- 순위에 이미 공개되는 닉네임에 레벨과 테두리만 더한다. 레벨이 모자라게 된 테두리는 null.
create or replace function player_cards(p_nicknames text[])
returns table (nickname text, level int, name_frame text)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from profiles where id = auth.uid()) then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if coalesce(array_length(p_nicknames, 1), 0) > 100 then
    raise exception '한 번에 100명까지 볼 수 있어요' using errcode = '22023';
  end if;
  return query
    with ps as (
      select p.id, p.nickname, p.name_frame from profiles p where p.nickname = any (p_nicknames)
    ), lv as (
      select x.user_id, level_from_xp(x.xp) as level from level_xp_of(array(select id from ps)) x
    )
    select ps.nickname, lv.level,
           case when ps.name_frame is not null and coalesce(name_frame_min_level(ps.name_frame), 999) <= lv.level then ps.name_frame end
    from ps join lv on lv.user_id = ps.id;
end;
$$;

revoke execute on function level_subject_cap(text) from public, anon;
revoke execute on function level_max_xp() from public, anon;
revoke execute on function level_from_xp(bigint) from public, anon;
revoke execute on function name_frame_min_level(text) from public, anon;
revoke execute on function level_xp_of(uuid[]) from public, anon, authenticated;
revoke execute on function character_allowed(int, text) from public, anon;
revoke execute on function set_character(text) from public, anon;
revoke execute on function my_level() from public, anon;
revoke execute on function set_name_frame(text) from public, anon;
revoke execute on function player_cards(text[]) from public, anon;
grant execute on function level_subject_cap(text) to authenticated;
grant execute on function level_max_xp() to authenticated;
grant execute on function level_from_xp(bigint) to authenticated;
grant execute on function name_frame_min_level(text) to authenticated;
grant execute on function character_allowed(int, text) to authenticated;
grant execute on function set_character(text) to authenticated;
grant execute on function my_level() to authenticated;
grant execute on function set_name_frame(text) to authenticated;
grant execute on function player_cards(text[]) to authenticated;
