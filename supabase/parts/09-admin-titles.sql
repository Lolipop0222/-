-- ┌──────────────────────────────────────────────────────────────────────
-- │ 09-admin-titles.sql — 관리자가 앱 안에서 칭호를 고치고·만들고·학생에게 주고·회수하기
-- │ 실행 순서: supabase/parts의 번호 순. 이 파일 앞에 필요한 것: 02 (is_admin), 04 (title_defs·user_titles의 custom·edited·revoked 열)
-- │ 여러 번 실행해도 안전하다(idempotent). 바뀐 파일만 SQL Editor에 붙여넣고 Run.
-- │ 고치면 `npm run schema`로 supabase/schema.sql(전체본)을 다시 만든다.
-- └──────────────────────────────────────────────────────────────────────

-- 칭호 관리 (2026-11-21, 사용자 요청: "칭호를 자유롭게 수정·추가하고 원하는 계정에 주고 싶어, 앱 안에서 간편하게")
--   조건(metric)은 title_stats()가 계산하는 값 중 하나이거나 'manual'(자동으로는 안 생기고 관리자가 줄 때만 생김).
--   관리자가 고친 칭호는 edited = true → 04를 다시 실행해도 기본 목록으로 덮어쓰지 않는다.
--   새로 만든 칭호는 custom = true, 코드는 'c_' + 무작위 10자. 기본 칭호는 지울 수 없고 숨기기(active = false)만 된다.
--   회수 = user_titles.revoked = true (줄을 남겨 두어 자동 판정이 다시 주지 않음). 다시 주면 false + 알림(seen = false).
--   모든 함수는 관리자가 아니면 거절한다.

-- 조건으로 고를 수 있는 값 (06-subjects.sql의 title_stats()가 돌려주는 이름 + manual). lv_* = 과목 레벨(1~99) 앱의 lib/adminTitles.ts와 같게
create or replace function title_metric_unit(p_metric text) returns text
language sql immutable set search_path = public as $$
  select case
    when p_metric in ('total_sec', 'max_day_sec', 'sub_kor', 'sub_eng', 'sub_math', 'sub_sci', 'sub_soc', 'sub_his') then 'hour'
    when p_metric in ('max_streak', 'yaja_days') then 'day'
    when p_metric in ('lv_kor', 'lv_eng', 'lv_math', 'lv_soc', 'lv_sci', 'lv_his') then 'level'
    when p_metric in ('tasks_done', 'short_count') then 'count'
    when p_metric in ('manual', 'first_record', 'focus_2h', 'allround', 'week_class_top', 'week_grade_top', 'week_school_top',
                      'reset_hunter', 'hour_exact', 'xmas', 'newyear', 'bug_finder',
                      'wtop_kor', 'wtop_eng', 'wtop_math', 'wtop_soc', 'wtop_sci', 'wtop_his') then 'flag'
  end
$$;
revoke execute on function title_metric_unit(text) from public, anon;
grant execute on function title_metric_unit(text) to authenticated;

