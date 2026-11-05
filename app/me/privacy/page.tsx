import { Card, SubHeader } from "@/components/ui";

const ITEMS = [
  { q: "무엇을 받나요?", a: "닉네임, 학년, 반, 이메일(로그인용)만 받아요. 실명·학번·연락처는 받지 않아요." },
  { q: "왜 받나요?", a: "학년과 반은 순위 범위(전교/학년/반)를 나누는 데만 써요." },
  { q: "어디에 저장하나요?", a: "Supabase(서울 리전) 데이터베이스에 저장하고, 본인 기록은 본인만 볼 수 있어요." },
  { q: "누가 볼 수 있나요?", a: "다른 사람에게는 순위표의 닉네임과 공부 시간 합계만 보여요. 단어장은 본인만 봐요." },
  { q: "문의 내용은요?", a: "문의함에 쓴 내용은 나와 앱 관리자만 볼 수 있어요. 내가 언제든 지울 수 있어요." },
  { q: "비밀번호는 어떻게 지키나요?", a: "비밀번호와 복구 코드는 원래 글자가 아니라 되돌릴 수 없는 암호(해시)로만 저장해서 관리자도 알 수 없어요." },
  { q: "어떻게 지우나요?", a: "내정보 → 계정 삭제에서 비밀번호를 넣으면 계정과 모든 기록(공부 기록, 플래너, 디데이, 문의)이 즉시 삭제돼요." },
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
