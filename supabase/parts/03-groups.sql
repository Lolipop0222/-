-- ┌──────────────────────────────────────────────────────────────────────
-- │ 03-groups.sql — 스터디그룹
-- │ 실행 순서: supabase/parts의 번호 순. 이 파일 앞에 필요한 것: 01, 02
-- │ 여러 번 실행해도 안전하다(idempotent). 바뀐 파일만 SQL Editor에 붙여넣고 Run.
-- │ 고치면 `npm run schema`로 supabase/schema.sql(전체본)을 다시 만든다.
-- └──────────────────────────────────────────────────────────────────────

-- ═════════════════════════ 스터디그룹 ═════════════════════════
-- 친구끼리 6자리 초대코드로 모여 이번 주 공부 시간을 겨룬다.
-- 테이블은 앱이 직접 못 읽는다(RLS 정책 없음 + 권한 없음). 모든 일은 아래 함수로만 한다 — 그룹원이 아니면 아무것도 볼 수 없다.
-- 제한: 한 사람이 들어가는 그룹 5개, 내가 만든 그룹 3개, 그룹 인원 30명, 코드 15분에 10번 틀리면 잠김.
create table if not exists study_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 2 and 20),
  invite_code text not null unique check (invite_code ~ '^[A-Z2-9]{6}$'),
  owner_id    uuid references profiles (id) on delete set null,  -- 방장이 계정을 지우면 아래 트리거가 다음 사람에게 넘긴다
  created_at  timestamptz not null default now()
);

create table if not exists group_members (
  group_id  uuid not null references study_groups (id) on delete cascade,
  user_id   uuid not null references profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on group_members (user_id);

alter table study_groups enable row level security;
alter table group_members enable row level security;
revoke all on study_groups from anon, authenticated;
revoke all on group_members from anon, authenticated;

-- 누가 나가거나(계정 삭제 포함) 내보내지면: 방장이 없어졌으면 가장 먼저 들어온 사람이 방장, 아무도 없으면 그룹 삭제
create or replace function group_member_left() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  next_owner uuid;
begin
  if not exists (select 1 from study_groups where id = old.group_id) then
    return old;  -- 그룹째 지워지는 중
  end if;
  select user_id into next_owner from group_members where group_id = old.group_id order by joined_at, user_id limit 1;
  if next_owner is null then
    delete from study_groups where id = old.group_id;
  else
    update study_groups set owner_id = next_owner
    where id = old.group_id and (owner_id is null or owner_id = old.user_id);
  end if;
  return old;
end $$;
drop trigger if exists group_member_left on group_members;
create trigger group_member_left after delete on group_members for each row execute function group_member_left();

-- 겹치지 않는 6자리 코드 (헷갈리는 0·O·1·I 뺀 32글자, 약 10억 가지)
create or replace function new_group_code() returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea;
  code text;
begin
  loop
    bytes := extensions.gen_random_bytes(6);
    code := '';
    for i in 0..5 loop
      code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from study_groups where invite_code = code);
  end loop;
  return code;
end $$;

create or replace function require_group_member(p_group uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from group_members where group_id = p_group and user_id = auth.uid()) then
    raise exception '이 그룹의 멤버가 아니에요';
  end if;
end $$;

create or replace function require_group_owner(p_group uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from study_groups where id = p_group and owner_id = auth.uid()) then
    raise exception '방장만 할 수 있어요';
  end if;
end $$;

