# 대고 일품타 — 작업 인수인계 (CLAUDE.md)

대전고 학생용 공부 웹앱(PWA + 안드로이드 APK). 야간자습 시간을 기록하고, 과목별로 겨루고, 단어(워마)를 외운다.
이 파일만 읽고 바로 이어서 작업할 수 있게 정리했다. 화면별 설명은 `README.md`, 원래 기획은 사용자가 준 상세 구현 계획서(PDF, 저장소에 없음)를 따랐다.

Next.js 16 주의사항(학습 데이터와 다름 — 코드 쓰기 전에 `node_modules/next/dist/docs/` 확인): @AGENTS.md

---

## 1. 기술 구성과 배포

| 구분 | 내용 |
|---|---|
| 프론트·서버 | Next.js 16.4 App Router, React 19, TypeScript, Tailwind CSS v4, lucide-react 아이콘. `next.config.ts`에 `cacheComponents: true` |
| DB·로그인 | Supabase (Postgres + RLS, 이메일·비밀번호 로그인). 정의는 **`supabase/parts/01~05-*.sql` 조각**이 원본, `supabase/schema.sql`은 이어 붙인 전체본(`npm run schema`로 자동 생성) |
| 배포 | Vercel. **`main`에 push하면 자동 배포** → https://daego-ilpumta.vercel.app (고정 주소. `…-xxxx-liyu11.vercel.app` 같은 배포별 주소는 로그인 보호가 걸려 친구들이 못 연다) |
| 안드로이드 | Capacitor 8 (`android/`). APK는 배포 주소를 여는 껍데기라 웹을 다시 배포하면 앱도 바뀐다 |
| 학교 데이터 | NEIS 오픈 API (급식·학사일정) — 서버에서만 호출 |

**Git 작업 방식**
- 저장소: `Lolipop0222/-`. 배포 브랜치는 `main`. 세션마다 정해지는 **그 세션의 작업 브랜치와 `main`에 같은 커밋을 올린다** (`main`에 올려야 Vercel이 배포):
  `git push origin HEAD:<세션 작업 브랜치> HEAD:main`
  (예전 세션 브랜치 `claude/app-ui-design-nxs7yv`는 더 쓰지 않는다)
- push 전에 항상 `npx tsc --noEmit`, `npm run lint`, `npm run build` 통과 확인. 커밋 메시지는 한국어로 무엇을·왜.
- push 후 배포 확인: 새 페이지 주소가 200이 되는지 `curl`로 확인 (보통 30초~2분).

**명령어**: `npm run dev` / `npm run build` / `npm run lint`(schema.sql이 조각과 같은지도 검사) / `npm run schema`(조각 → schema.sql) / `npm run wordmaster`(단어 데이터 나누기) / `npm run apk -- https://daego-ilpumta.vercel.app`(APK, JDK 21·Android SDK 필요) / `node scripts/test-neis.mjs`(NEIS 키·응답 확인)

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

## 3. DB 구조 (`supabase/parts/` → `supabase/schema.sql`)

