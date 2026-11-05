-- ┌──────────────────────────────────────────────────────────────────────
-- │ 04-titles.sql — 칭호·프로필 그림/사진 규칙·순위(get_ranking, get_group_ranking)
-- │ 실행 순서: supabase/parts의 번호 순. 이 파일 앞에 필요한 것: 01, 02, 03
-- │ 여러 번 실행해도 안전하다(idempotent). 바뀐 파일만 SQL Editor에 붙여넣고 Run.
-- │ 고치면 `npm run schema`로 supabase/schema.sql(전체본)을 다시 만든다.
-- └──────────────────────────────────────────────────────────────────────

-- ═════════════════════════ 칭호 · 프로필 그림 ═════════════════════════
-- 조건을 채우면 칭호를 얻고(영구 보관), 얻은 칭호 하나를 닉네임 옆에 단다. 판정은 전부 서버(check_titles)가 한다.
-- 공부 시간은 순위와 같은 기준: '기타' 제외, 한 기록 1초~4시간만. 날짜·요일·시각은 한국 시간, 기록은 "시작한 날"에 센다.
-- 칭호를 더하려면: title_defs에 한 줄(아래 insert)만 넣으면 된다. 새로운 종류의 조건이면 title_stats()에 값을 하나 더 계산한다.
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

-- 학생이 프로필에서 직접 고칠 수 있는 열은 닉네임·학년·반·그림뿐. 대표 칭호는 set_title()로만 (얻은 칭호인지 확인)
revoke update on profiles from authenticated;
grant update (nickname, grade, class_no, avatar) on profiles to authenticated;

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
  ('subj_his',      '역사 지킴이',      'rare',      '과목',      '한국사 누적 50시간',                                    'sub_his',        180000,  'hour',  55),
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

-- 한 학생의 칭호 판정용 값들 (앱에서 직접 못 부름). 값은 모두 숫자, 예/아니오는 1/0
create or replace function title_stats(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r jsonb;
begin
  with
  -- 순위와 같은 기준의 공부 기록 (기타 제외, 1초~4시간). ls/le = 한국 시각
  v as (
    select s.subject, s.duration, s.away_count,
           s.started_at at time zone 'Asia/Seoul' as ls,
           s.ended_at at time zone 'Asia/Seoul' as le
    from sessions s
    where s.user_id = p_user and s.subject <> '기타' and s.duration between 1 and 14400
  ),
  -- 히든 조건용: 진행 중인 기록도 포함 (기타 제외, 4시간 넘게 켜 둔 것은 제외)
  a as (
    select s.duration,
           s.started_at at time zone 'Asia/Seoul' as ls,
           coalesce(s.ended_at, now()) at time zone 'Asia/Seoul' as le
    from sessions s
    where s.user_id = p_user and s.subject <> '기타'
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
    where s.subject <> '기타' and s.duration between 1 and 14400 and s.started_at < kst_week_start()
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
    'sub_his',        coalesce((select sum(duration) from v where subject = '한국사'), 0),
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

-- ───────────────────────── 순위 (칭호·그림 포함) ─────────────────────────
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

-- 그룹 안 이번 주 순위 (그룹원만). 오늘 시간·공부 중 여부도 같이. 규칙은 get_ranking과 같다 (4시간 넘는 세션·기타 제외)
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
        and s.subject <> '기타'
        and (p_subject is null or s.subject = p_subject)
      group by s.user_id
    ),
    live as (
      select distinct s.user_id from sessions s
      where s.user_id in (select user_id from members)
        and s.ended_at is null and s.started_at > now() - interval '4 hours' and s.subject <> '기타'
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

revoke execute on function title_stats(uuid) from public, anon, authenticated;
revoke execute on function profiles_avatar_guard() from public, anon, authenticated;
revoke execute on function check_titles() from public, anon;
revoke execute on function my_titles() from public, anon;
revoke execute on function set_title(text) from public, anon;
revoke execute on function get_ranking(text, text) from public, anon;
revoke execute on function get_group_ranking(uuid, text) from public, anon;
grant execute on function check_titles() to authenticated;
grant execute on function my_titles() to authenticated;
grant execute on function set_title(text) to authenticated;
grant execute on function get_ranking(text, text) to authenticated;
grant execute on function get_group_ranking(uuid, text) to authenticated;
