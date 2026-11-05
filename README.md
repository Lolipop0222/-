# 대고 일품타

야간자습 시간을 기록하고, 겨루고, 그 사이에 단어를 외우는 대전고 학습 웹앱 (PWA).

## 지금 상태

- **진짜로 동작**: 로그인·가입(초대코드), 공부 타이머(서버 시각 기록), 오늘·이번 주 과목별 공부 시간, 과목별 주간 순위, 급식·학사일정(NEIS), 디데이, 플래너·데일리 루틴(과제 ↔ 타이머 연결), 워마 퀴즈(문제당 제한 시간 옵션), 문의함, 비밀번호 찾기(복구 코드), 계정 삭제, 스터디그룹(초대코드), 테마 8개(라이트·종이 질감 등), 칭호 31개(서버 판정)·사진 프로필, 프린트 아카이브(관리자 업로드)
- **아직 가짜(`lib/mock.ts`)**: 워마 복습(상자 5단계)·직접 입력·스캔

| 탭 | 경로 | 화면 |
| --- | --- | --- |
| 홈 | `/` | 오늘 급식 한 줄, 가장 가까운 디데이 2개, 복구 코드가 없으면 만들라는 안내, 오늘 공부 시간(과목별), 이번 주 합계, 전교 순위, 오늘 복습할 단어 |
| | `/dday` | 디데이: 학교 시험(NEIS에서 내 학년 것만 자동) + 직접 추가·삭제, 지난 디데이 |
| | `/planner` | 플래너(종이 플래너 양식): 날짜·D-DAY·COMMENT·TOTAL TIME, TASKS(과목은 직접 고름, ▶로 그 과목 타이머), 10분 단위 TIMETABLE(공부 기록으로 자동 색칠), MEMO |
| | `/planner/routines` | 데일리 루틴: 요일마다 반복되는 과제를 한 번만 등록 → 그날 플래너에 자동으로 들어감 |
| 일품타 | `/timer` | 과목(국어·영어·수학·과학·사회·한국사·인강 + 기타) 선택 → 시작/정지, 30초 이탈 시 자동 정지, 플래너 과제 연결, 오늘 과목별 시간, 주간 순위(전교/학년/반 × 과목, 내 순위 ±3명) |
| | `/timer/etc` | 기타 기록: 순위·공부 합계에 안 들어가는 나만의 타이머 기록. 이름·시간을 직접 고치기·추가·삭제 |
| 워마 | `/words` | 오늘 복습, 워드마스터 수능 2000 DAY 1–50 (DAY별 최고 점수), 상자 5단계 분포 |
| | `/words/day/[1-50]` | 워마 퀴즈: 뜻 고르기(4지선다) / 빈칸 채우기(단어 상자 10개, 기본·응용·심화), 결과·틀린 것만 다시 |
| | `/words/review` | 4지선다 복습 퀴즈 + 결과 |
| | `/words/add` | 손으로 단어 입력 |
| | `/words/scan` | 사진 스캔 → 인식 결과 확인·수정 |
| 캘린더 | `/calendar` | 월 달력, 날짜별 급식·학사일정 (NEIS) |
| 내정보 | `/me` | 닉네임·학년·반, 오늘/이번 주/최다 과목, 로그아웃, 개인정보 처리방침(`/me/privacy`) |
| | `/groups` | 스터디그룹: 내 그룹 목록, 만들기(6자리 초대코드), 코드로 참여, 그룹 안 이번 주 순위(과목별·오늘·공부 중), 방장 설정, 나가기 |
| | `/me/theme` | 테마: 기본 다크·라이트·종이·노드·모카·그루브박스·솔라라이즈드·고대비 + 시스템 설정 따라가기 (미리보기, 기기에 저장) |
| | `/me/titles` | 칭호: 일반·희귀·영웅·전설·히든 등급별 목록, 못 얻은 칭호의 조건·진행도(예 37/100시간), 히든은 얻기 전 ???, 대표 칭호 달기·떼기 |
| | `/me/avatar` | 프로필 사진: 사진 올리기(320px로 줄이고 사진 정보 제거) 또는 그림 24개 × 색 8개, 대표 칭호 등급 색 테두리 |
| | `/prints` | 프린트 아카이브: 수행평가 자료·학습지 (내 학년·분류·과목·검색), 눌러서 열기·내려받기. 관리자는 "올리기"로 여러 파일을 한 번에, 지우기 |
| | `/me/inquiry` | 문의함: 관리자에게 질문·오류 신고·제안 보내기(하루 5개), 답변 보기, 내 문의 지우기 |
| | `/me/security` | 비밀번호 복구 코드 만들기(한 번만 보여 줌), 비밀번호 바꾸기(지금 비밀번호 확인) |
| | `/me/delete` | 계정 삭제: 비밀번호 + 닉네임 입력 → 계정과 모든 기록 즉시 삭제 |
| | `/me/admin` | 관리자만: 사진 프로필 검토(내리기·계정 삭제), 닉네임으로 계정 삭제, 문의 답변, 복구 코드 대신 만들기, 프린트 아카이브 바로 가기 |
| | `/login` | 이메일·비밀번호 로그인 / 가입(닉네임·학년·반·초대코드). 로그인하지 않으면 이 화면으로 온다 |
| | `/login/reset` | 비밀번호 찾기: 이메일 + 복구 코드 → 새 비밀번호 |