**적용 방법 (2026-11-05부터 조각)**: 전체본(1,300줄)을 SQL Editor에 붙여넣으면 느리고 렉이 심하다고 사용자가 말해서 **조각 5개**로 나눴다 — `01-core`(설정·프로필·기록·플래너·디데이·타이머), `02-security`(보안·문의함·복구 코드·계정 삭제·관리자), `03-groups`(스터디그룹), `04-titles`(칭호·프로필 그림/사진 제약·**순위 함수**), `05-storage`(Storage 버킷·사진·프린트 아카이브·관리자 사진/계정 삭제). 번호 순으로 앞 조각이 있어야 하고, 각 조각은 여러 번 실행해도 안전(idempotent)하다.
- 스키마를 고칠 때: **해당 조각 파일을 고치고** `npm run schema`(전체본 재생성, `npm run lint`가 어긋나면 실패). 사용자에게는 **"바뀐 조각 이름"만** 실행하라고 안내하고 `supabase/README.md`의 변경 기록 표에 한 줄 추가한다. 새 기능이 크면 `06-…sql`처럼 새 조각을 만든다.
- **같은 제약·함수를 두 조각에서 만들지 않는다.** (예전에 사진 제약을 칭호 부분과 사진 부분에서 따로 만들어서, 사진을 올린 학생이 있으면 전체본 재실행이 `profiles_avatar_check … violated by some row`로 실패하는 버그가 있었다 → 04 한 곳으로 모음)
- **실제 DB에 무엇이 적용됐는지 확인하는 법**: 배포된 사이트 JS 묶음에 공개 URL·publishable 키가 들어 있다(`curl` 로 `/login` HTML의 `/_next/static/…js`를 받아 `supabase.co`, `sb_publishable_` 검색). 그 키로 읽기만 하는 요청: 함수 `POST /rest/v1/rpc/<함수>` → 있으면 `42501 permission denied`(로그인 필요), 없으면 `PGRST202`. 테이블 `GET /rest/v1/<테이블>?select=id&limit=1` → 있으면 `42501`, 없으면 `PGRST205`. 쓰기 요청이나 계정 만들기는 하지 않는다.
**교훈**: 사용자의 실제 DB가 오래된 버전일 수 있다(실제로 처음 버전에서 바로 올리다 `column "task_id" does not exist`가 났다). 스키마를 바꾸면 **처음 버전(커밋 97885ae)부터 지금까지 모든 버전에서 올리는 경우 + 새 DB**를 로컬 Postgres로 시험한다 (아래 7장). 열을 쓰는 정책·함수는 그 열을 만든 줄보다 뒤에 둔다.

| 테이블 | 내용 | 접근 |
|---|---|---|
| `app_settings` | `invite_code` 가입 초대코드 | 클라이언트 못 읽음 |
| `profiles` | 닉네임(2~12자, 고유)·학년(1~3)·반·avatar(프로필 그림 `그림:색`)·title_code(대표 칭호). **실명·학번 안 받음** | 본인만 조회. 직접 수정은 **열 권한으로** nickname·grade·class_no·avatar만 (title_code는 `set_title()`로만) |
| `sessions` | 공부 기록: subject, started_at, ended_at, away_count, duration(계산 열), task_id(플래너 과제), label(기타 이름) | 본인만 조회. 쓰기는 함수로만 (기타만 직접 쓰기) |
| `ddays` | 직접 만든 디데이 (1인 30개) | 본인만 |
| `tasks` | 플래너 과제 (날짜·제목·과목·완료·skipped·routine_id, 하루 30개) | 본인만 |
| `routines` | 데일리 루틴 (요일 배열 0=일…6=토, active, 20개) | 본인만 |
| `planner_days` | 날짜별 COMMENT·MEMO | 본인만 |
| `inquiries` | 문의함 (분류·내용 5~1000자·답변, 하루 5개) | 본인 조회·작성·삭제, 수정 불가. 답변은 관리자 함수로만 |
| `admins` | 관리자 user_id. **SQL Editor에서만** 추가 | 클라이언트 못 읽음 |
| `recovery_codes` | 비밀번호 복구 코드 **해시**(bcrypt) | 클라이언트 못 읽음 |
| `security_attempts` | 초대코드·복구 코드·그룹 코드 틀린 기록 (하루 지나면 지움) | 클라이언트 못 읽음 |
| `study_groups` | 스터디그룹 (이름 2~20자, 6자리 초대코드, owner_id) | 클라이언트 못 읽음 — 함수로만 |
| `group_members` | 그룹원 (group_id, user_id, joined_at) | 클라이언트 못 읽음 — 함수로만 |
| `title_defs` | 칭호 정의 31개 (code·이름·등급·분류·설명·metric·goal·unit·sort·active). `04-titles.sql`의 insert가 원본 | 클라이언트 못 읽음 (히든 이름 보호) — `my_titles()`로만 |
| `prints` | 프린트 아카이브 목록 (제목·분류 수행평가/학습지/시험 대비/기타·과목·학년(null=전 학년)·메모·file_path·file_name·크기) | 가입한(프로필 있는) 학생 조회, 추가·수정·삭제는 관리자만(RLS `is_admin()`) |
| Storage `avatars` (공개) | 프로필 사진 `<user id>/<16자>.webp|jpg`, 300KB | 내 폴더만 올리기·지우기, 관리자는 모두 지우기 |
| Storage `prints` (비공개) | 프린트 파일 `<uuid>.<확장자>`, 50MB | 프로필 있는 학생 읽기(서명 주소), 관리자만 올리기·지우기 |
| `user_titles` | 얻은 칭호 (user_id, code, earned_at, seen=알림 띄웠는지). 영구 보관 | 클라이언트 못 읽고 못 씀 — 함수로만 |

