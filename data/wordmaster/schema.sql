-- 워드마스터 수능 2000 · Supabase 테이블 정의 (v2: 예문 해석·관련어·어원 포함)
-- Supabase 대시보드 > SQL Editor에 붙여넣고 실행한다.
-- 데이터 적재는 README.md의 "DB에 넣기" 참고.
-- v1을 이미 만들었다면 맨 아래 "v1 → v2 변경" 부분만 실행하면 된다.

create table if not exists wm_words (
  id         int  primary key,          -- 1~2000
  day        int  not null check (day between 1 and 50),
  ord        int  not null check (ord between 1 and 40),   -- DAY 안에서의 순서
  word       text not null unique,
  meaning    text not null,             -- 품사가 다르면 ';'로 구분
  etymology  text                       -- 교재에 어원 풀이가 있는 단어만, 없으면 null
);

create table if not exists wm_sentences (
  id          bigint generated always as identity primary key,
  word_id     int  not null references wm_words(id) on delete cascade,
  level       text not null check (level in ('basic','applied','advanced')),
  source      text not null check (source in ('textbook','original')),
  text        text not null,            -- 원문 문장
  translation text not null,            -- 한국어 해석
  answer      text not null,            -- 빈칸 정답 (실제 형태)
  blanked     text not null,            -- 정답 자리를 '_____'로 바꾼 문장
  unique (word_id, level)
);

-- 유의어·반의어·파생어·숙어 (단어 하나에 여러 개)
create table if not exists wm_relations (
  id       bigint generated always as identity primary key,
  word_id  int  not null references wm_words(id) on delete cascade,
  kind     text not null check (kind in ('synonym','antonym','derivative','phrase')),
  text     text not null,               -- 영어 표현
  meaning  text,                        -- 파생어·숙어의 한국어 뜻 (유의어·반의어는 null)
  source   text not null check (source in ('textbook','original')),
  unique (word_id, kind, text)
);

create index if not exists wm_words_day_idx      on wm_words(day);
create index if not exists wm_sentences_word_idx on wm_sentences(word_id);
create index if not exists wm_relations_word_idx on wm_relations(word_id);

-- 모든 로그인 사용자가 읽기만 가능
alter table wm_words     enable row level security;
alter table wm_sentences enable row level security;
alter table wm_relations enable row level security;

drop policy if exists "wm_words_read"     on wm_words;
drop policy if exists "wm_sentences_read" on wm_sentences;
drop policy if exists "wm_relations_read" on wm_relations;
create policy "wm_words_read"     on wm_words     for select to authenticated using (true);
create policy "wm_sentences_read" on wm_sentences for select to authenticated using (true);
create policy "wm_relations_read" on wm_relations for select to authenticated using (true);
-- insert/update/delete 정책은 만들지 않는다 → 클라이언트에서 수정 불가.
-- 적재는 service role 키(서버 전용)로만 한다.

-- ───────────── v1 → v2 변경 (v1 테이블이 이미 있을 때) ─────────────
-- 위의 create table ... if not exists 는 기존 테이블에 열을 추가하지 않으므로 아래를 실행한다.
alter table wm_words     add column if not exists etymology   text;
alter table wm_sentences add column if not exists translation text not null default '';