## 실행

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 — 휴대폰 화면 기준(개발자 도구의 모바일 보기)으로 확인한다.

## 환경변수 (키)

키는 **코드에 넣지 않는다.** `.env.example`을 참고해서

- 내 컴퓨터: `.env.local` 파일에 `NEIS_API_KEY=발급받은키`
- 배포: Vercel → 프로젝트 → Settings → Environment Variables 에 `NEIS_API_KEY` 추가 후 다시 배포

키가 없거나 NEIS가 응답하지 않으면 급식은 `lib/meals.ts`(학교 식단표 파일을 옮긴 것)로 대신 보여준다.
캘린더 급식 카드 오른쪽 위에 지금 데이터가 어디서 왔는지(NEIS / 학교 식단표 파일) 작게 표시된다.

## Supabase (로그인 · 공부 기록 · 순위)

1. supabase.com에서 프로젝트 생성 — 지역은 **Northeast Asia (Seoul)**
2. SQL Editor에 `supabase/schema.sql`을 통째로 붙여넣고 Run (여러 번 실행해도 된다)
3. 초대코드 바꾸기: `update app_settings set value = '새코드' where key = 'invite_code';`
4. Authentication → Sign In / Providers → Email: **Confirm email 끄기** (무료 메일 발송 한도가 시간당 몇 통뿐이라)
5. Project Settings → API의 Project URL과 publishable(anon) 키를 `.env.local`과 Vercel 환경변수에 넣는다 (`.env.example` 참고)
6. 관리자 등록 (문의 답변·복구 코드 발급·사진 검토·계정 삭제·프린트 올리기용, 내 닉네임으로):
   `insert into admins (user_id) select id from profiles where nickname = '내닉네임' on conflict do nothing;`
7. 보안 설정: Authentication → Sign In / Providers → Email → **Minimum password length 8** 권장. 초대코드는 기본값(`DAEGO2026`)에서 꼭 바꾼다

**비밀번호 찾기**: 메일 인증을 꺼 둬서 메일로 재설정할 수 없다. 대신 학생이 내정보에서 **복구 코드**(12자리, 해시로만 저장, 한 번 쓰면 없어짐)를
만들어 두고, 잊으면 `/login/reset`에서 이메일 + 코드로 새 비밀번호를 정한다(15분에 5번 틀리면 잠김). 코드도 잃어버리면 관리자가 `/me/admin`에서
닉네임으로 새 코드를 만들어 직접 전해 준다.

공부 시간은 클라이언트가 숫자를 보내지 않는다. `start_session` / `end_session` 함수가 서버 시각으로 기록하고,
순위는 `get_ranking(범위, 과목)` 함수가 닉네임·학년·반·합계만 돌려준다. 과목을 바꾸면 `lib/subjects.ts`와
`schema.sql`의 과목 목록(`sessions_subject_check`, `tasks_subject_check`, `routines_subject_check`)을 같이 고친다.
'기타' 기록은 순위·공부 합계에 들어가지 않으므로 RLS로 본인이 직접 추가·수정·삭제할 수 있다.

**칭호**: 판정은 모두 서버(`check_titles()`)가 한다. 공부 시간은 순위와 같은 기준(기타 제외, 한 기록 4시간까지), 날짜·시각은 한국 시간.
얻은 칭호는 영구 보관되고 여러 번 판정해도 중복으로 생기지 않는다. 예약 작업이 없어서 앱 열기·공부 종료·과제 완료·내정보 열기 때 판정한다.
주간 순위 칭호는 끝난 주(월 0시~일 24시)를 보고, 그 주 5시간 이상 + 그 범위에 기록 있는 학생 3명 이상일 때 1위(공동 포함)에게 준다.
칭호를 더하려면 `schema.sql`의 `title_defs` insert에 한 줄 추가(새 조건이면 `title_stats()`에 값 추가) 후 schema.sql을 다시 실행한다.

## 안드로이드 앱 (APK)

APK는 **배포된 웹 주소를 여는 안드로이드 앱**이다 (Capacitor). 화면과 기능은 웹과 같고, 웹을 다시 배포하면 앱도 바로 바뀐다.
NEIS 키 같은 비밀은 앱에 들어가지 않고 서버(Vercel)에만 있다.