**함수**: `create_profile(닉네임, 학년, 반, 초대코드)` / `start_session(과목, 과제id?)` / `end_session(세션id, 이탈횟수, 종료시각?)` / `get_ranking(범위 'school'|'grade'|'class', 과목|null)` / `materialize_routines(날짜)` / `kst_day_start()`, `kst_week_start()` / `create_recovery_code()`, `recovery_code_created_at()` / `delete_my_account()` / `is_admin()`, `admin_list_inquiries()`, `admin_reply_inquiry(id, 답변)`, `admin_issue_recovery_code(닉네임)` / 스터디그룹: `my_groups()`, `create_group(이름)`, `join_group(코드)`(틀리면 null), `leave_group(id)`, `rename_group`, `regenerate_group_code`, `kick_group_member(id, 닉네임)`, `delete_group`, `get_group_ranking(id, 과목|null)`(그룹원만, 이번 주·오늘·공부 중) / 칭호: `check_titles()`(판정 + 아직 알림 안 띄운 새 칭호 반환), `my_titles()`(진행도, 못 얻은 히든은 ???), `set_title(code|null)` / 관리자: `admin_list_photos()`, `admin_remove_avatar(닉네임)`(내린 경로 반환 → 앱이 파일 삭제), `admin_delete_user(닉네임)`(관리자 계정은 불가). `get_ranking`·`get_group_ranking`은 프로필 그림·대표 칭호(이름·등급)도 돌려주고, 칭호 테이블 뒤에 있어야 해서 **`04-titles.sql`** 끝에 있다(열이 바뀌어 drop 후 create). 모두 `authenticated`만 실행 가능. **예외: `reset_password_with_code(이메일, 코드, 새 비밀번호)`만 anon도 실행**(로그인 전에 쓰므로). 내부용 `issue_recovery_code(uuid)`와 트리거 함수는 아무도 직접 못 부른다.

**스터디그룹 규칙**: 한 사람이 들어가는 그룹 5개, 만든 그룹 3개, 그룹 30명, 코드 15분에 10번 틀리면 잠김. 방장이 나가거나 계정을 지우면 `group_member_left` 트리거가 가장 먼저 들어온 사람에게 방장을 넘기고, 아무도 없으면 그룹을 지운다. 그룹 순위 규칙은 `get_ranking`과 같다(4시간 넘는 세션·기타 제외).

**칭호 규칙** (`supabase/parts/04-titles.sql`)
- 판정은 전부 서버: `title_stats(uid)`(내부용)가 숫자 값들(jsonb)을 계산 → `title_defs`의 `metric` 값이 `goal` 이상이면 지급. **칭호 추가 = `title_defs` insert 한 줄**(있는 metric이면), 새 조건이면 `title_stats()`에 값 하나 추가. 단어 퀴즈 칭호는 점수를 서버에 저장하게 되면 `quiz_…` metric을 더한다.
- 공부 시간 = 순위와 같은 기준(기타 제외, 한 기록 1초~4시간). 날짜·요일·시각은 KST, 기록은 시작한 날. 연속 출석 = 하루 30분 이상인 날의 최장 연속(gaps-and-islands). 히든 일부(리셋 사냥꾼·새해·작심삼분)는 진행 중 기록도 봄(기타·4시간 넘게 켜 둔 것 제외).
- 주간 순위 칭호(반/학년/전교 1위) = **끝난 모든 주**(이번 주 제외)를 본다 → 앱을 안 연 주도 나중에 소급. 그 주 5시간 이상 + 그 범위에 그 주 기록 있는 학생 3명 이상, 공동 1위 모두 지급. 반·학년은 지금 프로필 기준.
- 중복 없음: `user_titles` primary key + `on conflict do nothing`. 알림은 `seen`으로 한 번만.
- cron이 없어서 앱이 `check_titles()`를 부른다(`components/TitlesProvider.tsx`): 앱 열기, 공부 기록 변화(study.version), 플래너 과제 완료(`requestTitleCheck()` 이벤트), 내정보·칭호 화면 열기. 새 칭호는 위에 소리 없는 토스트.
- 등급: 일반(common)·희귀(rare)·영웅(epic)·전설(legendary)·히든(hidden). 색·모양은 `globals.css`의 `--g-*`, `.tb-*`(배지), `.ring-*`(프로필 그림 테두리). 전설은 금빛이 반짝, 히든은 점선+그라데이션, 움직임은 `prefers-reduced-motion`이면 멈춤.
- 프로필 그림 = 사진 대신 그림 24개 × 과목색 8개(`lib/titles.ts`의 `AVATAR_ICONS/COLORS`, 실명·얼굴 안 받는 원칙). DB는 `그림:색` 모양만 검사. 대표 칭호 등급이 그림 테두리 색이 된다.
- 예전 DB 호환: `AuthProvider`는 avatar·title_code 열이 없으면(42703) 예전 열만 읽는다.

