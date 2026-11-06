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

update sessions set subject = '역사' where subject = '한국사';
update tasks set subject = '역사' where subject = '한국사';
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
