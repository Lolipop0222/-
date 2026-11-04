# 대고 일품타

야간자습 시간을 기록하고, 겨루고, 그 사이에 단어를 외우는 대전고 학습 웹앱 (PWA).

## 지금 상태 — UI 단계

모든 화면을 **가짜 데이터(`lib/mock.ts`)** 로 먼저 디자인했다. 아직 서버·로그인은 연결되어 있지 않다.

| 탭 | 경로 | 화면 |
| --- | --- | --- |
| 홈 | `/` | 오늘 급식 한 줄, 공지 배너, 오늘 공부 시간, 이번 주 합계, 전교 순위, 오늘 복습할 단어, 스터디그룹, 수행평가 |
| 일품타 | `/timer` | 과목 선택 → 시작/정지 타이머(검정 배경·큰 숫자), 이탈 감지, 주간 순위(전교/학년/반/그룹, 내 순위 ±3명) |
| 워마 | `/words` | 오늘 복습, 워드마스터 수능 2000 DAY 1–50 (DAY별 최고 점수), 상자 5단계 분포 |
| | `/words/day/[1-50]` | 워마 퀴즈: 뜻 고르기(4지선다) / 빈칸 채우기(단어 상자 10개, 기본·응용·심화), 결과·틀린 것만 다시 |
| | `/words/review` | 4지선다 복습 퀴즈 + 결과 |
| | `/words/add` | 손으로 단어 입력 |
| | `/words/scan` | 사진 스캔 → 인식 결과 확인·수정 |
| 캘린더 | `/calendar` | 월 달력, 날짜별 급식(NEIS)·학사일정(NEIS)·수행평가 |
| 내정보 | `/me` | 프로필·아바타·포인트, 스터디그룹(초대코드), 설정, 개인정보 처리방침(`/me/privacy`) |
| | `/login` | 이메일 + 가입 초대코드 |

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

## 파일 구조

- `app/` — 화면(페이지)들. 폴더 이름이 곧 주소
- `components/` — 여러 화면에서 같이 쓰는 조각 (하단 탭, 카드, 타이머, 순위표 등)
- `components/ui.tsx` — 공통 디자인 부품. 새 화면도 이걸로 만든다
- `app/globals.css` — 색상 규칙(디자인 토큰). 색은 여기서만 정한다
- `lib/mock.ts` — 가짜 데이터. 계획서 3장 테이블 구조와 같은 모양
- `lib/neis.ts` — NEIS 급식 조회 (서버 전용, 몇 시간씩 캐시)
- `app/api/meals/[month]/route.ts` — 한 달 급식 API (`/api/meals/202611`)
- `lib/meals.ts` — 2026년 11월 식단표 (NEIS가 안 될 때 대신 씀)
- `app/api/schedule/[month]/route.ts` — 한 달 학사일정 API (NEIS, 토요휴업일 제외)
- `data/wordmaster/` — 워드마스터 수능 2000 원본 데이터와 설명(README, Supabase 스키마·적재 스크립트)
- `public/wordmaster/day-NN.json` — 위 데이터를 DAY별로 나눈 것. 원본을 고치면 `npm run wordmaster`
- `lib/wordmaster.ts`, `components/WordQuiz.tsx` — 워마 퀴즈 문제 만들기·화면
- `lib/format.ts` — 시간·날짜 표시 함수

## 다음 단계 (계획서 5장)

- **0단계** — Supabase 연결, 이메일 로그인, 테이블 + RLS 생성, Vercel 배포
- **1단계** — 타이머를 서버 시각(`started_at`/`ended_at`) 기준으로 저장, 순위를 실제 데이터로
