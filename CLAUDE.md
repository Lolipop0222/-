# 대고 일품타 — 작업 인수인계 (CLAUDE.md)

대전고 학생용 공부 웹앱(PWA + 안드로이드 APK). 야간자습 시간을 기록하고, 과목별로 겨루고, 단어(워마)를 외운다.
이 파일만 읽고 바로 이어서 작업할 수 있게 정리했다. 화면별 설명은 `README.md`, 원래 기획은 사용자가 준 상세 구현 계획서(PDF, 저장소에 없음)를 따랐다.

Next.js 16 주의사항(학습 데이터와 다름 — 코드 쓰기 전에 `node_modules/next/dist/docs/` 확인): @AGENTS.md

---

## 1. 기술 구성과 배포

| 구분 | 내용 |
|---|---|
| 프론트·서버 | Next.js 16.4 App Router, React 19, TypeScript, Tailwind CSS v4, lucide-react 아이콘. `next.config.ts`에 `cacheComponents: true` |
| DB·로그인 | Supabase (Postgres + RLS, 이메일·비밀번호 로그인). 정의는 `supabase/schema.sql` 한 파일 |
| 배포 | Vercel. **`main`에 push하면 자동 배포** → https://daego-ilpumta.vercel.app (고정 주소. `…-xxxx-liyu11.vercel.app` 같은 배포별 주소는 로그인 보호가 걸려 친구들이 못 연다) |
| 안드로이드 | Capacitor 8 (`android/`). APK는 배포 주소를 여는 껍데기라 웹을 다시 배포하면 앱도 바뀐다 |
| 학교 데이터 | NEIS 오픈 API (급식·학사일정) — 서버에서만 호출 |

**Git 작업 방식**
- 저장소: `Lolipop0222/-`. 작업 브랜치 `claude/app-ui-design-nxs7yv`, 배포 브랜치 `main` — 지금까지 둘을 같은 커밋으로 맞춰 왔다:
  `git push origin HEAD:claude/app-ui-design-nxs7yv HEAD:main`
- push 전에 항상 `npx tsc --noEmit`, `npm run lint`, `npm run build` 통과 확인. 커밋 메시지는 한국어로 무엇을·왜.
- push 후 배포 확인: 새 페이지 주소가 200이 되는지 `curl`로 확인 (보통 30초~2분).

**명령어**: `npm run dev` / `npm run build` / `npm run lint` / `npm run wordmaster`(단어 데이터 나누기) / `npm run apk -- https://daego-ilpumta.vercel.app`(APK, JDK 21·Android SDK 필요) / `node scripts/test-neis.mjs`(NEIS 키·응답 확인)

## 2. 환경변수 (값은 `.env.local`과 Vercel 설정에만. 이 파일·코드·커밋에 값을 쓰지 않는다)

