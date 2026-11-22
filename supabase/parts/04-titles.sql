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
  grade       text not null,  -- 등급 목록은 아래 title_defs_grade_check. hidden = 얻기 전엔 이름·조건 비공개
  category    text not null,
  description text not null,
  metric      text not null,   -- title_stats()가 돌려주는 값 이름
  goal        numeric not null,  -- metric이 이 값 이상이면 지급
  unit        text not null default 'flag' check (unit in ('flag', 'hour', 'day', 'count', 'level')),  -- 진행도 표시용 (hour는 초 단위로 저장, level은 과목 레벨)
  sort        int not null default 0,
  active      boolean not null default true
);
-- 관리자 화면(09-admin-titles.sql)용: custom = 관리자가 새로 만든 칭호(지울 수 있음), edited = 관리자가 고친 칭호
-- (고친 칭호는 이 파일을 다시 실행해도 아래 기본 목록으로 덮어쓰지 않는다)
alter table title_defs add column if not exists custom boolean not null default false;
alter table title_defs add column if not exists edited boolean not null default false;
-- 등급 (2026-11-22 사용자 요청: 초희귀·신화 추가): 일반 < 희귀 < 초희귀 < 영웅 < 신화 < 전설, 그리고 히든
alter table title_defs drop constraint if exists title_defs_grade_check;
alter table title_defs add constraint title_defs_grade_check
  check (grade in ('common', 'rare', 'superrare', 'epic', 'mythic', 'legendary', 'hidden'));
-- 진행도 단위 (2026-11-22 과목 레벨 칭호용 'level' 추가)
alter table title_defs drop constraint if exists title_defs_unit_check;
alter table title_defs add constraint title_defs_unit_check check (unit in ('flag', 'hour', 'day', 'count', 'level'));
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
-- 관리자가 회수한 칭호: 줄은 남겨 두어(revoked) 자동 판정이 다시 주지 않게 한다. 다시 주면 false로
alter table user_titles add column if not exists revoked boolean not null default false;

alter table profiles drop constraint if exists profiles_title_code_fkey;
alter table profiles add constraint profiles_title_code_fkey foreign key (title_code) references title_defs (code) on delete set null;

-- 학생이 프로필에서 직접 고칠 수 있는 열(열 권한)은 06-subjects.sql에서 정한다 (계열 열이 거기서 생기므로)

-- 등급 올리기 (2026-11-22, 한 번만): 일반 → 희귀, 희귀 → 초희귀. app_settings의 표시로 다시 실행해도 또 오르지 않게 한다
do $$
begin
  if not exists (select 1 from app_settings where key = 'title_grades_v2') then
    update title_defs set grade = case grade when 'rare' then 'superrare' else 'rare' end where grade in ('common', 'rare');
    insert into app_settings (key, value) values ('title_grades_v2', 'done');
  end if;
end $$;

-- 과목 칭호 (2026-11-22 사용자 요청으로 바꿈): 예전 과목 칭호(과목 누적 50시간) 6개를 지우고,
-- 과목 레벨(08의 레벨 식을 그 과목 만렙 시간에 적용 — 06의 subject_level()) 10·40·70·99에 주는 칭호 24개로.
--   10 「과목 뉴비」 희귀 · 40 「과목 중수」 초희귀 · 70 「과목 고수」 영웅 · 99 「과목 마스터」 신화
-- 과목 누적 1,000시간 전설 (과목마다 따로 디자인 — globals.css .tb-sig-*, components/TitleBadge.tsx SIGNATURE):
--   국어 문장가 · 영어 네이티브 · 수학 Q.E.D. · 사회 세계 시민 · 과학 유레카 · 역사 사관  (code sub1k_<과목>)
-- 과목 주간 전교 1위 히든 (끝난 주, 그 과목 3시간 이상 + 그 과목 기록 학생 3명 이상, 06 title_stats의 wtop_*):
--   국어 장원 급제 · 영어 No.1 · 수학 최댓값 · 사회 지지율 1위 · 과학 1번 원소 · 역사 태조  (code top_<과목>)
-- 예전 것을 얻은 학생의 기록·대표 칭호도 함께 사라진다(user_titles는 on delete cascade, 대표 칭호는 set null).
delete from title_defs where code in ('subj_kor', 'subj_eng', 'subj_math', 'subj_sci', 'subj_soc', 'subj_his');