```bash
npm run apk -- https://배포주소.vercel.app
# → dist/daego-ilpumta.apk
```

- 필요: JDK 21, Android SDK (`ANDROID_HOME` 환경변수). Android Studio를 설치하면 둘 다 생긴다
- 디버그 서명 APK라 친구 테스트용이다. 휴대폰에서 "출처를 알 수 없는 앱 설치"를 허용해야 깔린다. 플레이스토어 등록은 별도 서명 키가 필요하다
- 앱 아이콘·스플래시는 `android/app/src/main/res/`, 인터넷이 안 될 때 화면은 `android-shell/`

## 파일 구조

- `app/` — 화면(페이지)들. 폴더 이름이 곧 주소
- `components/` — 여러 화면에서 같이 쓰는 조각 (하단 탭, 카드, 타이머, 순위표 등)
- `components/ui.tsx` — 공통 디자인 부품. 새 화면도 이걸로 만든다
- `app/globals.css` — 색상 규칙(디자인 토큰). 색은 여기서만 정한다
- `lib/subjects.ts` — 과목 분류 (순위에 들어가는 7과목 + 순위 제외 기타)와 색
- `supabase/schema.sql` — DB 테이블·RLS·함수
- `lib/supabase.ts`, `components/AuthProvider.tsx` — Supabase 연결과 로그인 상태(로그인 안 하면 /login으로)
- `lib/study.ts`, `components/StudyProvider.tsx` — 공부 기록 시작·정지·합계·순위 (타이머·홈·순위가 같이 씀)
- `lib/photos.ts`, `lib/prints.ts`, `app/prints/page.tsx` — 사진 프로필(줄이기·올리기)과 프린트 아카이브 (Supabase Storage `avatars`·`prints`)
- `components/PrintArchiveLogo.tsx`, `public/print-archive/` — Print Archive 로고 (테마 색으로 칠하는 마스크 두 장)
- `lib/titles.ts`, `components/TitleBadge.tsx`, `components/TitlesProvider.tsx` — 칭호(판정 호출·알림·배지)와 프로필 그림. 칭호 정의·판정은 `schema.sql`의 `title_defs`·`title_stats()`·`check_titles()`
- `lib/groups.ts`, `app/groups/page.tsx` — 스터디그룹 (DB 함수 호출, 화면)
- `lib/themes.ts`, `components/ThemeProvider.tsx` — 테마 목록·저장·적용. 색 값은 `app/globals.css`의 `[data-theme]`
- `lib/account.ts` — 문의함·복구 코드·비밀번호 찾기·계정 삭제·관리자 함수 호출
- `next.config.ts` — 보안 헤더(CSP, iframe 금지 등)
- `lib/mock.ts` — 가짜 데이터. 계획서 3장 테이블 구조와 같은 모양
- `docs/NEIS_API.md` — NEIS API 명세. NEIS 코드는 이 문서를 기준으로 쓴다
- `scripts/test-neis.mjs` — 인증키·학교코드 확인용 (`node scripts/test-neis.mjs`)
- `lib/neis.ts` — NEIS 급식·학사일정 조회 (서버 전용, 페이지 반복·오류 코드 처리, 몇 시간씩 캐시)
- `app/api/meals/[month]/route.ts` — 한 달 급식 API (`/api/meals/202611`)
- `lib/meals.ts` — 2026년 11월 식단표 (NEIS가 안 될 때 대신 씀)
- `app/api/schedule/[month]/route.ts` — 한 달 학사일정 API (NEIS, 토요휴업일 제외)
- `app/api/exams/route.ts` — 앞으로 6개월 시험 목록 (학사일정에서 고사·학력평가·수능을 찾아 묶음)
- `lib/dday.ts`, `lib/useDdays.ts` — 디데이 계산과 직접 만든 디데이 저장(Supabase `ddays` 테이블)
- `lib/planner.ts`, `lib/usePlanner.ts` — 플래너 과제·루틴·코멘트/메모 저장, 과제별 시간, TIMETABLE 칸 계산
- `data/wordmaster/` — 워드마스터 수능 2000 원본 데이터와 설명(README, Supabase 스키마·적재 스크립트)
- `public/wordmaster/day-NN.json` — 위 데이터를 DAY별로 나눈 것. 원본을 고치면 `npm run wordmaster`
- `lib/wordmaster.ts`, `components/WordQuiz.tsx` — 워마 퀴즈 문제 만들기·화면
- `lib/format.ts` — 시간·날짜 표시 함수

## 다음 단계 (계획서 5장)

- **0단계** — Supabase 연결, 이메일 로그인, 테이블 + RLS 생성, Vercel 배포
- **1단계** — 타이머를 서버 시각(`started_at`/`ended_at`) 기준으로 저장, 순위를 실제 데이터로
