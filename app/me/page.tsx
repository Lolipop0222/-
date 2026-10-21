import { LogOut, Palette, Shield, Trash2, Users } from "lucide-react";
import Avatar from "@/components/Avatar";
import GroupCard from "@/components/GroupCard";
import { Badge, Card, ListRow, PageHeader } from "@/components/ui";
import { hm } from "@/lib/format";
import { me, weekStudy } from "@/lib/mock";

export default function MePage() {
  return (
    <>
      <PageHeader title="내정보" />

      <div className="space-y-4 px-5">
        {/* 프로필 */}
        <Card flush className="flex items-center gap-4 p-5">
          <Avatar size={68} {...me.avatar} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[20px] font-bold">{me.nickname}</p>
            <p className="mt-0.5 text-[13px] text-muted">
              {me.grade}학년 {me.classNo}반
            </p>
          </div>
          <div className="text-right">
            <p className="text-[12px] text-muted">포인트</p>
            <p className="num text-[18px] font-bold text-accent">{me.points.toLocaleString()}</p>
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="이번 주" value={hm(weekStudy.totalSec)} />
          <Stat label="연속 공부" value="6일" />
          <Stat label="외운 단어" value="414" />
        </div>

        <GroupCard />

        <Card flush className="[&>*+*]:border-t [&>*+*]:border-line">
          <ListRow icon={<Palette size={20} />} label="아바타 꾸미기" value="준비 중" href="/me" />
          <ListRow icon={<Users size={20} />} label="닉네임 · 학년 · 반 수정" href="/me" />
          <ListRow icon={<Shield size={20} />} label="개인정보 처리방침" href="/me/privacy" />
        </Card>

        <Card flush className="[&>*+*]:border-t [&>*+*]:border-line">
          <ListRow icon={<LogOut size={20} />} label="로그아웃" href="/login" />
          <ListRow icon={<Trash2 size={20} />} label="계정 삭제" danger />
        </Card>

        <p className="flex items-center justify-center gap-2 pb-2 text-[12px] text-faint">
          대고 일품타 <Badge>v0.1 UI</Badge>
        </p>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-2 py-3">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="num mt-1 text-[15px] font-bold">{value}</p>
    </div>
  );
}
