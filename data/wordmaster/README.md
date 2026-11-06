# 워드마스터 수능 2000 · 학습 데이터 (v2)

대고 일품타의 **워마 퀴즈**와 **단어 암기** 기능에 쓰는 데이터입니다.
워드마스터 수능 2000의 DAY 1–50, 단어 2,000개가 들어 있습니다.

| 항목 | 개수 |
|---|---|
| 단어 | 2,000 (DAY마다 40개) |
| 예문 (단어당 3개, 해석 포함) | 6,000 |
| 유의어·반의어·파생어·숙어 | 11,130 |
| 어원 풀이 (교재에 있는 단어만) | 191 |

v1과 달라진 점은 아래 "v1 → v2 변경"에 정리했습니다.

## 파일

| 파일 | 용도 |
|---|---|
| `wordmaster_2000.json` | 원본 데이터. 앱 코드는 이 파일을 기준으로 쓴다 |
| `wordmaster_2000.csv` | 단어 한 개가 한 행. 엑셀로 확인하거나 수정할 때 쓴다 |
| `wordmaster_relations.csv` | 관련어 한 개가 한 행. 유의어·반의어·파생어·숙어를 표로 볼 때 쓴다 |
| `schema.sql` | Supabase 테이블 정의(`wm_words`, `wm_sentences`, `wm_relations`)와 읽기 전용 RLS |
| `seed.py` | JSON을 Supabase에 적재하는 스크립트 |

CSV는 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM으로 저장했습니다.

## JSON 구조

```json
{
  "meta": { "version": "2.0", "word_count": 2000, ... },
  "words": [
    {
      "id": 16, "day": 16, "order": 40, "word": "prevail",
      "meaning": "우세하다, 널리 퍼지다",
      "sentences": [
        {
          "level": "basic", "source": "textbook",
          "text": "Sometimes truth will win, but other times falsehood will prevail.",
          "translation": "때로는 진실이 이기겠지만, 다른 때에는 거짓이 우세할 것이다.",
          "answer": "prevail",
          "blanked": "Sometimes truth will win, but other times falsehood will _____."
        },
        { "level": "applied",  "source": "original", ... },
        { "level": "advanced", "source": "original", ... }
      ],
      "synonyms":    [ { "text": "be widespread", "source": "textbook" },
                       { "text": "triumph",       "source": "original" } ],
      "antonyms":    [ { "text": "fail", "source": "original" } ],
      "derivatives": [ { "text": "prevalent", "meaning": "널리 퍼진", "source": "textbook" } ],
      "phrases":     [ { "text": "prevail over", "meaning": "~을 이기다", "source": "original" } ],
      "etymology":   { "text": "pre(= before) + vail(= strong) → '힘에서 앞서는'에서 '우세하다'가 되었다.",
                       "source": "textbook" }
    }
  ]
}
```

(위 예시의 `id`·`order` 값은 설명용입니다.)

### 필드 규칙

- `id`: 1부터 2000까지 연속이고, DAY 순서대로 매겨져 있다.
- `day`: 1~50. 모든 DAY에 단어가 정확히 40개씩 있다.
- `order`: DAY 안에서의 순서(1~40)이다.
- `word`: 표제어. 2,000개 모두 서로 다르다.
- `meaning`: 한국어 뜻. 품사가 다르면 `;`로 구분한다.
- `sentences`: 항상 3개이고, 항상 `basic → applied → advanced` 순서다.
  - `basic`: 교재 예문(`source: "textbook"`)이다. 교재에 예문이 없거나 OCR로 복원할 수 없을 만큼 깨진 64개 단어만 새로 썼다(`source: "original"`).
  - `applied`: basic과 비슷한 난이도로 새로 쓴 문장이다.
  - `advanced`: 수능 지문 수준으로 새로 쓴 문장이다.
  - `translation`: 문장의 한국어 해석이다. 3문장 모두 있다.
  - `answer`: 빈칸에 들어가는 실제 형태다(`provides`, `swept`, `crises` 등). 문장 첫 단어면 대문자로 저장되어 있다.
  - `blanked`: `answer` 자리를 `_____`(밑줄 5개)로 바꾼 문장이다. 빈칸은 문장마다 정확히 1개다.
- `synonyms`, `antonyms`: `[{text, source}]` 형태다. 비어 있을 수 있다(반의어가 자연스럽지 않은 단어 등).
- `derivatives`: 파생어. `[{text, meaning, source}]` 형태다.
- `phrases`: 숙어와 연어. `[{text, meaning, source}]` 형태다. `A`, `B`, `V-ing`는 자리 표시다(`deprive A of B`). 일부 `meaning`에는 혼동하기 쉬운 단어 안내가 괄호로 붙어 있다.
- `etymology`: 교재에 어원 풀이가 있는 191개 단어만 `{text, source: "textbook"}`이고, 나머지는 `null`이다.

### `source` 값의 뜻

