-- ┌──────────────────────────────────────────────────────────────────────
-- │ 10-admin-students.sql — 관리자 학생 관리: 가입한 학생 목록·학생별 공부 기록·프로필 고치기·기록 지우기
-- │ 실행 순서: supabase/parts의 번호 순. 이 파일 앞에 필요한 것: 02 (is_admin), 04 (칭호), 06 (track·lecture·detail),
-- │           06 (sessions.manual — 직접 입력 표시), 07 (word_progress), 08 (level_xp_of·level_from_xp·name_frame)
-- │ 여러 번 실행해도 안전하다(idempotent). 바뀐 파일만 SQL Editor에 붙여넣고 Run.
-- │ 고치면 `npm run schema`로 supabase/schema.sql(전체본)을 다시 만든다.
-- └──────────────────────────────────────────────────────────────────────

-- 학생 관리 (2026-11-22, 사용자 요청: "관리자가 가입한 학생들의 목록을 확인하고 관리하며 공부시간이나 그런 것들도 전부 체크")
--   모든 함수는 관리자가 아니면 거절한다(42501). 이메일·비밀번호(해시)는 돌려주지 않는다.
--   공부 시간은 순위와 같은 기준: 기타·인강 제외, 한 기록 1초~4시간, 기록은 시작한 날(한국 시간).

-- 반은 1~12반 (2026-11-22, 사용자: "반 설정할 때 12반까지만"). 01의 표 정의(새 DB)도 1~12.
-- 예전 DB는 1~20 제약이라 바꾼다. 이미 13반 이상인 학생이 있으면 그 학생 프로필 저장이 막히지 않게 바꾸지 않고 알린다
-- (관리자 → 학생 관리에서 반을 고친 뒤 이 파일을 다시 실행하면 바뀐다).
do $$
begin
  if exists (select 1 from profiles where class_no > 12) then
    raise notice '13반 이상인 학생이 있어 반 제약(1~12)을 아직 바꾸지 않았어요';
  else
    alter table profiles drop constraint if exists profiles_class_no_check;
    alter table profiles add constraint profiles_class_no_check check (class_no between 1 and 12);
  end if;
end $$;

