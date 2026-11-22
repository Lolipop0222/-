-- ┌──────────────────────────────────────────────────────────────────────
-- │ 08-levels.sql — 레벨(1~99)·닉네임 테두리
-- │ 실행 순서: supabase/parts의 번호 순. 이 파일 앞에 필요한 것: 01, 06 (sessions.lecture·과목 이름 '역사', level_subject_cap())
-- │ 여러 번 실행해도 안전하다(idempotent). 바뀐 파일만 SQL Editor에 붙여넣고 Run.
-- │ 고치면 `npm run schema`로 supabase/schema.sql(전체본)을 다시 만든다.
-- └──────────────────────────────────────────────────────────────────────

-- 레벨 (2026-11-09)
--   경험치 = 과목별 공부 시간의 합. 단, 과목마다 만렙에 필요한 시간까지만 센다:
--     국어·영어·수학 각 500시간, 사회·과학(탐구) 각 300시간, 역사 150시간 → 합계 2,250시간 = 만렙(99)
--   공부 시간은 순위와 같은 기준: 끝난 기록, 기타·인강 제외, 한 기록 1초~4시간.
--   레벨 = 1 + floor(98 × √(경험치 / 2,250시간)) — 처음엔 빨리 오르고 갈수록 느려진다 (레벨 2는 약 14분, 10은 약 19시간).
--   앱(lib/levels.ts)도 같은 식으로 계산한다. 바꾸면 둘 다 고친다.
-- 보상 (사용자가 정한 표, 2026-11-11 · 캐릭터는 2026-11-12에 뺌): 20·50·90 칭호 · 30 프로필 사진 · 60 테마 · 80 닉네임 테두리
--   (칭호·프로필 사진·테마는 아직 준비 중)
-- 닉네임 테두리 (디스코드 이름표 같은 것): 80레벨에 10종이 한꺼번에 열린다. name_frame_min_level()과 lib/levels.ts의 NAME_FRAMES를 같게.
-- 과목 테두리·한정 프로필(과목 레벨 보상)은 아래 '과목 보상' — name_frame_allowed(), profiles_avatar_reward_guard().

-- ───────────────────────── 닉네임 테두리 열 ─────────────────────────
alter table profiles add column if not exists name_frame text;
alter table profiles drop constraint if exists profiles_name_frame_check;
alter table profiles add constraint profiles_name_frame_check check (name_frame is null or name_frame ~ '^[a-z0-9-]{1,32}$');
-- 직접 수정 권한은 06의 열 권한(nickname·grade·class_no·avatar·track)에 없으므로 set_name_frame()으로만 바뀐다.

-- ───────────────────────── 캐릭터 (2026-11-11에 넣었다가 2026-11-12 사용자 요청으로 뺌) ─────────────────────────
-- 이 조각을 그 사이에 실행했다면 남은 것을 지운다 (처음 실행이면 아무 일도 안 함)
drop function if exists set_character(text);
drop function if exists character_allowed(int, text);
alter table profiles drop constraint if exists profiles_character_check;
alter table profiles drop column if exists character_skin;

-- ───────────────────────── 계산 ─────────────────────────

-- 과목별 만렙 시간 level_subject_cap()은 06-subjects.sql에 있다 (과목 레벨 칭호도 쓰므로, 2026-11-22 옮김)

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

-- ───────────────────────── 과목 보상 (2026-11-22) ─────────────────────────
-- 과목 레벨로 열리는 보상. 앱 lib/subjectRewards.ts와 숫자를 같게:
--   과목 닉네임 테두리 '<과목>-<1|2|3>' = 과목 레벨 20·60·80, 한정 프로필 avatar 'lim:<과목>-<1|2|3>' = 과목 레벨 30·50·80
--   (과목 칭호는 04, 과목 테마(90)는 기기 저장이라 앱에서만). 관리자는 모두 쓸 수 있다(미리 보기).
create or replace function subject_of_key(p_key text) returns text
language sql immutable set search_path = public as $$
  select case p_key when 'kor' then '국어' when 'eng' then '영어' when 'math' then '수학'
                    when 'soc' then '사회' when 'sci' then '과학' when 'his' then '역사' end
$$;

-- 한 학생의 과목 레벨 (내부용). 06의 subject_level()·순위와 같은 기준
create or replace function subject_level_of(p_user uuid, p_subject text) returns int
language sql stable security definer set search_path = public as $$
  select subject_level((select sum(s.duration) from sessions s
                        where s.user_id = p_user and s.subject = p_subject and not s.lecture and s.duration between 1 and 14400), p_subject)
$$;