| 값 | 뜻 |
|---|---|
| `textbook` | 교재에 실린 내용이다 |
| `original` | 교재에 없는 빈 곳을 새로 보충했다 |

관련어의 `source`는 그 표현이 교재의 해당 단어 설명 부분에 실제로 나오는지를 자동으로 대조해 매겼다. 앱에서 "교재" 배지를 따로 보여 주거나, 시험 대비 모드에서 교재 항목만 걸러 낼 때 쓰면 된다.

## 앱에서 쓸 때

**퀴즈**

- 채점은 대소문자를 무시하고 `answer`와 비교한다.
- 학생이 원형(`provide`)을 쓰면 오답 처리할지 "형태 확인" 안내를 띄울지 정해야 한다. 원형 비교는 `word` 필드로 하면 된다.
- 4지선다 오답 보기는 같은 DAY의 다른 단어 `meaning`에서 뽑으면 난이도가 맞는다.
- 문장 넣기 문제는 같은 DAY 단어 10개를 단어 상자로 보여 주고 그 10개의 문장을 섞으면 PDF 퀴즈북과 같은 형식이 된다.

**암기 카드 (구성 예시)**

- 앞면: `word`
- 뒷면 1단: `meaning`, `etymology`(있을 때만)
- 뒷면 2단: `sentences[0].text`와 `translation`. 표제어 부분은 `answer`로 찾아 굵게 표시한다.
- 뒷면 3단: 유의어·반의어를 칩으로, 파생어·숙어를 "표현 + 뜻" 목록으로 보여 준다.
- 복습 일정(에빙하우스)에 맞춰 다시 나올 때는 `applied`, `advanced` 예문으로 바꿔 보여 주면 같은 문장만 외우는 것을 막을 수 있다.

**추가 퀴즈 유형**

- 유의어·반의어 고르기: 정답은 `synonyms`/`antonyms`에서, 오답은 같은 DAY 다른 단어의 관련어에서 뽑는다.
- 숙어 빈칸: `phrases[].text`에서 표제어 자리를 비우고 `meaning`을 힌트로 준다.
- 해석 보고 문장 고르기: `translation`을 보여 주고 같은 DAY 문장 4개 중에서 고르게 한다.

## DB에 넣기 (Supabase)

1. Supabase 대시보드 → SQL Editor에서 `schema.sql`을 실행한다. v1 테이블이 이미 있으면 맨 아래 "v1 → v2 변경" 두 줄도 함께 실행된다.
2. 개인 컴퓨터에서 아래를 실행한다.
   ```bash
   pip install supabase
   export SUPABASE_URL="https://xxxx.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="서비스 롤 키"
   python seed.py
   ```
3. 결과는 `wm_words` 2,000행, `wm_sentences` 6,000행, `wm_relations` 11,130행이다.

`seed.py`는 upsert라서 여러 번 실행해도 중복이 생기지 않는다. 서비스 롤 키는 RLS를 우회하므로 절대 커밋하거나 클라이언트 코드에 넣지 않는다.

## DB 없이 쓸 때

초기 개발 단계에서는 `wordmaster_2000.json`(약 3.5MB)을 프로젝트의 `data/` 폴더에 넣고 그대로 import해도 된다. 첫 화면 로딩이 느리면 DAY별로 나눠 `public/`에 두고 필요한 DAY만 불러온다.

## v1 → v2 변경

- 모든 예문에 `translation`(한국어 해석)을 추가했다.
- 단어마다 `synonyms`, `antonyms`, `derivatives`, `phrases`, `etymology`를 추가했다.
- 교재 예문(basic) 205문장을 교정했다.
  - OCR로 잘린 문장 끝을 교재대로 복원했다(`before it's too.` → `before it's too late.`).
  - 쪼개진 단어를 붙였다(`wil l` → `will`, `rema i ning` → `remaining`).
  - 문장 뒤에 붙은 출처 표기와 잡문자를 지웠다(`12 甄.`, `169'5.`).
  - 따옴표 안팎의 띄어쓰기를 바로잡았다.
- `equity`의 교재 예문은 OCR 결과로는 원문을 복원할 수 없어 새로 썼다. 그래서 basic `original`이 63개에서 64개가 되었다.
- `schema.sql`에 `wm_relations` 테이블, `wm_words.etymology`, `wm_sentences.translation` 열을 추가했다.
- `wordmaster_relations.csv`를 추가했다.

## 검증 내역

- DAY 1–50 각 40개, 총 2,000개. 교재의 DAY별 체크리스트와 대조했다.
- 6,000문장 모두 빈칸이 정확히 1개이고, 정답이 표제어의 변화형인지 확인했다.
- 6,000문장 모두 해석이 있다.
- 유의어·반의어에 표제어 자신이 들어간 경우가 없고, 같은 단어 안에서 관련어가 중복되지 않는다.
- 교재 예문은 스캔본 OCR에서 추출했다. 원문과 한두 글자 다를 가능성이 있으면 교재로 확인한다.