**사진 프로필·프린트 아카이브 규칙** (`supabase/parts/05-storage.sql`, Supabase Storage. 사진 avatar 제약·`profiles_avatar_guard` 트리거는 `04-titles.sql`)
- 사진 프로필: 사용자가 "무조건 넣어"라고 해서 넣음. 부적절한 사진은 관리자가 `/me/admin`에서 내리거나 계정 삭제(사용자 방침). 앱(`lib/photos.ts`)이 가운데를 정사각형으로 잘라 320px webp(안 되면 jpg)로 다시 그려 올린다 → 용량 작고 EXIF(위치 등) 제거. avatar = `photo:<user id>/<16자>.webp`, `profiles_avatar_guard` 트리거가 **내 폴더 사진만** 허용하고 `avatar_at`을 기록. 사진을 바꾸거나 지우면 예전 파일도 지움, 계정 삭제 전에 내 폴더 파일 삭제(`removeAllMyPhotos`).
- 공개 버킷이라 주소를 아는 사람은 볼 수 있음(경로에 무작위 16자). CSP `img-src`에 `https://*.supabase.co` 추가함.
- 프린트 아카이브(`/prints`): 관리자는 오른쪽 위 "올리기" → 파일 여러 개(끌어다 놓기 가능) + 분류·과목·학년·메모 한 번에 → 학생들에게 바로 보임. 파일은 비공개 버킷, 열 때 10분짜리 서명 주소(`openPrint`, 아이폰 팝업 차단 때문에 빈 창을 먼저 연다). PDF·사진은 바로 보기, 한글·오피스는 내려받기. 학생 화면 기본은 "내 학년"(+전 학년) 필터.
- 로고: 사용자가 준 Print Archive 로고(검은 바탕 PNG)를 파란 부분·회색 글자 두 장의 투명 마스크(`public/print-archive/logo-blue.png`, `logo-gray.png`)로 나눠 CSS mask로 칠한다(`components/PrintArchiveLogo.tsx`, 색 `--pa-blue`/`--pa-ink`) → 모든 테마에서 보임. 쓰는 곳: 프린트 아카이브 머리, 홈 카드, 관리자 화면. (로딩 화면은 2026-11-06부터 대품타 로고로 바뀜 — 아래)

