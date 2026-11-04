# NEIS 교육정보 개방 포털 Open API 명세 (대고 일품타용)

공식 안내 페이지(open.neis.go.kr)는 요청 형식과 예제를 이미지로만 제공하므로, 개발에 필요한 내용을 이 문서에 텍스트로 정리했다. **NEIS 관련 코드를 작성할 때는 이 문서를 기준으로 한다.**

## 1. 인증키

- 키는 `.env.local`의 `NEIS_API_KEY`에 있다. 코드에 직접 쓰지 않는다.
- **서버에서만 호출한다** (Next.js Route Handler, Server Action, cron). 클라이언트 컴포넌트에서 `process.env.NEIS_API_KEY`를 쓰지 않는다. `NEXT_PUBLIC_` 접두사도 붙이지 않는다.
- 키 없이 호출하면 샘플 모드: `pIndex=1`, `pSize=5`로 고정되어 최대 5건만 온다. 결과가 항상 5건 이하라면 키가 안 들어간 것이다.

## 2. 요청 형식

```
GET https://open.neis.go.kr/hub/{서비스명}?KEY={키}&Type=json&pIndex=1&pSize=100&{서비스별 인자}
```

| 공통 인자 | 필수 | 설명 |
|---|---|---|
| `KEY` | O | 인증키 |
| `Type` | O | `json`으로 고정해서 쓴다 (기본값은 xml) |
| `pIndex` | O | 페이지 번호, 1부터 |
| `pSize` | O | 페이지당 건수. **최대 1000** |

- 파라미터 이름은 **대문자 그대로** 쓴다 (`KEY`, `Type`, `ATPT_OFCDC_SC_CODE` …).
- 날짜는 전부 `YYYYMMDD` 문자열 (예: `20261105`). 하이픈 없음.
- 한글 파라미터(학교명)는 URL 인코딩한다 (`URLSearchParams` 사용).

## 3. 학교 식별 코드

모든 학교 데이터 요청에 두 코드가 필요하다.

| 인자 | 값 |
|---|---|
| `ATPT_OFCDC_SC_CODE` (시도교육청코드) | 대전광역시교육청 = **`G10`** |
| `SD_SCHUL_CODE` (표준학교코드) | `.env.local`의 `NEIS_SCHOOL_CODE`. 모르면 아래 schoolInfo로 조회 |

## 4. 사용할 서비스

### 4-1. 학교기본정보 `schoolInfo` — 학교코드 찾기 (최초 1회)

| 인자 | 설명 |
|---|---|
| `ATPT_OFCDC_SC_CODE` | `G10` |
| `SCHUL_NM` | `대전고등학교` (부분 일치 검색) |

주요 응답 필드: `SD_SCHUL_CODE`(학교코드), `SCHUL_NM`, `SCHUL_KND_SC_NM`(학교 종류), `ORG_RDNMA`(도로명주소), `HMPG_ADRES`(홈페이지).
"대전고등학교"로 검색하면 이름이 비슷한 다른 학교가 함께 나올 수 있으니 `SCHUL_NM`이 정확히 일치하는 행을 고른다.

### 4-2. 급식식단정보 `mealServiceDietInfo`

| 인자 | 필수 | 설명 |
|---|---|---|
| `ATPT_OFCDC_SC_CODE` | O | `G10` |
| `SD_SCHUL_CODE` | O | 학교코드 |
| `MMEAL_SC_CODE` | | `1` 조식, `2` 중식, `3` 석식 |
| `MLSV_YMD` | | 특정 날짜 하루 |
| `MLSV_FROM_YMD` / `MLSV_TO_YMD` | | 기간 조회 (한 달치 받을 때 사용) |

주요 응답 필드:

| 필드 | 내용 |
|---|---|
| `MLSV_YMD` | 급식 날짜 `YYYYMMDD` |
| `MMEAL_SC_CODE` / `MMEAL_SC_NM` | `2` / `중식` |
| `DDISH_NM` | 메뉴. **아래 정제 필요** |
| `CAL_INFO` | 열량, 예: `812.3 Kcal` |
| `NTR_INFO` | 영양 정보 (`<br/>` 구분) |
| `ORPLC_INFO` | 원산지 (`<br/>` 구분) |

`DDISH_NM` 원본 예: `"현미밥<br/>된장찌개 (5.6.13.)<br/>제육볶음 (5.6.10.13.)"`
- 메뉴 구분자는 `<br/>` → `split(/<br\s*\/?>/i)`
- 각 메뉴 뒤 괄호 숫자는 알레르기 유발 식품 번호 → 메뉴명과 분리해서 저장
- 메뉴명 끝에 `*`, `#`, `ⓢ` 같은 표시가 붙는 학교가 있으니 끝 기호는 제거

알레르기 번호: 1 난류, 2 우유, 3 메밀, 4 땅콩, 5 대두, 6 밀, 7 고등어, 8 게, 9 새우, 10 돼지고기, 11 복숭아, 12 토마토, 13 아황산류, 14 호두, 15 닭고기, 16 쇠고기, 17 오징어, 18 조개류(굴·전복·홍합 포함), 19 잣

### 4-3. 학사일정 `SchoolSchedule`

