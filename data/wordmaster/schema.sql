-- 워드마스터 수능 2000 · Supabase 테이블 정의
-- Supabase 대시보드 > SQL Editor에 붙여넣고 실행한다.
-- 데이터 적재는 README.md의 "DB에 넣기" 참고.

create table if not exists wm_words (
  id        int  primary key,          -- 1~2000
  day       int  not null check (day between 1 and 50),
  ord       int  not null check (ord between 1 and 40),   -- DAY 안에서의 순서
  word      text not null unique,
  meaning   text not null              -- 품사가 다르면 ';'로 구분
);

create table if not exists wm_sentences (
  id        bigint generated always as identity primary key,
  word_id   int  not null references wm_words(id) on delete cascade,
  level     text not null check (level in ('basic','applied','advanced')),
  source    text not null check (source in ('textbook','original')),
  text      text not null,             -- 원문 문장
  answer    text not null,             -- 빈칸 정답 (실제 형태)
  blanked   text not null,             -- 정답 자리를 '_____'로 바꾼 문장
  unique (word_id, level)
);

create index if not exists wm_words_day_idx on wm_words(day);
create index if not exists wm_sentences_word_idx on wm_sentences(word_id);

-- 단어·예문은 모든 로그인 사용자가 읽기만 가능
alter table wm_words     enable row level security;
alter table wm_sentences enable row level security;

create policy "wm_words_read"     on wm_words     for select to authenticated using (true);
create policy "wm_sentences_read" on wm_sentences for select to authenticated using (true);
-- insert/update/delete 정책은 만들지 않는다 → 클라이언트에서 수정 불가.
-- 적재는 service role 키(서버 전용)로만 한다.
