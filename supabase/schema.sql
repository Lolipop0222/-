-- 대고 일품타 · Supabase 스키마 (프로필 · 공부 기록 · 과목별 순위 · 디데이 · 플래너)
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 된다.
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

-- 과목 목록 (이미 만들어진 DB도 새 목록으로). '기타'는 순위·공부 합계에 들어가지 않는 개인 타이머
alter table sessions drop constraint if exists sessions_subject_check;
alter table sessions add constraint sessions_subject_check check (subject in ('국어', '영어', '수학', '과학', '사회', '한국사', '인강', '기타'));
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

alter table routines drop constraint if exists routines_subject_check;
alter table routines add constraint routines_subject_check check (subject in ('국어', '영어', '수학', '과학', '사회', '한국사', '인강', '기타'));
alter table tasks drop constraint if exists tasks_subject_check;
alter table tasks add constraint tasks_subject_check check (subject in ('국어', '영어', '수학', '과학', '사회', '한국사', '인강', '기타'));

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

-- 공부 시작: 서버가 started_at을 찍는다. 켜져 있던 세션은 지금 시각으로 끝낸다.
-- p_task_id: 플래너 과제와 연결 (내 과제만)
drop function if exists start_session(text);  -- 예전(과목만 받던) 버전
create or replace function start_session(p_subject text, p_task_id uuid default null)
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

  select coalesce(sum(duration), 0) into today_sec
  from sessions
  where user_id = auth.uid() and started_at >= kst_day_start() and duration between 1 and 14400 and subject <> '기타';
  if today_sec >= 16 * 3600 then
    raise exception '오늘은 16시간을 넘게 공부해서 더 기록할 수 없습니다';
  end if;

  insert into sessions (user_id, subject, task_id) values (auth.uid(), p_subject, p_task_id) returning * into r;
  return r;
end $$;

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

-- 이번 주 순위. p_scope: 'school' | 'grade' | 'class', p_subject: null이면 전체 과목
-- 닉네임·학년·반·합계·공부 중 여부만 내보낸다. 진행 중인 세션은 끝나야 합계에 들어간다.
create or replace function get_ranking(p_scope text default 'school', p_subject text default null)
returns table (rank bigint, nickname text, grade int, class_no int, total_sec bigint, studying boolean, is_me boolean)
language sql stable security definer set search_path = public as $$
  with me as (
    select grade, class_no from profiles where id = auth.uid()
  ),
  totals as (
    select user_id, sum(duration)::bigint as total
    from sessions
    where started_at >= kst_week_start()
      and duration between 1 and 14400
      and subject <> '기타'  -- 기타는 순위에 안 들어간다
      and (p_subject is null or subject = p_subject)
    group by user_id
  ),
  live as (
    select distinct user_id from sessions
    where ended_at is null and started_at > now() - interval '4 hours' and subject <> '기타'
  )
  select rank() over (order by coalesce(t.total, 0) desc) as rank,
         p.nickname, p.grade, p.class_no,
         coalesce(t.total, 0) as total_sec,
         l.user_id is not null as studying,
         p.id = auth.uid() as is_me
  from profiles p
  cross join me
  left join totals t on t.user_id = p.id
  left join live l on l.user_id = p.id
  where p_scope = 'school'
     or (p_scope = 'grade' and p.grade = me.grade)
     or (p_scope = 'class' and p.grade = me.grade and p.class_no = me.class_no)
  order by rank, p.nickname
$$;

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
revoke execute on function start_session(text, uuid) from public, anon;
revoke execute on function materialize_routines(date) from public, anon;
revoke execute on function end_session(uuid, int, timestamptz) from public, anon;
revoke execute on function get_ranking(text, text) from public, anon;
grant execute on function create_profile(text, int, int, text) to authenticated;
grant execute on function start_session(text, uuid) to authenticated;
grant execute on function materialize_routines(date) to authenticated;
grant execute on function end_session(uuid, int, timestamptz) to authenticated;
grant execute on function get_ranking(text, text) to authenticated;

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
