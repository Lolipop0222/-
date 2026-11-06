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
