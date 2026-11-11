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
