-- ┌──────────────────────────────────────────────────────────────────────
-- │ 11-manual.sql — 공부 시간 직접 입력 ("몇 시 몇 분부터 몇 시 몇 분까지")
-- │ 실행 순서: supabase/parts의 번호 순. 이 파일 앞에 필요한 것: 06 (sessions.manual·detail·lecture 열)
-- │ 여러 번 실행해도 안전하다(idempotent). 바뀐 파일만 SQL Editor에 붙여넣고 Run.
-- │ 고치면 `npm run schema`로 supabase/schema.sql(전체본)을 다시 만든다.
-- └──────────────────────────────────────────────────────────────────────

-- 직접 입력 (2026-11-22, 사용자: "대전고는 전자기기가 금지라 공부 시간을 몇 시 몇 분부터 몇 시 몇 분까지 입력하면 반영되게, 타이머는 그대로")
--   타이머와 같이 순위·레벨·칭호·통계에 들어간다(manual = true로 표시). 거짓 입력을 줄이려고 서버가 검사한다:
--   · 오늘·어제(한국 날짜, 시작 기준)만, 미래 시각은 안 됨
--   · 한 기록 1분~4시간 (4시간이 넘는 기록은 원래 합계에서 빠진다)
--   · 내 다른 기록(타이머·직접 입력·기타)과 시간이 겹치면 안 됨 (4시간 넘게 켜 둬서 이미 빠진 기록은 무시)
--   · 그날 공부 합계(기타·인강 제외) 16시간까지 — 타이머의 하루 상한과 같다
--   · 직접 입력은 하루 20개까지
--   지우기는 내가 직접 입력한 것만, 오늘·어제 것만. 고치려면 지우고 다시 넣는다.
--   틀린 값은 오류 대신 결과 글자를 돌려준다(앱이 한국어로 보여 줌).
--   p_task_id (2026-11-22, 사용자: "일과 = 플래너에 적은 하루에 할 공부"): 플래너 과제와 이어 붙인다 → 플래너에 그 과제 시간이 쌓인다.
--   내 과제가 아니면 'invalid'.

drop function if exists add_manual_session(text, timestamptz, timestamptz, text, boolean);  -- 예전(과제 없는) 모양
create or replace function add_manual_session(
  p_subject text, p_start timestamptz, p_end timestamptz, p_detail text default null, p_lecture boolean default false,
  p_task_id uuid default null
) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_sec int;
  v_lecture boolean := coalesce(p_lecture, false);
  v_day date;
  v_day_start timestamptz;
  v_day_sec bigint;
begin
  if v_uid is null or not exists (select 1 from profiles where id = v_uid) then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if p_subject is null or p_subject not in ('국어', '영어', '수학', '사회', '과학', '역사') or p_start is null or p_end is null
     or (p_detail is not null and char_length(trim(p_detail)) > 20)
     or (p_task_id is not null and not exists (select 1 from tasks where id = p_task_id and user_id = v_uid)) then
    return 'invalid';
  end if;
  if p_end > now() + interval '1 minute' then
    return 'future';
  end if;
  if p_start < kst_day_start() - interval '1 day' then
    return 'range';
  end if;
  v_sec := extract(epoch from (p_end - p_start))::int;
  if v_sec < 60 then
    return 'too_short';
  end if;
  if v_sec > 14400 then
    return 'too_long';
  end if;

  -- 같은 학생이 동시에 두 번 넣어도 겹치지 않게 차례로 처리
  perform pg_advisory_xact_lock(hashtext('manual:' || v_uid::text));

  if exists (
    select 1 from sessions s
    where s.user_id = v_uid
      and s.started_at < p_end and coalesce(s.ended_at, now()) > p_start
      and (s.ended_at is null or s.duration <= 14400)
  ) then
    return 'overlap';
  end if;

  v_day := (p_start at time zone 'Asia/Seoul')::date;
  v_day_start := v_day::timestamp at time zone 'Asia/Seoul';
  if (select count(*) from sessions s where s.user_id = v_uid and s.manual
        and s.started_at >= v_day_start and s.started_at < v_day_start + interval '1 day') >= 20 then
    return 'limit';
  end if;
  if not v_lecture then
    select coalesce(sum(s.duration), 0) into v_day_sec
    from sessions s
    where s.user_id = v_uid and s.started_at >= v_day_start and s.started_at < v_day_start + interval '1 day'
      and s.duration between 1 and 14400 and s.subject <> '기타' and not s.lecture;
    if v_day_sec + v_sec > 16 * 3600 then
      return 'daily_cap';
    end if;
  end if;

  insert into sessions (user_id, subject, started_at, ended_at, detail, lecture, manual, task_id)
  values (v_uid, p_subject, p_start, p_end, nullif(trim(p_detail), ''), v_lecture, true, p_task_id);
  return 'ok';
end $$;
revoke execute on function add_manual_session(text, timestamptz, timestamptz, text, boolean, uuid) from public, anon;
grant execute on function add_manual_session(text, timestamptz, timestamptz, text, boolean, uuid) to authenticated;

-- 내가 직접 입력한 기록 지우기 (오늘·어제 것만). 지웠으면 true
create or replace function delete_manual_session(p_id uuid) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  delete from sessions
  where id = p_id and user_id = auth.uid() and manual and started_at >= kst_day_start() - interval '1 day';
  return found;
end $$;
revoke execute on function delete_manual_session(uuid) from public, anon;
grant execute on function delete_manual_session(uuid) to authenticated;

-- ───────────────────────── 내 일과 (자주 쓰는 시간대) ─────────────────────────
-- 직접 입력에서 한 번 누르면 시각(과목·세부까지 정했으면 그것도)이 채워진다. 예: 「야자 1교시 18:50~20:10」.
-- 2026-11-22 처음엔 기기 저장(localStorage)이었다가 사용자 요청으로 계정에 저장. 앱이 기기에 있던 것을 처음 한 번 옮긴다.
create table if not exists time_presets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references profiles (id) on delete cascade,
  name       text not null check (char_length(trim(name)) between 1 and 12),
  start_time time not null,
  end_time   time not null,
  subject    text check (subject in ('국어', '영어', '수학', '사회', '과학', '역사')),
  detail     text check (detail is null or char_length(detail) between 1 and 20),
  created_at timestamptz not null default now(),
  check (start_time <> end_time),
  check (detail is null or subject is not null)
);
create index if not exists time_presets_user_idx on time_presets (user_id);
alter table time_presets enable row level security;
revoke all on time_presets from anon;
revoke truncate, trigger, references on time_presets from authenticated;
drop policy if exists "내 일과 조회" on time_presets;
create policy "내 일과 조회" on time_presets for select to authenticated using (auth.uid() = user_id);
drop policy if exists "내 일과 추가" on time_presets;
create policy "내 일과 추가" on time_presets for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "내 일과 수정" on time_presets;
create policy "내 일과 수정" on time_presets for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "내 일과 삭제" on time_presets;
create policy "내 일과 삭제" on time_presets for delete to authenticated using (auth.uid() = user_id);

-- 한 사람 20개까지
create or replace function time_presets_limit() returns trigger
language plpgsql set search_path = public as $$
begin
  if (select count(*) from time_presets where user_id = new.user_id) >= 20 then
    raise exception '일과는 20개까지 만들 수 있어요';
  end if;
  return new;
end $$;
revoke execute on function time_presets_limit() from public, anon, authenticated;
drop trigger if exists time_presets_limit on time_presets;
create trigger time_presets_limit before insert on time_presets for each row execute function time_presets_limit();