-- 이 학생이 이 테두리를 쓸 수 있나 (p_level = 그 학생의 전체 레벨). 없는 테두리면 false
create or replace function name_frame_allowed(p_user uuid, p_code text, p_level int) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_known boolean := name_frame_min_level(p_code) is not null or coalesce(p_code ~ '^(kor|eng|math|soc|sci|his)-[123]$', false);
begin
  if p_code is null then
    return true;
  end if;
  if not v_known then
    return false;
  end if;
  if exists (select 1 from admins where user_id = p_user) then
    return true;
  end if;
  if name_frame_min_level(p_code) is not null then
    return p_level >= name_frame_min_level(p_code);
  end if;
  return subject_level_of(p_user, subject_of_key(split_part(p_code, '-', 1)))
         >= (array[20, 60, 80])[split_part(p_code, '-', 2)::int];
end;
$$;

-- 한정 프로필(avatar 'lim:…')을 고를 때 과목 레벨 확인. 04의 profiles_avatar_guard와 별도 트리거
create or replace function profiles_avatar_reward_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.avatar is distinct from old.avatar and new.avatar like 'lim:%' then
    if new.avatar !~ '^lim:(kor|eng|math|soc|sci|his)-[123]$' then
      raise exception '없는 프로필 그림이에요' using errcode = '22023';
    end if;
    if not exists (select 1 from admins where user_id = new.id)
       and subject_level_of(new.id, subject_of_key(split_part(substr(new.avatar, 5), '-', 1)))
           < (array[30, 50, 80])[split_part(new.avatar, '-', 2)::int] then
      raise exception '아직 열리지 않은 프로필 그림이에요' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_avatar_reward_guard on profiles;
create trigger profiles_avatar_reward_guard before update of avatar on profiles for each row execute function profiles_avatar_reward_guard();

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

-- 내 레벨: {level, xp, max_xp, frame, subjects: [{subject, sec, cap}]} (sec는 만렙 시간까지만 센 값이 아니라 실제 시간)
create or replace function my_level()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_xp bigint;
  v_subjects jsonb;
  v_frame text;
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
  select name_frame into v_frame from profiles where id = v_uid;
  -- 레벨이 내려가서(기록 삭제 등) 못 쓰게 된 테두리는 보여 주지 않는다
  if not name_frame_allowed(v_uid, v_frame, level_from_xp(v_xp)) then
    v_frame := null;
  end if;
  return jsonb_build_object('level', level_from_xp(v_xp), 'xp', v_xp, 'max_xp', level_max_xp(), 'frame', v_frame, 'subjects', v_subjects);
end;
$$;

-- 닉네임 테두리 달기(null이면 떼기). 그 레벨이 안 되면 'locked', 없는 테두리면 'invalid'
create or replace function set_name_frame(p_code text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_level int;
begin
  if v_uid is null or not exists (select 1 from profiles where id = v_uid) then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if p_code is not null then
    if name_frame_min_level(p_code) is null and p_code !~ '^(kor|eng|math|soc|sci|his)-[123]$' then
      return 'invalid';
    end if;
    select level_from_xp(xp) into v_level from level_xp_of(array[v_uid]);
    if not name_frame_allowed(v_uid, p_code, v_level) then
      return 'locked';
    end if;
  end if;
  update profiles set name_frame = p_code where id = v_uid;
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
           case when name_frame_allowed(ps.id, ps.name_frame, lv.level) then ps.name_frame end
    from ps join lv on lv.user_id = ps.id;
end;
$$;

revoke execute on function level_max_xp() from public, anon;
revoke execute on function level_from_xp(bigint) from public, anon;
revoke execute on function name_frame_min_level(text) from public, anon;
revoke execute on function subject_of_key(text) from public, anon;
revoke execute on function subject_level_of(uuid, text) from public, anon, authenticated;
revoke execute on function name_frame_allowed(uuid, text, int) from public, anon, authenticated;
revoke execute on function profiles_avatar_reward_guard() from public, anon, authenticated;
revoke execute on function level_xp_of(uuid[]) from public, anon, authenticated;
revoke execute on function my_level() from public, anon;
revoke execute on function set_name_frame(text) from public, anon;
revoke execute on function player_cards(text[]) from public, anon;
grant execute on function level_max_xp() to authenticated;
grant execute on function level_from_xp(bigint) to authenticated;
grant execute on function name_frame_min_level(text) to authenticated;
grant execute on function subject_of_key(text) to authenticated;
grant execute on function my_level() to authenticated;
grant execute on function set_name_frame(text) to authenticated;
grant execute on function player_cards(text[]) to authenticated;
