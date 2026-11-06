import json
import os
import sys

# 사용법: python seed.py   (같은 폴더에 wordmaster_2000.json 필요)
# 환경변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
# 설치: pip install supabase
# service role 키는 RLS를 우회하므로 이 스크립트는 개인 컴퓨터에서만 실행하고 키를 커밋하지 않는다.

from supabase import create_client

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not url or not key:
    sys.exit("SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 환경변수를 설정하세요.")

db = create_client(url, key)
here = os.path.dirname(os.path.abspath(__file__))
data = json.load(open(os.path.join(here, "wordmaster_2000.json"), encoding="utf-8"))

words = [
    {
        "id": w["id"], "day": w["day"], "ord": w["order"], "word": w["word"],
        "meaning": w["meaning"],
        "etymology": w["etymology"]["text"] if w["etymology"] else None,
    }
    for w in data["words"]
]
sentences = [
    {"word_id": w["id"], **{k: s[k] for k in ("level", "source", "text", "translation", "answer", "blanked")}}
    for w in data["words"]
    for s in w["sentences"]
]
KIND = {"synonyms": "synonym", "antonyms": "antonym", "derivatives": "derivative", "phrases": "phrase"}
relations = [
    {"word_id": w["id"], "kind": KIND[k], "text": r["text"], "meaning": r.get("meaning"), "source": r["source"]}
    for w in data["words"]
    for k in KIND
    for r in w[k]
]


def upsert(table, rows, conflict=None):
    for i in range(0, len(rows), 500):
        q = db.table(table).upsert(rows[i:i + 500], on_conflict=conflict) if conflict \
            else db.table(table).upsert(rows[i:i + 500])
        q.execute()


upsert("wm_words", words)
upsert("wm_sentences", sentences, "word_id,level")
upsert("wm_relations", relations, "word_id,kind,text")

print(f"완료: 단어 {len(words)}개, 문장 {len(sentences)}개, 관련어 {len(relations)}개")
