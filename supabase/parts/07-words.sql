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
