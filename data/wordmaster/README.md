# 워드마스터 수능 2000 · 퀴즈 데이터

대고 일품타의 **워마 퀴즈** 기능에 쓰는 단어 데이터입니다.
워드마스터 수능 2000의 DAY 1–50, 단어 2,000개와 단어당 예문 3개(총 6,000문장)가 들어 있습니다.

## 파일

| 파일 | 용도 |
|---|---|
| `wordmaster_2000.json` | 원본 데이터. 앱 코드에서 이 파일을 기준으로 쓴다 |
| `wordmaster_2000.csv` | 같은 내용을 표 한 장으로 펼친 것. 엑셀로 확인하거나 수정할 때 |
| `schema.sql` | Supabase 테이블 정의 (`wm_words`, `wm_sentences`) + 읽기 전용 RLS |
| `seed.py` | JSON을 Supabase에 적재하는 스크립트 |

## JSON 구조

```json
{
  "meta": { "word_count": 2000, "days": 50, "words_per_day": 40, ... },
  "words": [
    {
      "id": 1,
      "day": 1,
      "order": 1,
      "word": "provide",
      "meaning": "제공하다, 공급하다",
      "sentences": [
        {
          "level": "basic",
          "source": "textbook",
          "text": "The fossil record provides evidence of evolution.",
          "answer": "provides",
          "blanked": "The fossil record _____ evidence of evolution."
        },
        { "level": "applied",  "source": "original", ... },
        { "level": "advanced", "source": "original", ... }
      ]
    }
  ]
}
```

### 필드 규칙

- `id` — 1부터 2000까지 연속. DAY 순서대로 매겨져 있다.
- `day` — 1~50. 모든 DAY에 단어가 정확히 40개씩 있다.
- `order` — DAY 안에서의 순서(1~40). 교재 순서를 따르되, 일부 단어는 DAY 끝에 붙어 있어 교재와 순서가 다를 수 있다. DAY 소속은 정확하다.
- `word` — 표제어. 2,000개 모두 고유하다.
- `meaning` — 한국어 뜻. 품사가 다르면 `;`로 구분한다. 예: `"자원봉사; 자원하다"`.
- `sentences` — 항상 3개, 항상 `basic → applied → advanced` 순서.
  - `basic` — 교재 예문(`source: "textbook"`). 교재 예문이 없거나 잘린 63개 단어만 기본 난이도로 새로 썼다(`source: "original"`).
  - `applied` — basic과 비슷한 난이도로 새로 쓴 문장.
  - `advanced` — 수능 지문 수준으로 새로 쓴 문장.
- `answer` — 빈칸에 들어가는 **실제 형태**. 표제어 원형과 다를 수 있다 (`provides`, `developing`, `swept`, `crises` 등). 대소문자도 문장 그대로다(문장 첫 단어면 대문자).
- `blanked` — `text`에서 `answer` 자리를 `_____`(밑줄 5개)로 바꾼 문장. 빈칸은 문장마다 정확히 1개.

## 앱에서 쓸 때 주의할 점

- **채점은 대소문자를 무시**하고 `answer`와 비교한다. 문장 첫머리 빈칸은 정답이 대문자로 저장돼 있다.
- 학생이 원형(`provide`)을 쓰면 오답 처리할지, "형태 확인" 안내를 띄울지 정책을 정해야 한다. 원형 비교는 `word` 필드로 할 수 있다.
- 4지선다 오답 보기는 **같은 DAY의 다른 단어 `meaning`**에서 뽑으면 난이도가 맞는다.
- 문장 넣기 문제는 같은 DAY 단어 10개를 묶어 단어 상자로 보여 주고 그 10개의 문장을 섞으면, PDF 퀴즈북과 같은 형식이 된다.

## DB에 넣기 (Supabase)

1. Supabase 대시보드 → SQL Editor에서 `schema.sql` 실행
2. 개인 컴퓨터에서:
   ```bash
   pip install supabase
   export SUPABASE_URL="https://xxxx.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="서비스 롤 키"
   python seed.py
   ```
3. 결과: `wm_words` 2,000행, `wm_sentences` 6,000행

`seed.py`는 upsert라 여러 번 실행해도 중복이 생기지 않는다. 서비스 롤 키는 RLS를 우회하므로 절대 커밋하거나 클라이언트 코드에 넣지 않는다.

## DB 없이 쓸 때

초기 개발 단계에서는 `wordmaster_2000.json`을 프로젝트의 `public/` 또는 `data/` 폴더에 넣고 그대로 import해도 된다(약 1.9MB). DAY별로 나눠 불러오려면 `words.filter(w => w.day === n)`.

## 검증 내역

- DAY 1–50 각 40개, 총 2,000개 — 교재의 DAY별 "Previous Check" 목록과 대조
- 6,000문장 전부 빈칸 1개 생성 확인, 정답이 표제어의 변화형인지 확인
- 교재 예문은 스캔본 OCR에서 추출 후 띄어쓰기 오류(`atta in` → `attain`)와 출처 표기(`23 모평`)를 제거했다. 원문과 한두 글자 다를 가능성이 있으면 교재로 확인한다.