insert into title_defs (code, name, grade, category, description, metric, goal, unit, sort) values
  ('first_page',    '첫 페이지',        'rare',    '누적 공부', '첫 공부 기록(1분 이상)을 남기기',                        'first_record',   1,       'flag',  10),
  ('study_10h',     '공부 입문자',      'rare',    '누적 공부', '누적 공부 10시간',                                      'total_sec',      36000,   'hour',  11),
  ('study_50h',     '반백 시간',        'superrare',      '누적 공부', '누적 공부 50시간',                                      'total_sec',      180000,  'hour',  12),
  ('study_100h',    '백 시간 클럽',     'epic',      '누적 공부', '누적 공부 100시간',                                     'total_sec',      360000,  'hour',  13),
  ('study_500h',    '서울대의 자질',    'legendary', '누적 공부', '누적 공부 500시간',                                     'total_sec',      1800000, 'hour',  14),
  ('day_3h',        '오늘도 열공',      'rare',    '하루 공부', '하루에 3시간 공부',                                     'max_day_sec',    10800,   'hour',  20),
  ('day_6h',        '하루를 바친 자',   'superrare',      '하루 공부', '하루에 6시간 공부',                                     'max_day_sec',    21600,   'hour',  21),
  ('day_10h',       '열 시간의 영웅',   'epic',      '하루 공부', '하루에 10시간 공부',                                    'max_day_sec',    36000,   'hour',  22),
  ('focus_2h',      '부동자세',         'superrare',      '집중',      '한 번에 2시간 이상, 앱을 한 번도 벗어나지 않고 공부',      'focus_2h',       1,       'flag',  30),
  ('streak_3',      '작심삼일 돌파',    'rare',    '연속 출석', '하루 30분 이상 공부한 날 3일 연속',                      'max_streak',     3,       'day',   40),
  ('streak_7',      '일주일 개근',      'superrare',      '연속 출석', '하루 30분 이상 공부한 날 7일 연속',                      'max_streak',     7,       'day',   41),
  ('streak_30',     '한 달의 끈기',     'epic',      '연속 출석', '하루 30분 이상 공부한 날 30일 연속',                     'max_streak',     30,      'day',   42),
  ('streak_100',    '백일의 기적',      'legendary', '연속 출석', '하루 30분 이상 공부한 날 100일 연속',                    'max_streak',     100,     'day',   43),
  ('slv_kor_10',    '국어 뉴비',  'rare',      '과목',      '국어 레벨 10',                        'lv_kor',       10,   'level', 50),
  ('slv_eng_10',    '영어 뉴비',  'rare',      '과목',      '영어 레벨 10',                        'lv_eng',       10,   'level', 51),
  ('slv_math_10',   '수학 뉴비',  'rare',      '과목',      '수학 레벨 10',                        'lv_math',      10,   'level', 52),
  ('slv_soc_10',    '사회 뉴비',  'rare',      '과목',      '사회 레벨 10',                        'lv_soc',       10,   'level', 53),
  ('slv_sci_10',    '과학 뉴비',  'rare',      '과목',      '과학 레벨 10',                        'lv_sci',       10,   'level', 54),
  ('slv_his_10',    '역사 뉴비',  'rare',      '과목',      '역사 레벨 10',                        'lv_his',       10,   'level', 55),
  ('slv_kor_40',    '국어 중수',  'superrare', '과목',      '국어 레벨 40',                        'lv_kor',       40,   'level', 56),
  ('slv_eng_40',    '영어 중수',  'superrare', '과목',      '영어 레벨 40',                        'lv_eng',       40,   'level', 57),
  ('slv_math_40',   '수학 중수',  'superrare', '과목',      '수학 레벨 40',                        'lv_math',      40,   'level', 58),
  ('slv_soc_40',    '사회 중수',  'superrare', '과목',      '사회 레벨 40',                        'lv_soc',       40,   'level', 59),
  ('slv_sci_40',    '과학 중수',  'superrare', '과목',      '과학 레벨 40',                        'lv_sci',       40,   'level', 60),
  ('slv_his_40',    '역사 중수',  'superrare', '과목',      '역사 레벨 40',                        'lv_his',       40,   'level', 61),
  ('slv_kor_70',    '국어 고수',  'epic',      '과목',      '국어 레벨 70',                        'lv_kor',       70,   'level', 62),
  ('slv_eng_70',    '영어 고수',  'epic',      '과목',      '영어 레벨 70',                        'lv_eng',       70,   'level', 63),
  ('slv_math_70',   '수학 고수',  'epic',      '과목',      '수학 레벨 70',                        'lv_math',      70,   'level', 64),
  ('slv_soc_70',    '사회 고수',  'epic',      '과목',      '사회 레벨 70',                        'lv_soc',       70,   'level', 65),
  ('slv_sci_70',    '과학 고수',  'epic',      '과목',      '과학 레벨 70',                        'lv_sci',       70,   'level', 66),
  ('slv_his_70',    '역사 고수',  'epic',      '과목',      '역사 레벨 70',                        'lv_his',       70,   'level', 67),
  ('slv_kor_99',    '국어 마스터', 'mythic',    '과목',      '국어 레벨 99 (만렙 · 국어 500시간)', 'lv_kor',       99,   'level', 68),
  ('slv_eng_99',    '영어 마스터', 'mythic',    '과목',      '영어 레벨 99 (만렙 · 영어 500시간)', 'lv_eng',       99,   'level', 69),
  ('slv_math_99',   '수학 마스터', 'mythic',    '과목',      '수학 레벨 99 (만렙 · 수학 500시간)', 'lv_math',      99,   'level', 70),
  ('slv_soc_99',    '사회 마스터', 'mythic',    '과목',      '사회 레벨 99 (만렙 · 사회 300시간)', 'lv_soc',       99,   'level', 71),
  ('slv_sci_99',    '과학 마스터', 'mythic',    '과목',      '과학 레벨 99 (만렙 · 과학 300시간)', 'lv_sci',       99,   'level', 72),
  ('slv_his_99',    '역사 마스터', 'mythic',    '과목',      '역사 레벨 99 (만렙 · 역사 150시간)', 'lv_his',       99,   'level', 73),
  ('sub1k_kor', '문장가', 'legendary', '과목', '국어 누적 1,000시간', 'sub_kor', 3600000, 'hour', 74),
  ('sub1k_eng', '네이티브', 'legendary', '과목', '영어 누적 1,000시간', 'sub_eng', 3600000, 'hour', 75),
  ('sub1k_math', 'Q.E.D.', 'legendary', '과목', '수학 누적 1,000시간', 'sub_math', 3600000, 'hour', 76),
  ('sub1k_soc', '세계 시민', 'legendary', '과목', '사회 누적 1,000시간', 'sub_soc', 3600000, 'hour', 77),
  ('sub1k_sci', '유레카', 'legendary', '과목', '과학 누적 1,000시간', 'sub_sci', 3600000, 'hour', 78),
  ('sub1k_his', '사관', 'legendary', '과목', '역사 누적 1,000시간', 'sub_his', 3600000, 'hour', 79),
  ('all_rounder',   '올라운더',         'superrare',      '골고루',    '하루에 서로 다른 5과목을 각각 20분 이상',                 'allround',       1,       'flag',  82),
  ('week_class',    '우리 반 에이스',   'superrare',      '주간 순위', '반 주간 1위 (그 주 5시간 이상, 반에 기록 있는 학생 3명 이상)',   'week_class_top',  1, 'flag', 83),
  ('week_grade',    '학년 1짱',         'epic',      '주간 순위', '학년 주간 1위 (그 주 5시간 이상, 학년에 기록 있는 학생 3명 이상)', 'week_grade_top',  1, 'flag', 84),
  ('week_school',   '대고 일품인',      'legendary', '주간 순위', '전교 주간 1위 (그 주 5시간 이상, 기록 있는 학생 3명 이상)',     'week_school_top', 1, 'flag', 85),
  ('planner_100',   '계획의 달인',      'epic',      '플래너·야자', '플래너 과제 누적 100개 완료',                          'tasks_done',     100,     'count', 80),
  ('yaja_king',     '야자의 왕',        'epic',      '플래너·야자', '평일 18시~22시에 2시간 이상 공부한 날 누적 20일',        'yaja_days',      20,      'day',   81),
  ('reset_hunter',  '리셋 사냥꾼',      'hidden',    '히든',      '순위가 초기화되는 월요일 0시~0시 5분에 공부 시작',          'reset_hunter',   1,       'flag',  90),
  ('on_the_hour',   '정각 장인',        'hidden',    '히든',      '한 번의 기록이 정확히 1시간',                            'hour_exact',     1,       'flag',  91),
  ('three_minutes', '작심삼분',         'hidden',    '히든',      '1분 이상 3분 미만으로 끝난 기록 10번',                    'short_count',    10,      'count', 92),
  ('christmas',     '메리 스터디마스',  'hidden',    '히든',      '12월 25일에 3시간 이상 공부',                            'xmas',           1,       'flag',  93),
  ('new_year',      '새해 첫 공부',     'hidden',    '히든',      '1월 1일 0시대에 공부 중',                                'newyear',        1,       'flag',  94),
  ('bug_hunter',    '오류를 찾는 자',   'hidden',    '히든',      '오류 신고 문의에 관리자가 답변함',                        'bug_finder',     1,       'flag',  95),
  ('top_kor', '장원 급제', 'hidden', '히든', '국어 주간 전교 1위 (그 주 국어 3시간 이상, 국어 기록 있는 학생 3명 이상)', 'wtop_kor', 1, 'flag', 96),
  ('top_eng', 'No.1', 'hidden', '히든', '영어 주간 전교 1위 (그 주 영어 3시간 이상, 영어 기록 있는 학생 3명 이상)', 'wtop_eng', 1, 'flag', 97),
  ('top_math', '최댓값', 'hidden', '히든', '수학 주간 전교 1위 (그 주 수학 3시간 이상, 수학 기록 있는 학생 3명 이상)', 'wtop_math', 1, 'flag', 98),
  ('top_soc', '지지율 1위', 'hidden', '히든', '사회 주간 전교 1위 (그 주 사회 3시간 이상, 사회 기록 있는 학생 3명 이상)', 'wtop_soc', 1, 'flag', 99),
  ('top_sci', '1번 원소', 'hidden', '히든', '과학 주간 전교 1위 (그 주 과학 3시간 이상, 과학 기록 있는 학생 3명 이상)', 'wtop_sci', 1, 'flag', 100),
  ('top_his', '태조', 'hidden', '히든', '역사 주간 전교 1위 (그 주 역사 3시간 이상, 역사 기록 있는 학생 3명 이상)', 'wtop_his', 1, 'flag', 101)
on conflict (code) do update set
  name = excluded.name, grade = excluded.grade, category = excluded.category, description = excluded.description,
  metric = excluded.metric, goal = excluded.goal, unit = excluded.unit, sort = excluded.sort
where not title_defs.edited;

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
      where u.user_id = uid and not u.seen and not u.revoked
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
    left join user_titles u on u.code = t.code and u.user_id = uid and not u.revoked
    where t.active
    order by t.sort;
end $$;

-- 대표 칭호 달기 (null이면 떼기). 얻은 칭호만
create or replace function set_title(p_code text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if p_code is not null and not exists (select 1 from user_titles where user_id = auth.uid() and code = p_code and not revoked) then
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