| 이름 | 쓰는 곳 | 공개 여부 |
|---|---|---|
| `NEIS_API_KEY` | `lib/neis.ts` (서버 전용, Route Handler에서만) | **비밀**. `NEXT_PUBLIC_` 붙이지 말 것 |
| `NEIS_SCHOOL_CODE` | `lib/neis.ts` — 대전고 표준학교코드. 비우면 학교명으로 조회 | 공개 가능 (`.env.example`에 있음) |
| `NEIS_OFFICE_CODE` | `lib/neis.ts` — 시도교육청코드, 기본 대전 | 공개 가능 |
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase.ts` (브라우저) | 공개 (RLS가 지킴) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `lib/supabase.ts` (브라우저) | 공개 (publishable/anon 키) |
| `APP_URL` | `scripts/build-apk.mjs`가 APK 빌드 때 자동으로 넘김 (파일에 넣지 않음) | — |

- `NEXT_PUBLIC_*`은 **빌드할 때 코드에 박힌다** → Vercel에서 값을 바꾸면 다시 배포해야 반영.
- Vercel에 `이름=값` 한 줄을 통째로 넣은 적이 있어서 `lib/supabase.ts`의 `envValue()`가 앞의 `이름=`과 따옴표를 떼어 낸다.
- Supabase **secret / service_role 키는 쓰지 않는다** (RLS 우회). 지금 구조에서 필요 없다.
- `.env.example`에 이름 목록이 있다.

## 3. DB 구조 (`supabase/schema.sql`)

**적용 방법**: Supabase 대시보드 SQL Editor에 파일을 **통째로** 붙여넣고 Run. 여러 번 실행해도 안전(idempotent)하게 짠다 — 기존 데이터·바꾼 초대코드는 유지된다. 스키마를 고치면 사용자에게 "schema.sql 다시 실행"을 안내한다.
**교훈**: 사용자의 실제 DB가 오래된 버전일 수 있다(실제로 처음 버전에서 바로 올리다 `column "task_id" does not exist`가 났다). 스키마를 바꾸면 **처음 버전(커밋 97885ae)부터 지금까지 모든 버전에서 올리는 경우 + 새 DB**를 로컬 Postgres로 시험한다 (아래 7장). 열을 쓰는 정책·함수는 그 열을 만든 줄보다 뒤에 둔다.

| 테이블 | 내용 | 접근 |
|---|---|---|
| `app_settings` | `invite_code` 가입 초대코드 | 클라이언트 못 읽음 |
| `profiles` | 닉네임(2~12자, 고유)·학년(1~3)·반. **실명·학번 안 받음** | 본인만 조회·수정 |
| `sessions` | 공부 기록: subject, started_at, ended_at, away_count, duration(계산 열), task_id(플래너 과제), label(기타 이름) | 본인만 조회. 쓰기는 함수로만 (기타만 직접 쓰기) |
| `ddays` | 직접 만든 디데이 (1인 30개) | 본인만 |
| `tasks` | 플래너 과제 (날짜·제목·과목·완료·skipped·routine_id, 하루 30개) | 본인만 |
| `routines` | 데일리 루틴 (요일 배열 0=일…6=토, active, 20개) | 본인만 |
| `planner_days` | 날짜별 COMMENT·MEMO | 본인만 |

**함수**: `create_profile(닉네임, 학년, 반, 초대코드)` / `start_session(과목, 과제id?)` / `end_session(세션id, 이탈횟수, 종료시각?)` / `get_ranking(범위 'school'|'grade'|'class', 과목|null)` / `materialize_routines(날짜)` / `kst_day_start()`, `kst_week_start()`. 모두 `authenticated`만 실행 가능.

**초대코드 방식**: 가입 = 이메일·비밀번호(Supabase Auth, **Confirm email 꺼 둠** — 무료 메일 한도 때문) → `create_profile`에 닉네임·학년·반·초대코드. 코드가 틀리면 프로필이 안 생겨 앱을 못 쓴다(로그인 화면의 프로필 단계에 머묾). 기본값 `DAEGO2026`이지만 사용자가 바꿨을 수 있다. 바꾸기: `update app_settings set value = '새코드' where key = 'invite_code';`

**시간 기록 규칙** (계획서 6.1·6.2)
- 클라이언트는 시간을 숫자로 보내지 않는다. 시작·종료 시각은 **서버 now()**. 길이는 계산.
- 새로 시작하면 켜져 있던 세션은 서버가 끝낸다.
- 앱을 30초 넘게 벗어나면 자동 정지 — 벗어난 순간을 `p_end_at`으로 보낸다(서버는 **줄이는 쪽으로만** 반영).
- 한 세션 4시간 초과는 합계·순위에서 제외. 하루 16시간을 채우면 더 시작 못 함.
- 하루 = 한국 시간 0시 기준, 세션은 **시작한 날**에 셈. 순위는 **매주 월요일 0시(KST)** 초기화.
- 순위는 닉네임·학년·반·합계·공부 중 여부만 내보낸다. 진행 중 세션은 끝나야 합계에 들어간다.
- **기타**는 순위·공부 합계·16시간 상한·"공부 중" 표시에서 모두 제외. 대신 RLS로 본인이 직접 추가·수정·삭제 가능(기타 → 다른 과목으로 바꾸는 건 막힘).
- `lib/study.ts`는 schema.sql을 다시 실행하기 전 DB(task_id·label 열 없음, 예전 start_session)에서도 타이머가 돌도록 예전 방식으로 대체한다. 새 테이블이 없으면 플래너·디데이 추가는 "준비 중"으로 표시.

## 4. 참고 문서·데이터 위치

| 경로 | 내용 |
|---|---|
| `docs/NEIS_API.md` | NEIS API 명세. **NEIS 코드는 이 문서 기준**. 8장 = 실제 응답에서 확인한 차이 (숫자 필드, 알레르기 번호 형식, 학년 필드 `*` 등) |
| `scripts/test-neis.mjs` | 키·학교코드·실제 응답 확인 |
| `data/wordmaster/README.md` | 워드마스터 수능 2000 데이터 설명 (DAY 1~50 × 40단어, 예문 3개씩, 채점·오답 보기 규칙). `schema.sql`·`seed.py`는 Supabase로 옮길 때용(아직 안 씀) |
| `public/wordmaster/day-NN.json` | 위 데이터를 DAY별로 나눈 것 (`npm run wordmaster`로 다시 만듦) |
| `lib/meals.ts` | 2026년 11월 식단표(학교 한글 파일에서 옮김, 알레르기 번호 포함). NEIS 실패 시 대신 쓰고, "슈퍼 프라이데이" 메모는 NEIS에 없어 여기서 덧붙임 |
| `supabase/schema.sql` | DB 전체 정의 |
| `README.md` | 화면 목록, 파일 구조, Supabase·APK 설정 방법 |
| `AGENTS.md` | Next.js 16 에이전트 규칙 (`next dev`가 자동으로 다시 씀) |

**NEIS 연동 구조**: `lib/neis.ts`(파싱·페이지 반복·오류 코드, `use cache` 몇 시간) → `/api/meals/[month]`, `/api/schedule/[month]`(토요휴업일 제외), `/api/exams`(앞으로 6개월 시험: 고사·학력평가·모의평가·수능, 며칠짜리 묶음, 학년 거르기는 화면에서). 문서 6장의 "하루 1회 cron → Supabase `school_cache`"는 **아직 안 함**.

## 5. 사용자가 정한 규칙

- **과목**: 순위에 들어가는 7과목 **국어·영어·수학·과학·사회·한국사·인강** + **기타**(순위·합계 제외, 나만 보고 직접 편집). 처음엔 국어·영어·수학·과학·사회 5개였고 나중에 한국사·인강·기타를 추가했다. 목록은 `lib/subjects.ts`와 `schema.sql`의 subject check 3곳(sessions·tasks·routines)을 같이 고친다.
- **과목 자동 짐작 금지**: 과제 이름으로 과목을 자동으로 고르던 기능은 "오류 가능성" 때문에 사용자가 빼라고 했다. 과목은 학생이 직접 고른다. 플래너 과제 ▶ / 타이머 화면 과제 선택은 학생이 고른 과목으로만 시작한다.
- **다크 모드 기본**. 색은 `app/globals.css` 토큰, 공통 부품은 `components/ui.tsx`. 휴대폰 화면 기준(`max-w-md`), 한국어 존댓말(해요체) 문구.
- **무음**: ⚠️ 사용자가 인수인계 요청에 "무음"을 규칙으로 적었지만, 이 세션에서 정한 기록이 없다(코드에도 없음). 새 세션에서 **무엇을 뜻하는지 사용자에게 확인**하고 여기에 적을 것.
- **가짜 데이터를 실제 데이터와 섞지 않는다**: 실데이터가 들어온 화면의 가짜(학사일정·수행평가·순위·스터디그룹 멤버)는 지웠다. 아직 기능이 없으면 "준비 중"으로 표시.
- **실명 받지 않음**, 닉네임만. 학년·반은 순위 범위용.
- 워마 퀴즈 제한 시간은 **셀프 옵션, 기본 끄기**.
- 디데이: 학교 시험은 NEIS에서 자동(내 학년만) + 학생이 직접 추가.
- 플래너: 사용자가 준 **종이 플래너 양식**(YEAR/MONTH/DAY · D-DAY · COMMENT · TOTAL TIME · TASKS · TIMETABLE 6시~5시 10분 칸 · MEMO). TIMETABLE은 공부 기록으로 자동 색칠.
- 보류: 스터디그룹 생성, 캐릭터·재화·스킨(①). "가장 먼저 만들 수 있는 것부터" 순서로 ③퀴즈 타이머 → ②디데이 → ④플래너를 했다.
- **"실제로 되는지 테스트하고 결과(스크린샷) 보고"**를 자주 요청한다. 사용자 Supabase에 테스트 계정을 만들지 말 것(전에 만든 테스트 계정을 사용자가 지웠다) — 7장 방법으로 테스트.
- 계획서 원칙: 다 만들고 공개하지 말고, 친구 10명에게 써 보게 하고 반응을 보며 다음 기능을 정한다.

## 6. 현재 상태

**완료 (실데이터)**
- 로그인·가입(초대코드), 로그인 안 하면 `/login`으로 (개인정보 처리방침만 예외)
- 공부 타이머(`/timer`): 8과목, 서버 시각 기록, 새로고침·탭 이동에도 이어짐, 30초 이탈 자동 정지, 플래너 과제 연결
- 오늘·이번 주 과목별 공부 시간(홈·타이머·내정보), 기타 시간은 따로 표시
- 순위: 전교/학년/반 × 전체/과목별, 내 순위 ±3명, 공부 중 초록 점
- 기타 기록(`/timer/etc`): 최근 30일, 직접 추가·수정·삭제
- 급식(조·중·석식, 알레르기 번호)·학사일정 — NEIS, 캘린더(`/calendar`)와 홈
- 디데이(`/dday`, 홈 카드): 학교 시험 자동 + 직접 추가
- 플래너(`/planner`)·데일리 루틴(`/planner/routines`), 홈 플래너 카드
- 워마 퀴즈(`/words/day/1~50`): 뜻 고르기 / 빈칸 채우기(단어 상자 10개, 기본·응용·심화), 틀린 것만 다시, 제한 시간 옵션. 최고 점수는 **기기 localStorage**에만 저장
- PWA manifest·아이콘, 안드로이드 APK(Capacitor, 디버그 서명)

**아직 가짜 / 준비 중** (`lib/mock.ts` 등)
- 홈 공지 배너(`EventBanner`) — 가짜
- 워마 "오늘 복습할 단어 23개", 상자 5단계 분포, `/words/review`(상자 복습) — 가짜
- `/words/add`(직접 입력), `/words/scan`(사진 스캔) — 화면만
- 스터디그룹, 아바타 꾸미기, 계정 삭제 — "준비 중" 표시만
- 비밀번호 찾기 없음(메일 인증 꺼 둠), 오프라인 기록 임시 저장 없음, 수행평가(반장 등록) 없음, 알림 없음

**인수인계 시점에 확인할 것**
- 사용자가 **고친 `supabase/schema.sql`(커밋 d2da6e1)을 실제 Supabase에서 실행했는지** 확인. 실행 전이면 디데이 직접 추가·플래너·한국사·인강·기타가 "준비 중"/"아직 쓸 수 없어요"로 나온다. 확인 방법: publishable 키로 `GET /rest/v1/tasks?select=id&limit=1` → `PGRST205`면 아직 안 함, `[]`면 됨.
- GitHub 저장소 기본 브랜치를 `main`으로 바꾸라고 안내했었다(사용자가 바꿨는지 모름).
- "무음" 규칙의 뜻 (5장).

**다음 할 일 후보** (사용자와 순서를 정할 것)
1. 친구들에게 초대코드를 주고 1주일 써 보게 하기 — 계획서 1단계 완료 기준
2. ① 공부 시간으로 성장하는 캐릭터 → 나중에 재화·스킨 상점 (그림 작업 필요, 계획서 6단계)
3. 계정 삭제(개인정보 처리방침에서 약속함), 비밀번호 재설정 방법
4. 워마 상자 5단계 복습을 실제 데이터로 (Supabase `reviews` 테이블, 퀴즈 점수도 계정에 저장)
5. NEIS 하루 1회 cron + `school_cache` (문서 6장)
6. 스터디그룹(초대코드 6자리), 수행평가(반장 등록), 이벤트 배너 관리자 화면 — 사용자가 보류한 것 포함

## 7. 테스트 방법 (이 클라우드 환경 기준)

- **브라우저**: Playwright·Chromium이 설치돼 있다 (`PW=$(npm root -g)/playwright`, 브라우저 `/opt/pw-browsers`). `npm run build && npm run start -- -p 3xxx` 후 390×844로 화면을 찍어 확인.
- **NEIS/Supabase에 서버가 접속하려면**: 이 환경의 Node fetch는 프록시를 쓰도록 `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt npm run start …`. (`open.neis.go.kr`, `*.supabase.co`는 사용자가 네트워크 허용함. 외부 프로그램 다운로드는 보안 설정으로 막혀 있다)
- **로그인 화면 이후 테스트**: 실제 Supabase에 계정을 만들지 않고, Playwright `page.route()`로 Supabase 주소의 요청을 가로채 가짜 응답을 준다. 로그인 상태는 localStorage `sb-<프로젝트ref>-auth-token`에 가짜 세션을 넣는다. 테이블·RPC를 흉내 내는 작은 가짜 서버를 테스트 스크립트에 둔다(오류 코드도 실제와 같게: 없는 열 `42703`, 없는 함수 `PGRST202`, 없는 테이블 `PGRST205`, RLS 위반 `42501`).
- **DB 규칙(RLS·함수) 테스트**: 로컬 Postgres 16이 있다. root로는 못 돌리므로 `postgres` 사용자로 `/var/lib/postgresql/` 아래에 클러스터를 만든다(스크래치 폴더는 권한이 바뀌어 크래시 남). Supabase 흉내 SQL을 먼저 실행한 뒤 `schema.sql`을 올리고, `set role authenticated; select set_config('request.jwt.claim.sub', '<uuid>', false);`로 학생을 바꿔 가며 시험:

```sql
-- Supabase 흉내 (역할은 클러스터 공통이라 두 번째 DB부터는 create role 줄을 빼고 실행)
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
```

- 스키마 변경 시 업그레이드 경로: `git show <커밋>:supabase/schema.sql`로 예전 버전(97885ae 처음, b944369 디데이, 0f40384 플래너, d2da6e1 현재)을 꺼내 각각 올린 DB에 새 파일을 2번 실행.
- Next 16은 떠난 페이지를 숨긴 채 DOM에 남겨 둔다 → Playwright 선택자는 `:visible`이나 열린 dialog 안으로 범위를 좁힌다.

## 8. 구현하며 알게 된 함정

- Tailwind 클래스 충돌: 기본 클래스가 있는 부품에 같은 속성을 덮어쓰면 안 먹는다. `Card`는 `flush`(안쪽 여백 없음), `PrimaryButton`은 `tone`(accent/live/danger) 속성을 쓴다.
- `<form>` 안의 `<button>`은 기본이 submit — 선택 버튼(`Segmented` 등)은 `type="button"`.
- 렌더 중 `Date.now()`·`new Date()` 금지(빌드 프리렌더·린트 규칙). 브라우저에서만 정하고(`useEffect`/`setTimeout`/`useSyncExternalStore`), "오늘"이 필요한 API Route는 `await connection()` 후 계산.
- 린트 `react-hooks/set-state-in-effect`: effect 안에서 바로 setState 하지 말고 key로 다시 그리거나 콜백에서.
- 한국 날짜는 `lib/dday.ts`의 `kstToday()`, `lib/neis.ts`의 `kstYmd()`, `lib/study.ts`의 `kstDayStart()/kstWeekStart()`를 쓴다 (Vercel 서버는 UTC).
- Supabase 오류는 `lib/supabase.ts`의 `koreanError()`로 학생용 문장으로 바꿔 보여 준다.
