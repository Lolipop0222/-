import { Card, SubHeader } from "@/components/ui";

const ITEMS = [
  { q: "무엇을 받나요?", a: "닉네임, 학년, 반, 이메일(로그인용)만 받아요. 실명·학번·연락처는 받지 않아요." },
  { q: "왜 받나요?", a: "학년과 반은 순위 범위(전교/학년/반)를 나누는 데만 써요." },
  { q: "어디에 저장하나요?", a: "Supabase(서울 리전) 데이터베이스에 저장하고, 본인 기록은 본인만 볼 수 있어요." },
  { q: "누가 볼 수 있나요?", a: "다른 사람에게는 순위표의 닉네임과 공부 시간 합계만 보여요. 단어장은 본인만 봐요." },
  { q: "어떻게 지우나요?", a: "내정보 → 계정 삭제를 누르면 모든 기록이 즉시 삭제돼요." },
];

export default function PrivacyPage() {
  return (
    <>
      <SubHeader title="개인정보 처리방침" back="/me" />
      <div className="space-y-3 px-5 pt-2">
        {ITEMS.map((it) => (
          <Card key={it.q}>
            <p className="text-[15px] font-semibold">{it.q}</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{it.a}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
