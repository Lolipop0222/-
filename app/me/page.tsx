"use client";

import { useEffect, useState } from "react";
import { Award, KeyRound, LogOut, MessageCircleQuestion, Palette, Shield, ShieldCheck, Smile, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useAuth, useProfile } from "@/components/AuthProvider";
import { useStudy } from "@/components/StudyProvider";
import { useTheme } from "@/components/ThemeProvider";
import { ProfileAvatar, TitleBadge } from "@/components/TitleBadge";
import { useMyTitles, useTitles } from "@/components/TitlesProvider";
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
  const { check } = useTitles();
  const { titles, available: titlesOn } = useMyTitles();
  const equipped = titles?.find((t) => t.equipped) ?? null;
  const earned = titles?.filter((t) => t.earned_at).length ?? 0;
  // 내정보를 열 때도 칭호 판정 (계획서: cron 대신 앱을 쓰는 시점마다)
  useEffect(() => {
    void check();
  }, [check]);
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
          <Link href="/me/avatar" aria-label="프로필 그림 바꾸기" className="relative">
            <ProfileAvatar avatar={profile.avatar} nickname={profile.nickname} grade={equipped?.grade} size={68} />
            <span className="absolute -bottom-0.5 -right-0.5 grid size-6 place-items-center rounded-full border-2 border-surface bg-surface-2 text-muted">
              <Smile size={13} />
            </span>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[20px] font-bold">{profile.nickname}</p>
            {equipped && (
              <Link href="/me/titles" className="mt-1 flex">
                <TitleBadge name={equipped.name} grade={equipped.grade} size="sm" />
              </Link>
            )}
            <p className="mt-1 text-[13px] text-muted">
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
          <ListRow icon={<Award size={20} />} label="칭호" value={!titlesOn ? "준비 중" : titles ? `${earned}/${titles.length}` : undefined} href="/me/titles" />
          <ListRow icon={<Smile size={20} />} label="프로필 그림" href="/me/avatar" />
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