-- 칭호 전체 (숨긴 것 포함) + 가진 학생 수
create or replace function admin_list_titles()
returns table (code text, name text, grade text, category text, description text, metric text, goal numeric, unit text,
               sort int, active boolean, custom boolean, edited boolean, holders bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있어요' using errcode = '42501';
  end if;
  return query
    select t.code, t.name, t.grade, t.category, t.description, t.metric, t.goal, t.unit, t.sort, t.active, t.custom, t.edited,
           (select count(*) from user_titles u where u.code = t.code and not u.revoked)
    from title_defs t
    order by t.sort, t.code;
end $$;
revoke execute on function admin_list_titles() from public, anon;
grant execute on function admin_list_titles() to authenticated;

-- 칭호 저장. p_code가 null이면 새로 만든다. 고친(만든) 칭호의 코드를 돌려준다.
-- p_goal은 단위 그대로(시간 단위면 초가 아니라 '시간'으로 받는다 → 여기서 초로 바꿈)
create or replace function admin_save_title(
  p_code text, p_name text, p_grade text, p_category text, p_description text,
  p_metric text, p_goal numeric, p_active boolean
) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_unit text := title_metric_unit(p_metric);
  v_goal numeric;
  v_code text := p_code;
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있어요' using errcode = '42501';
  end if;
  p_name := btrim(coalesce(p_name, ''));
  p_category := btrim(coalesce(p_category, ''));
  p_description := btrim(coalesce(p_description, ''));
  if char_length(p_name) not between 1 and 20 then
    raise exception '칭호 이름은 1~20자로 써 주세요' using errcode = '22023';
  end if;
  if char_length(p_category) not between 1 and 12 then
    raise exception '분류는 1~12자로 써 주세요' using errcode = '22023';
  end if;
  if char_length(p_description) not between 1 and 100 then
    raise exception '설명은 1~100자로 써 주세요' using errcode = '22023';
  end if;
  if p_grade not in ('common', 'rare', 'superrare', 'epic', 'mythic', 'legendary', 'hidden') then
    raise exception '등급이 올바르지 않아요' using errcode = '22023';
  end if;
  if v_unit is null then
    raise exception '조건이 올바르지 않아요' using errcode = '22023';
  end if;
  if v_unit = 'flag' then
    v_goal := 1;
  elsif p_goal is null or p_goal <= 0 or p_goal > 100000 or (v_unit = 'level' and p_goal > 99) then
    raise exception '목표 값을 1 이상으로 써 주세요' using errcode = '22023';
  else
    v_goal := case when v_unit = 'hour' then round(p_goal * 3600) else round(p_goal) end;
  end if;

  if v_code is null then
    v_code := 'c_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
    insert into title_defs (code, name, grade, category, description, metric, goal, unit, sort, active, custom, edited)
    values (v_code, p_name, p_grade, p_category, p_description, p_metric, v_goal, v_unit,
            coalesce((select max(sort) from title_defs), 0) + 1, coalesce(p_active, true), true, true);
  else
    update title_defs set name = p_name, grade = p_grade, category = p_category, description = p_description,
           metric = p_metric, goal = v_goal, unit = v_unit, active = coalesce(p_active, active), edited = true
    where title_defs.code = v_code;
    if not found then
      raise exception '없는 칭호예요' using errcode = '22023';
    end if;
  end if;
  return v_code;
end $$;
revoke execute on function admin_save_title(text, text, text, text, text, text, numeric, boolean) from public, anon;
grant execute on function admin_save_title(text, text, text, text, text, text, numeric, boolean) to authenticated;

-- 관리자가 만든 칭호 지우기 (기본 칭호는 못 지움 → 숨기기로). 그 칭호를 단 학생은 대표 칭호가 비게 된다(외래 키 on delete set null)
create or replace function admin_delete_title(p_code text) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있어요' using errcode = '42501';
  end if;
  if not exists (select 1 from title_defs where code = p_code and custom) then
    raise exception '기본 칭호는 지울 수 없어요. 숨기기를 써 주세요' using errcode = '22023';
  end if;
  delete from title_defs where code = p_code;
  return true;
end $$;
revoke execute on function admin_delete_title(text) from public, anon;
grant execute on function admin_delete_title(text) to authenticated;

-- 닉네임으로 칭호 주기. 'ok' | 'no_user' | 'no_title' | 'already'. 받은 학생은 다음에 앱을 열 때 알림을 받는다
create or replace function admin_grant_title(p_nickname text, p_code text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid;
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있어요' using errcode = '42501';
  end if;
  select id into v_uid from profiles where nickname = btrim(p_nickname);
  if v_uid is null then
    return 'no_user';
  end if;
  if not exists (select 1 from title_defs where code = p_code) then
    return 'no_title';
  end if;
  if exists (select 1 from user_titles where user_id = v_uid and code = p_code and not revoked) then
    return 'already';
  end if;
  insert into user_titles (user_id, code, earned_at, seen, revoked) values (v_uid, p_code, now(), false, false)
  on conflict (user_id, code) do update set revoked = false, seen = false, earned_at = now();
  return 'ok';
end $$;
revoke execute on function admin_grant_title(text, text) from public, anon;
grant execute on function admin_grant_title(text, text) to authenticated;

-- 닉네임에게서 칭호 회수. 'ok' | 'no_user' | 'not_owned'. 대표 칭호로 달고 있었으면 뗀다
create or replace function admin_revoke_title(p_nickname text, p_code text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid;
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있어요' using errcode = '42501';
  end if;
  select id into v_uid from profiles where nickname = btrim(p_nickname);
  if v_uid is null then
    return 'no_user';
  end if;
  update user_titles set revoked = true where user_id = v_uid and code = p_code and not revoked;
  if not found then
    return 'not_owned';
  end if;
  update profiles set title_code = null where id = v_uid and title_code = p_code;
  return 'ok';
end $$;
revoke execute on function admin_revoke_title(text, text) from public, anon;
grant execute on function admin_revoke_title(text, text) to authenticated;

-- 칭호를 가진 학생 (최근 받은 순, 300명까지)
create or replace function admin_title_holders(p_code text)
returns table (nickname text, grade int, class_no int, earned_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있어요' using errcode = '42501';
  end if;
  return query
    select p.nickname, p.grade::int, p.class_no::int, u.earned_at
    from user_titles u join profiles p on p.id = u.user_id
    where u.code = p_code and not u.revoked
    order by u.earned_at desc
    limit 300;
end $$;
revoke execute on function admin_title_holders(text) from public, anon;
grant execute on function admin_title_holders(text) to authenticated;

-- 닉네임 찾기 (칭호 줄 때 자동 완성용, 20명까지)
create or replace function admin_find_users(p_query text)
returns table (nickname text, grade int, class_no int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있어요' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_query, ''))) = 0 then
    return;
  end if;
  return query
    select p.nickname, p.grade::int, p.class_no::int from profiles p
    where p.nickname ilike '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    order by (p.nickname ilike replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%') desc, p.nickname
    limit 20;
end $$;
revoke execute on function admin_find_users(text) from public, anon;
grant execute on function admin_find_users(text) to authenticated;
