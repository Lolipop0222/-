"use client";

import { useEffect, useState } from "react";
import { KeyRound, LogOut, MessageCircleQuestion, Palette, Shield, ShieldCheck, Smile, Trash2, Users } from "lucide-react";
import Avatar from "@/components/Avatar";
import { useAuth, useProfile } from "@/components/AuthProvider";
import { useStudy } from "@/components/StudyProvider";
import { useTheme } from "@/components/ThemeProvider";
import { Badge, Card, ListRow, PageHeader } from "@/components/ui";
import { isAdmin } from "@/lib/account";
import { hm } from "@/lib/format";
import { themeName } from "@/lib/themes";
import { RANKED_SUBJECTS, SUBJECT_COLOR } from "@/lib/subjects";

export default function MePage() {
  const auth = useAuth();
  const profile = useProfile();
  const { summary } = useStudy();
  const themeLabel = themeName(useTheme().choice);
  const top = RANKED_SUBJECTS.reduce((a, b) => (summary.weekBySubject[b] > summary.weekBySubject[a] ? b : a));
  const hasTop = summary.weekBySubject[top] >= 60;
  // 관리자 메뉴는 관리자에게만 보인다 (실제 권한은 DB가 확인)
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    let alive = true;
    isAdmin().then((v) => alive && setAdmin(v));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <PageHeader title="내정보" />

      <div className="space-y-4 px-5">
        {/* 프로필 */}
        <Card flush className="flex items-center gap-4 p-5">
          <Avatar size={68} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[20px] font-bold">{profile.nickname}</p>
            <p className="mt-0.5 text-[13px] text-muted">
              {profile.grade}학년 {profile.class_no}반
            </p>
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="오늘" value={hm(summary.todaySec)} />
          <Stat label="이번 주" value={hm(summary.weekSec)} />
          <Stat label="이번 주 최다" value={hasTop ? top : "–"} color={hasTop ? SUBJECT_COLOR[top] : undefined} />
        </div>

        <Card flush className="[&>*+*]:border-t [&>*+*]:border-line">
          <ListRow icon={<Users size={20} />} label="스터디그룹" href="/groups" />
          <ListRow icon={<Palette size={20} />} label="테마" value={themeLabel} href="/me/theme" />
          <ListRow icon={<Smile size={20} />} label="아바타 꾸미기" value="준비 중" />
          <ListRow icon={<MessageCircleQuestion size={20} />} label="문의함" href="/me/inquiry" />
          <ListRow icon={<KeyRound size={20} />} label="비밀번호·복구 코드" href="/me/security" />
          <ListRow icon={<Shield size={20} />} label="개인정보 처리방침" href="/me/privacy" />
          {admin && <ListRow icon={<ShieldCheck size={20} />} label="관리자" href="/me/admin" />}
        </Card>

        <Card flush className="[&>*+*]:border-t [&>*+*]:border-line">
          <button onClick={() => auth.signOut()} className="flex min-h-13 w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2">
            <LogOut size={20} className="text-muted" />
            <span className="flex-1 text-[15px]">로그아웃</span>
          </button>
          <ListRow icon={<Trash2 size={20} />} label="계정 삭제" href="/me/delete" danger />
        </Card>

        <p className="flex items-center justify-center gap-2 pb-2 text-[12px] text-faint">
          대고 일품타 <Badge>v0.3</Badge>
        </p>
      </div>
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-2 py-3">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="num mt-1 text-[15px] font-bold" style={color ? { color } : undefined}>
        {value}
      </p>
    </div>
  );
}