-- 내 그룹 목록
create or replace function my_groups()
returns table (id uuid, name text, invite_code text, member_count bigint, is_owner boolean, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.invite_code,
         (select count(*) from group_members x where x.group_id = g.id),
         g.owner_id = auth.uid(), m.joined_at
  from group_members m join study_groups g on g.id = m.group_id
  where m.user_id = auth.uid()
  order by m.joined_at
$$;

-- 그룹 만들기 → 새 그룹 id
create or replace function create_group(p_name text) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  gid uuid;
begin
  if not exists (select 1 from profiles where id = auth.uid()) then
    raise exception '프로필이 없습니다';
  end if;
  if (select count(*) from study_groups where owner_id = auth.uid()) >= 3 then
    raise exception '그룹은 3개까지 만들 수 있어요';
  end if;
  if (select count(*) from group_members where user_id = auth.uid()) >= 5 then
    raise exception '그룹은 5개까지 들어갈 수 있어요';
  end if;
  insert into study_groups (name, invite_code, owner_id) values (trim(p_name), new_group_code(), auth.uid()) returning id into gid;
  insert into group_members (group_id, user_id) values (gid, auth.uid());
  return gid;
end $$;

-- 코드로 들어가기 → 그룹 id. 코드가 틀리면 null (틀린 횟수를 남기려고 오류를 던지지 않는다)
create or replace function join_group(p_code text) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  gid uuid;
begin
  if not exists (select 1 from profiles where id = auth.uid()) then
    raise exception '프로필이 없습니다';
  end if;
  delete from security_attempts where at < now() - interval '1 day';
  if (select count(*) from security_attempts where kind = 'group' and subject = auth.uid()::text and at > now() - interval '15 minutes') >= 10 then
    raise exception '코드를 여러 번 틀렸어요. 15분 뒤에 다시 해 주세요';
  end if;
  select id into gid from study_groups where invite_code = code;
  if gid is null then
    insert into security_attempts (kind, subject) values ('group', auth.uid()::text);
    return null;
  end if;
  if exists (select 1 from group_members where group_id = gid and user_id = auth.uid()) then
    return gid;  -- 이미 들어가 있음
  end if;
  if (select count(*) from group_members where user_id = auth.uid()) >= 5 then
    raise exception '그룹은 5개까지 들어갈 수 있어요';
  end if;
  if (select count(*) from group_members where group_id = gid) >= 30 then
    raise exception '이 그룹은 꽉 찼어요 (30명)';
  end if;
  insert into group_members (group_id, user_id) values (gid, auth.uid());
  return gid;
end $$;

create or replace function leave_group(p_group uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  delete from group_members where group_id = p_group and user_id = auth.uid();
end $$;

create or replace function rename_group(p_group uuid, p_name text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  perform require_group_owner(p_group);
  update study_groups set name = trim(p_name) where id = p_group;
end $$;

-- 코드가 밖으로 퍼졌을 때 새 코드로 (예전 코드로는 못 들어온다)
create or replace function regenerate_group_code(p_group uuid) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  code text;
begin
  perform require_group_owner(p_group);
  code := new_group_code();
  update study_groups set invite_code = code where id = p_group;
  return code;
end $$;

create or replace function kick_group_member(p_group uuid, p_nickname text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid;
begin
  perform require_group_owner(p_group);
  select p.id into uid from profiles p join group_members m on m.user_id = p.id and m.group_id = p_group
  where p.nickname = p_nickname;
  if uid is null then
    raise exception '그 멤버를 찾을 수 없어요';
  end if;
  if uid = auth.uid() then
    raise exception '나 자신은 내보낼 수 없어요. 그룹 나가기를 써 주세요';
  end if;
  delete from group_members where group_id = p_group and user_id = uid;
end $$;

create or replace function delete_group(p_group uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  perform require_group_owner(p_group);
  delete from study_groups where id = p_group;
end $$;

-- 그룹 안 순위 get_group_ranking도 파일 끝 '칭호 · 프로필 그림' 부분에 있다

revoke execute on function group_member_left() from public, anon, authenticated;
revoke execute on function new_group_code() from public, anon, authenticated;
revoke execute on function require_group_member(uuid) from public, anon, authenticated;
revoke execute on function require_group_owner(uuid) from public, anon, authenticated;
revoke execute on function my_groups() from public, anon;
revoke execute on function create_group(text) from public, anon;
revoke execute on function join_group(text) from public, anon;
revoke execute on function leave_group(uuid) from public, anon;
revoke execute on function rename_group(uuid, text) from public, anon;
revoke execute on function regenerate_group_code(uuid) from public, anon;
revoke execute on function kick_group_member(uuid, text) from public, anon;
revoke execute on function delete_group(uuid) from public, anon;
grant execute on function my_groups() to authenticated;
grant execute on function create_group(text) to authenticated;
grant execute on function join_group(text) to authenticated;
grant execute on function leave_group(uuid) to authenticated;
grant execute on function rename_group(uuid, text) to authenticated;
grant execute on function regenerate_group_code(uuid) to authenticated;
grant execute on function kick_group_member(uuid, text) to authenticated;
grant execute on function delete_group(uuid) to authenticated;