**앱 아이콘·로딩 화면 (2026-11-06, 사용자가 준 그림 3장)**
- 그림: ① 엠블럼+대전고+「일등급을 품은 타이머」+≡ DAEJEON HIGH SCHOOL · STUDY PLANNER (첫 화면용) ② 엠블럼+「대품타」+≡ 영문 줄 (앱 안 로딩용) ③ 시계 로마 숫자 + 高 방패 엠블럼 (앱 아이콘). 원본은 저장소에 없고, 요소별 투명 마스크로 나눠 `public/brand/`에 둔다: `emblem-ring.png`(로마 숫자), `emblem-shield.png`(高 방패, 둘 다 512 정사각·같은 위치), `title-ildeunggeup.png`, `daepumta-1~3.png`(대·품·타, 같은 틀 크기라 겹치면 제자리). ③ 원본 jpg의 옅은 대각선 워터마크는 밝기 기준으로 지우고 grey closing으로 메움.
- `components/BrandLoader.tsx`: `StartSplash`(① — `AuthProvider`가 로그인 확인 전에 보여 줌, 이번 탭에서 처음 열 때만 **최소 1.8초**(sessionStorage `daego-intro-seen`), 새로고침·이동 때는 바로), `AppLoader`(② — 화면 단위 "불러오는 중" 자리와 `app/loading.tsx`, `size="inline"`은 작은 엠블럼+글자로 작은 목록용), `Emblem`. 휴대폰 세로라 ①은 엠블럼 아래로 글자를 쌓았다. 영문 줄·대전고는 진짜 글자(Pretendard), ≡는 CSS 막대.
- 움직임(`globals.css` `.em-*`, `.bl-*`, CSS만): 시계판이 12시부터 시계 방향으로 그려짐(conic mask, `@property --em-sweep`) → 금색 불빛이 숫자를 한 칸씩 째깍 돎(`steps(12)`, 꼬리 두 칸) / 高 방패가 톡 튀어나와 숨 쉼 / 대전고·선이 나타나고 제목이 왼쪽부터 써지듯(clip-path) + 금빛이 스쳐 감 / ≡ 막대가 차례로 / 대품타 글자가 차례로 통통. `prefers-reduced-motion`이면 멈춤. 색은 테마 글자색 + `--brand-gold`(어두운 테마 #d1aa3a, 라이트·종이·솔라라이즈드 #8c6f17).
- 아이콘: 크림색(#F4F2EC) 바탕에 검은 엠블럼. 웹 `public/brand/icon-192/512.png`, `icon-maskable-512.png`(안전 영역), `app/icon.png`(탭), `app/apple-icon.png`(아이폰), 안드로이드 `android/app/src/main/res/mipmap-*/ic_launcher*.png`(적응형 전경 + 배경색 `values/ic_launcher_background.xml`). 안드로이드 시작 화면 `drawable*/splash.png`는 기본 다크 테마 바탕에 밝은 엠블럼+제목(웹 첫 화면과 이어지게). **APK 아이콘·시작 화면은 APK를 다시 빌드해야 바뀐다**(`npm run apk -- https://daego-ilpumta.vercel.app`, 웹 쪽은 배포만으로 바뀜).

**관리자 등록**: `insert into admins (user_id) select id from profiles where nickname = '닉네임' on conflict do nothing;` — 사용자(앱 주인)가 직접 실행. 관리자면 내정보에 "관리자" 메뉴(`/me/admin`)가 보인다.

**보안 규칙 (2026-11-05 강화)** — 새 기능을 만들 때도 지킨다
- 새 테이블: RLS 켜고 `to authenticated` 정책만, `revoke all on … from anon`. 학생이 직접 쓰는 테이블엔 개수·날짜 범위 제한 트리거(`planner_limits`, `ddays_limit`, `date_range_guard`, `etc_session_guard`, `inquiries_guard` 참고).
- 새 함수: `security definer`면 `set search_path = public`, 끝에서 `revoke execute … from public, anon` + `grant … to authenticated`를 꼭 쓴다 (Supabase는 새 함수를 anon도 부를 수 있게 만든다).
- 틀린 시도를 세야 하는 함수(초대코드·복구 코드)는 **오류를 던지면 기록도 되돌아간다** → 기록 후 null이나 결과 글자('invalid' 등)를 돌려준다. `create_profile`은 코드가 틀리면 null을 돌려주고 앱(`app/login/page.tsx`)이 "초대코드가 맞지 않습니다"로 보여 준다. 15분에 5번 틀리면 잠김.
- 비밀번호 찾기 = 복구 코드(12자리, 60비트, 해시만 저장, 한 번 쓰면 삭제). 성공하면 `auth.users.encrypted_password`를 bcrypt로 바꾸고 `auth.sessions`를 지워 다른 기기를 로그아웃. 메일 재설정은 Confirm email을 꺼 뒀고 Supabase 기본 메일은 팀원 주소로만 보내져서 안 쓴다(쓰려면 커스텀 SMTP 필요).
- 계정 삭제 = `delete_my_account()`가 `auth.users`를 지움 → cascade로 모든 기록 삭제. 앱은 비밀번호를 다시 확인하고 닉네임을 똑같이 쓰게 한 뒤 부른다.
- 웹: `next.config.ts`의 보안 헤더(CSP — 스크립트는 self, 통신은 self+`*.supabase.co`, CSS·글꼴은 jsdelivr만 / iframe 금지 / HSTS 등). 외부 스크립트·이미지·API를 새로 쓰면 CSP에 추가해야 한다. API 주소의 달 파라미터는 `validMonth()`로 검사.
- `dangerouslySetInnerHTML` 쓰지 않는다. 학생이 쓴 글(문의·닉네임·그룹 이름)은 React가 글자로만 그린다. 예외는 `app/layout.tsx`의 테마 부팅 스크립트 하나(`lib/themes.ts`의 고정 문자열, 사용자 입력 없음).

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
| `supabase/parts/`, `supabase/README.md` | DB 정의 조각 01~05(원본)와 실행 순서·변경 기록. `supabase/schema.sql`은 자동 생성 전체본 |
| `README.md` | 화면 목록, 파일 구조, Supabase·APK 설정 방법 |
| `AGENTS.md` | Next.js 16 에이전트 규칙 (`next dev`가 자동으로 다시 씀) |

**NEIS 연동 구조**: `lib/neis.ts`(파싱·페이지 반복·오류 코드, `use cache` 몇 시간) → `/api/meals/[month]`, `/api/schedule/[month]`(토요휴업일 제외), `/api/exams`(앞으로 6개월 시험: 고사·학력평가·모의평가·수능, 며칠짜리 묶음, 학년 거르기는 화면에서). 문서 6장의 "하루 1회 cron → Supabase `school_cache`"는 **아직 안 함**.

## 5. 사용자가 정한 규칙

- **과목**: 순위에 들어가는 7과목 **국어·영어·수학·과학·사회·한국사·인강** + **기타**(순위·합계 제외, 나만 보고 직접 편집). 처음엔 국어·영어·수학·과학·사회 5개였고 나중에 한국사·인강·기타를 추가했다. 목록은 `lib/subjects.ts`와 `01-core.sql`의 subject check 3곳(sessions·tasks·routines)을 같이 고친다.
- **과목 자동 짐작 금지**: 과제 이름으로 과목을 자동으로 고르던 기능은 "오류 가능성" 때문에 사용자가 빼라고 했다. 과목은 학생이 직접 고른다. 플래너 과제 ▶ / 타이머 화면 과제 선택은 학생이 고른 과목으로만 시작한다.
- **다크 모드 기본 + 테마 8개**(기본 다크·라이트·종이·노드·모카·그루브박스·솔라라이즈드·고대비 + 시스템 설정 따라가기). 색은 `app/globals.css` 토큰, 공통 부품은 `components/ui.tsx`. **색을 코드에 직접 쓰지 않는다**(`text-black`, `bg-white`, `#hex` 금지) — 토큰(`bg-surface`, `text-muted`, `bg-stage`, `text-on-subject` 등)과 과목 색 `SUBJECT_COLOR`(=`var(--s-*)`)를 쓴다. 강조색 버튼 글자는 `text-bg`. 새 화면을 만들면 라이트·종이 테마에서도 스크린샷으로 확인한다. 테마를 추가하려면 `globals.css`의 `[data-theme="…"]`(토큰 전부)와 `lib/themes.ts` 목록을 같이 고친다. 테마는 기기 localStorage(`daego-theme`)에 저장, `<head>` 부팅 스크립트가 깜빡임을 막는다. 팔레트 출처: Nord·Catppuccin·Gruvbox·Solarized 공개 팔레트. 휴대폰 화면 기준(`max-w-md`), 한국어 존댓말(해요체) 문구.
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
- 문의함(`/me/inquiry`)·관리자 화면(`/me/admin`: 답변, 복구 코드 대신 발급)
- 비밀번호 찾기(`/login/reset`, 복구 코드)·복구 코드 만들기·비밀번호 바꾸기(`/me/security`), 홈에 "복구 코드 만들어 두세요" 안내(코드 없을 때만)
- 계정 삭제(`/me/delete`)
- 스터디그룹(`/groups`): 만들기·코드로 참여·공유, 그룹 안 이번 주 순위(과목별, 오늘 시간, 공부 중), 방장 설정(이름·코드 새로 만들기·내보내기·지우기), 나가기. 순위 화면 아래 "스터디그룹 순위 보기" 링크
- 칭호(`/me/titles`): 31개, 등급별 목록·진행도·대표 칭호 달기/떼기, 새 칭호 토스트. 순위·그룹 순위·내정보에 그림과 칭호 표시
- 프로필 사진(`/me/avatar`): 사진 올리기(320px로 줄임) 또는 그림 24개 × 색 8개, 대표 칭호 등급 테두리. 관리자 사진 검토(내리기·계정 삭제)
- 프린트 아카이브(`/prints`, 홈 카드·내정보): 관리자 업로드(여러 파일), 학년·분류·과목·검색 필터, 열기·내려받기. 로딩 화면에 Print Archive 로고
- 테마(`/me/theme`): 8개 + 시스템 설정, 미리보기 카드. APK에서는 Capacitor `SystemBars.setStyle`로 상태바 글자색도 바꾸려 시도(실기기 미확인)
- 홈 공지 배너(가짜 "간식 나눔" 등)는 사용자 요청으로 **삭제**함 (`EventBanner`, `lib/mock.ts`의 events)

**아직 가짜 / 준비 중** (`lib/mock.ts` 등)
- 워마 "오늘 복습할 단어 23개", 상자 5단계 분포, `/words/review`(상자 복습) — 가짜
- `/words/add`(직접 입력), `/words/scan`(사진 스캔) — 화면만
- 오프라인 기록 임시 저장 없음, 수행평가(반장 등록) 없음, 알림 없음

**확인된 상태 (2026-11-05, 공개 키로 실제 DB 확인)**
- 적용됨: 01·02(문의함 `reset_password_with_code`가 `"weak"`)·03(`my_groups` 있음). **아직 안 됨: 04(`my_titles` PGRST202), 05(`prints` PGRST205)** → 사용자에게 `04-titles.sql` → `05-storage.sql` 순서로 실행하라고 안내함. 다음 세션에서 위 방법으로 다시 확인.
- 실제 Supabase에 `schema.sql`(커밋 d2da6e1)이 끝까지 실행됨: `tasks`·`routines`·`ddays`·`planner_days`, `sessions.label`, 과제를 받는 새 `start_session` 모두 있음. (아래 줄로 대체: 조각별 확인)
- **커밋 "사진 프로필·프린트 아카이브" 이후 `schema.sql` 다시 실행 필요** (Storage 버킷 avatars·prints와 정책, prints 테이블, 관리자 함수). 확인: `GET /rest/v1/prints?select=id&limit=1` → `PGRST205`면 아직.
- **커밋 "칭호·프로필 그림" 이후 `schema.sql` 다시 실행 필요**. 확인: `POST /rest/v1/rpc/my_titles` → `PGRST202`면 아직. 실행 전에는 칭호 "준비 중", 그림 저장 시 "데이터베이스 업데이트가 필요해요".
- **커밋 "스터디그룹·테마" 이후에도 `schema.sql` 다시 실행 필요** (스터디그룹 테이블·함수). 확인: `POST /rest/v1/rpc/my_groups` → `PGRST202`면 아직.
- **커밋 "문의함·비밀번호 찾기·계정 삭제·보안 강화" 이후 `schema.sql`을 다시 실행해야 한다** — 사용자가 실행했는지 확인. 안 했으면 문의함·복구 코드·계정 삭제가 "준비 중"/"데이터베이스 업데이트가 필요해요"로 나온다. 확인: publishable 키로 `POST /rest/v1/rpc/reset_password_with_code` (빈 값들) → `PGRST202`면 아직, `"weak"`면 됨.
- 사용자에게 안내한 것(했는지 확인): 관리자 등록 SQL, 초대코드를 기본값 `DAEGO2026`에서 바꾸기(schema.sql에 기본값이 보임), Supabase Auth 최소 비밀번호 길이 8.
- GitHub 기본 브랜치는 아직 `claude/app-ui-design-nxs7yv` → 사용자에게 Settings → General → Default branch를 `main`으로 바꾸도록 안내함(바꿨는지 다음 세션에서 확인). Vercel은 이미 `main`을 배포.

**다음 할 일 후보** (사용자와 순서를 정할 것)
1. 친구들에게 초대코드를 주고 1주일 써 보게 하기 — 계획서 1단계 완료 기준
2. ① 공부 시간으로 성장하는 캐릭터 → 나중에 재화·스킨 상점 (그림 작업 필요, 계획서 6단계)
3. 워마 상자 5단계 복습을 실제 데이터로 (Supabase `reviews` 테이블, 퀴즈 점수도 계정에 저장)
4. NEIS 하루 1회 cron + `school_cache` (문서 6장)
5. 수행평가(반장 등록), 공지(이벤트 배너) 관리자 화면 — 사용자가 보류한 것 포함
6. 스터디그룹 다음 단계 후보: 그룹 목표 시간, 그룹 안 응원/콕 찌르기(알림 필요)

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
create table auth.users (id uuid primary key, email text, encrypted_password text, updated_at timestamptz);
create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users on delete cascade);
-- Storage 흉내 (사진·프린트 정책 시험용)
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner_id text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
create function storage.extension(name text) returns text language sql immutable as
  $$ select lower(reverse(split_part(reverse(name), '.', 1))) $$;
grant usage on schema storage to anon, authenticated;
grant all on storage.objects to anon, authenticated;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
```

- psql 파일은 postgres 사용자가 스크래치 폴더를 못 읽으니 `su postgres -c "psql …" < 파일`처럼 표준입력으로 넣는다. pgcrypto는 로컬에도 있다(schema.sql이 `extensions` 스키마에 만든다).
- 스키마 변경 시 업그레이드 경로: `git show <커밋>:supabase/schema.sql`로 예전 버전(97885ae 처음, b944369 디데이, 0f40384 플래너, d2da6e1 한국사·기타, 그 뒤는 `git log --oneline -- supabase/schema.sql`)을 꺼내 각각 올린 DB에 새 전체본을 2번 실행. **조각도** 시험: 사용자 DB와 같은 상태의 예전 버전에 바뀐 조각만 2번 실행, 새 DB에 01→05 순서로 실행 후 아무 조각이나 다시 실행.
- 칭호 테스트: 학생 여럿을 만들고 `insert into sessions (…, started_at, ended_at)`에 `'2026-11-02 23:30+09'`처럼 KST 시각을 직접 넣어 경계·소급·기타 제외·중복을 확인했다. 화면 테스트의 가짜 서버는 schema.sql의 `title_defs` insert 줄을 정규식으로 읽어 쓴다.
- Storage 화면 테스트: 가짜 서버가 `/storage/v1/object/<bucket>/<path>`(업로드, supabase-js는 multipart로 보내고 `cacheControl` 칸 다음에 파일 칸이 온다 → filename 있는 칸을 꺼낼 것), `/object/public/…`, `/object/sign/…`, DELETE를 흉내 낸다. Playwright `setInputFiles`에 한글·띄어쓰기 경로를 주면 조용히 실패 → `{ name, mimeType, buffer }`로 넘긴다.
- Next 16은 떠난 페이지를 숨긴 채 DOM에 남겨 둔다 → Playwright 선택자는 `:visible`이나 열린 dialog 안으로 범위를 좁힌다.

## 8. 구현하며 알게 된 함정

- Tailwind 클래스 충돌: 기본 클래스가 있는 부품에 같은 속성을 덮어쓰면 안 먹는다. `Card`는 `flush`(안쪽 여백 없음), `PrimaryButton`은 `tone`(accent/live/danger) 속성을 쓴다.
- `<form>` 안의 `<button>`은 기본이 submit — 선택 버튼(`Segmented` 등)은 `type="button"`.
- 렌더 중 `Date.now()`·`new Date()` 금지(빌드 프리렌더·린트 규칙). 브라우저에서만 정하고(`useEffect`/`setTimeout`/`useSyncExternalStore`), "오늘"이 필요한 API Route는 `await connection()` 후 계산.
- 린트 `react-hooks/set-state-in-effect`: effect 안에서 바로 setState 하지 말고 key로 다시 그리거나 콜백에서.
- 한국 날짜는 `lib/dday.ts`의 `kstToday()`, `lib/neis.ts`의 `kstYmd()`, `lib/study.ts`의 `kstDayStart()/kstWeekStart()`를 쓴다 (Vercel 서버는 UTC).
- Supabase 오류는 `lib/supabase.ts`의 `koreanError()`로 학생용 문장으로 바꿔 보여 준다.