| 인자 | 필수 | 설명 |
|---|---|---|
| `ATPT_OFCDC_SC_CODE` | O | `G10` |
| `SD_SCHUL_CODE` | O | 학교코드 |
| `AA_YMD` | | 특정 날짜 |
| `AA_FROM_YMD` / `AA_TO_YMD` | | 기간 조회 |

주요 응답 필드: `AA_YMD`(날짜), `EVENT_NM`(행사명), `EVENT_CNTNT`(내용), `SBTR_DD_SC_NM`(수업공제일명: `휴업일`, `공휴일`, `해당없음` 등), `ONE_GRADE_EVENT_YN` / `TW_GRADE_EVENT_YN` / `THREE_GRADE_EVENT_YN`(학년별 해당 여부 `Y`/`N`).

같은 날짜에 행사가 여러 개 올 수 있다. 날짜를 키로 덮어쓰지 말고 배열로 모은다.

### 4-4. (나중에) 고등학교 시간표 `hisTimetable`

인자: `ATPT_OFCDC_SC_CODE`, `SD_SCHUL_CODE`, `AY`(학년도), `SEM`(학기), `GRADE`, `CLASS_NM`, `TI_FROM_YMD`, `TI_TO_YMD`. 응답: `ALL_TI_YMD`, `PERIO`(교시), `ITRT_CNTNT`(과목명). 현재 범위 밖이므로 구현하지 않는다.

## 5. 응답 구조 (Type=json)

**성공** — 최상위 키가 서비스명이고, 배열 첫 원소에 `head`, 둘째 원소에 `row`가 있다.

```json
{
  "mealServiceDietInfo": [
    { "head": [
        { "list_total_count": 22 },
        { "RESULT": { "CODE": "INFO-000", "MESSAGE": "정상 처리되었습니다." } }
    ]},
    { "row": [ { "MLSV_YMD": "20261105", "DDISH_NM": "...", "...": "..." } ] }
  ]
}
```

**데이터 없음 / 오류** — 서비스명 키 없이 `RESULT`만 온다. **HTTP 상태는 200이다.** `res.ok`만 보고 성공으로 판단하지 않는다.

```json
{ "RESULT": { "CODE": "INFO-200", "MESSAGE": "해당하는 데이터가 없습니다." } }
```

| 코드 | 의미 | 처리 |
|---|---|---|
| `INFO-000` | 정상 | — |
| `INFO-200` | 데이터 없음 (방학, 주말, 아직 미등록) | **오류가 아님.** 빈 배열로 처리 |
| `INFO-300` | 관리자에 의해 키 사용 제한 | 로그 남기고 중단 |
| `ERROR-290` | 인증키가 유효하지 않음 | 키 확인 |
| `ERROR-300` | 필수 값 누락 | 파라미터 확인 |
| `ERROR-310` | 서비스명 없음 | URL 오타 확인 |
| `ERROR-336` | pSize 1000 초과 | 페이지 분할 |
| `ERROR-337` | 일일 트래픽 초과 | 다음 날 재시도 |
| `ERROR-500` / `600` / `601` | NEIS 서버 오류 | 잠시 후 재시도 |

**파싱 규칙:** `data[서비스명]`이 있으면 `head[1].RESULT.CODE`와 `[1].row`를, 없으면 `data.RESULT.CODE`를 본다. `INFO-200`은 빈 결과, `INFO-000`이 아닌 나머지는 예외를 던진다.

전체 건수(`list_total_count`)가 `pSize`보다 크면 `pIndex`를 올려 반복 요청한다.

## 6. 앱 설계 규칙 (계획서 6.5 그대로)

- 학생 요청마다 NEIS를 부르지 않는다. **하루 1회 예약 작업**(Vercel Cron)으로 이번 달 1일 ~ 다음 달 말일 급식·학사일정을 받아 Supabase `school_cache`에 upsert한다. 앱은 DB만 읽는다.
- **날짜는 한국 시간 기준으로 계산한다.** Vercel 서버는 UTC라서 `new Date()`를 그대로 쓰면 오전 9시 전에는 하루 전 날짜가 된다.

```ts
// KST 기준 YYYYMMDD
export function kstYmd(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(d).replaceAll('-', '');
}
```

## 7. 참고용 요청 예시

```
https://open.neis.go.kr/hub/schoolInfo?KEY=...&Type=json&pIndex=1&pSize=10&ATPT_OFCDC_SC_CODE=G10&SCHUL_NM=대전고등학교
https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=...&Type=json&pIndex=1&pSize=100&ATPT_OFCDC_SC_CODE=G10&SD_SCHUL_CODE=XXXXXXX&MLSV_FROM_YMD=20261101&MLSV_TO_YMD=20261130
https://open.neis.go.kr/hub/SchoolSchedule?KEY=...&Type=json&pIndex=1&pSize=100&ATPT_OFCDC_SC_CODE=G10&SD_SCHUL_CODE=XXXXXXX&AA_FROM_YMD=20260301&AA_TO_YMD=20270228
```

실제 응답 형식이 이 문서와 다르면, `scripts/test-neis.mjs`를 실행해 받은 실제 JSON을 기준으로 코드를 맞추고 이 문서를 수정한다.