-- 가입한 학생 전체 (프로필이 있는 계정). 정렬·검색은 앱이 한다
create or replace function admin_list_students()
returns table (nickname text, grade int, class_no int, track text, avatar text,
               title_code text, title_name text, title_grade text, name_frame text,
               created_at timestamptz, is_admin boolean, level int,
               total_sec bigint, week_sec bigint, today_sec bigint, last_at timestamptz, studying boolean,
               words_learned bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_week timestamptz := kst_week_start();
  v_day timestamptz := kst_day_start();
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있어요' using errcode = '42501';
  end if;
  return query
    with c as (
      select s.user_id,
             sum(s.duration) filter (where s.subject <> '기타' and not s.lecture and s.duration between 1 and 14400) as total,
             sum(s.duration) filter (where s.subject <> '기타' and not s.lecture and s.duration between 1 and 14400 and s.started_at >= v_week) as week,
             sum(s.duration) filter (where s.subject <> '기타' and not s.lecture and s.duration between 1 and 14400 and s.started_at >= v_day) as today,
             max(s.started_at) as last_at,
             bool_or(s.ended_at is null and s.started_at > now() - interval '4 hours' and s.subject <> '기타' and not s.lecture) as live
      from sessions s
      group by s.user_id
    ),
    lv as (
      select x.user_id, level_from_xp(x.xp) as level from level_xp_of(array(select id from profiles)) x
    ),
    w as (
      select wp.user_id, count(*) filter (where wp.box = 6) as learned from word_progress wp group by wp.user_id
    )
    select p.nickname, p.grade, p.class_no, p.track, p.avatar,
           p.title_code, td.name, td.grade, p.name_frame,
           p.created_at, exists (select 1 from admins a where a.user_id = p.id), coalesce(lv.level, 1),
           coalesce(c.total, 0)::bigint, coalesce(c.week, 0)::bigint, coalesce(c.today, 0)::bigint, c.last_at, coalesce(c.live, false),
           coalesce(w.learned, 0)::bigint
    from profiles p
    left join c on c.user_id = p.id
    left join lv on lv.user_id = p.id
    left join w on w.user_id = p.id
    left join title_defs td on td.code = p.title_code
    order by p.grade, p.class_no, p.nickname;
end $$;
revoke execute on function admin_list_students() from public, anon;
grant execute on function admin_list_students() to authenticated;

-- 한 학생 자세히 (jsonb). 없는 닉네임이면 null
--   profile · level/xp · subjects(과목별 전체·이번 주 시간과 과목 레벨) · 기타·인강 합계 · 지금 공부 중인 기록 ·
--   칭호 · 스터디그룹 · 워마 진도 · 플래너·디데이·문의 개수 · 복구 코드가 있는지
create or replace function admin_student_detail(p_nickname text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid;
  v_week timestamptz := kst_week_start();
  v_out jsonb;
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있어요' using errcode = '42501';
  end if;
  select id into v_uid from profiles where nickname = p_nickname;
  if v_uid is null then
    return null;
  end if;
  select jsonb_build_object(
    'profile', (select jsonb_build_object(
        'nickname', p.nickname, 'grade', p.grade, 'class_no', p.class_no, 'track', p.track, 'avatar', p.avatar,
        'title_code', p.title_code, 'title_name', td.name, 'title_grade', td.grade, 'name_frame', p.name_frame,
        'created_at', p.created_at, 'is_admin', exists (select 1 from admins a where a.user_id = p.id))
      from profiles p left join title_defs td on td.code = p.title_code where p.id = v_uid),
    'xp', (select xp from level_xp_of(array[v_uid])),
    'level', (select level_from_xp(xp) from level_xp_of(array[v_uid])),
    'subjects', (select coalesce(jsonb_agg(jsonb_build_object('subject', t.subj, 'sec', coalesce(x.sec, 0), 'week_sec', coalesce(x.week, 0),
                                                              'level', subject_level(coalesce(x.sec, 0), t.subj)) order by t.ord), '[]'::jsonb)
                 from unnest(array['국어', '영어', '수학', '사회', '과학', '역사']) with ordinality as t(subj, ord)
                 left join lateral (
                   select sum(s.duration)::bigint as sec, (sum(s.duration) filter (where s.started_at >= v_week))::bigint as week
                   from sessions s
                   where s.user_id = v_uid and s.subject = t.subj and not s.lecture and s.duration between 1 and 14400
                 ) x on true),
    'etc_sec', (select coalesce(sum(s.duration), 0)::bigint from sessions s where s.user_id = v_uid and s.subject = '기타' and s.duration between 1 and 14400),
    'lecture_sec', (select coalesce(sum(s.duration), 0)::bigint from sessions s
                    where s.user_id = v_uid and s.subject <> '기타' and s.lecture and s.duration between 1 and 14400),
    'manual_sec', (select coalesce(sum(s.duration), 0)::bigint from sessions s
                   where s.user_id = v_uid and s.manual and s.subject <> '기타' and not s.lecture and s.duration between 1 and 14400),
    'session_count', (select count(*) from sessions s where s.user_id = v_uid),
    'first_at', (select min(s.started_at) from sessions s where s.user_id = v_uid),
    'last_at', (select max(s.started_at) from sessions s where s.user_id = v_uid),
    'live', (select jsonb_build_object('id', s.id, 'subject', s.subject, 'detail', s.detail, 'lecture', s.lecture, 'started_at', s.started_at)
             from sessions s where s.user_id = v_uid and s.ended_at is null and s.started_at > now() - interval '4 hours'
             order by s.started_at desc limit 1),
    'titles', (select coalesce(jsonb_agg(jsonb_build_object('code', u.code, 'name', td.name, 'grade', td.grade, 'earned_at', u.earned_at, 'revoked', u.revoked)
                                         order by u.revoked, u.earned_at desc), '[]'::jsonb)
               from user_titles u join title_defs td on td.code = u.code where u.user_id = v_uid),
    'groups', (select coalesce(jsonb_agg(jsonb_build_object('name', g.name, 'owner', g.owner_id = v_uid,
                                                            'members', (select count(*) from group_members m2 where m2.group_id = g.id)) order by g.name), '[]'::jsonb)
               from group_members m join study_groups g on g.id = m.group_id where m.user_id = v_uid),
    'words', (select jsonb_build_object('learned', count(*) filter (where wp.box = 6), 'learning', count(*) filter (where wp.box < 6),
                                        'due', count(*) filter (where wp.box < 6 and wp.due <= (now() at time zone 'Asia/Seoul')::date),
                                        'last_at', max(wp.last_at))
              from word_progress wp where wp.user_id = v_uid),
    'quizzes', (select count(*) from word_quiz_best q where q.user_id = v_uid),
    'tasks_total', (select count(*) from tasks k where k.user_id = v_uid and not k.skipped),
    'tasks_done', (select count(*) from tasks k where k.user_id = v_uid and k.done and not k.skipped),
    'routines', (select count(*) from routines r where r.user_id = v_uid and r.active),
    'ddays', (select count(*) from ddays d where d.user_id = v_uid),
    'inquiries', (select count(*) from inquiries i where i.user_id = v_uid),
    'has_recovery_code', exists (select 1 from recovery_codes rc where rc.user_id = v_uid)
  ) into v_out;
  return v_out;
end $$;
revoke execute on function admin_student_detail(text) from public, anon;
grant execute on function admin_student_detail(text) to authenticated;

-- 한 학생의 공부 기록 (p_since 이후 시작한 것, 오래된 순, 최대 5000개) — 앱이 통계 그래프(lib/stats.ts)를 그대로 그린다
-- manual = 직접 입력한 기록 (06의 열). 돌려주는 열이 바뀌어서(manual 추가) 지우고 다시 만든다
drop function if exists admin_student_sessions(text, timestamptz);
create function admin_student_sessions(p_nickname text, p_since timestamptz)
returns table (id uuid, subject text, started_at timestamptz, ended_at timestamptz, away_count int, duration int,
               task_id uuid, label text, detail text, lecture boolean, manual boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid;
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있어요' using errcode = '42501';
  end if;
  select p.id into v_uid from profiles p where p.nickname = p_nickname;
  return query
    select s.id, s.subject, s.started_at, s.ended_at, s.away_count, s.duration::int, s.task_id, s.label, s.detail, s.lecture, s.manual
    from sessions s
    where s.user_id = v_uid and s.started_at >= coalesce(p_since, '-infinity'::timestamptz)
    order by s.started_at
    limit 5000;
end $$;
revoke execute on function admin_student_sessions(text, timestamptz) from public, anon;
grant execute on function admin_student_sessions(text, timestamptz) to authenticated;

-- 학생 프로필 고치기 (부적절한 닉네임, 학년·반·계열이 틀렸을 때).
-- 돌려주는 값: 'ok' | 'not_found' | 'taken'(그 닉네임을 다른 학생이 씀) | 'invalid'(닉네임 2~12자, 학년 1~3, 반 1~12, 계열 문과/이과/null)
create or replace function admin_update_student(p_nickname text, p_new_nickname text, p_grade int, p_class_no int, p_track text)
returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid;
  v_new text := trim(p_new_nickname);
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있어요' using errcode = '42501';
  end if;
  select id into v_uid from profiles where nickname = p_nickname;
  if v_uid is null then
    return 'not_found';
  end if;
  if v_new is null or char_length(v_new) not between 2 and 12 or p_grade not between 1 and 3 or p_class_no not between 1 and 12
     or (p_track is not null and p_track not in ('문과', '이과')) then
    return 'invalid';
  end if;
  if exists (select 1 from profiles where nickname = v_new and id <> v_uid) then
    return 'taken';
  end if;
  update profiles set nickname = v_new, grade = p_grade, class_no = p_class_no, track = p_track where id = v_uid;
  return 'ok';
end $$;
revoke execute on function admin_update_student(text, text, int, int, text) from public, anon;
grant execute on function admin_update_student(text, text, int, int, text) to authenticated;

-- 공부 기록 하나 지우기 (켜 두고 잊은 기록·부정 기록 등). 이미 받은 칭호는 그대로 남는다. 지웠으면 true
create or replace function admin_delete_session(p_id uuid)
returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있어요' using errcode = '42501';
  end if;
  delete from sessions where id = p_id;
  return found;
end $$;
revoke execute on function admin_delete_session(uuid) from public, anon;
grant execute on function admin_delete_session(uuid) to authenticated;
