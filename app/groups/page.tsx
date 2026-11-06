"use client";

import { AppLoader } from "@/components/BrandLoader";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Copy, Crown, LogIn, LogOut, Pencil, Plus, RefreshCw, Share2, Trash2, UserMinus, Users } from "lucide-react";
import { useStudy } from "@/components/StudyProvider";
import { ProfileAvatar, TitleBadge } from "@/components/TitleBadge";
import { Badge, Card, ErrorText, InfoText, InputRow, PrimaryButton, inputCls } from "@/components/ui";
import { notReady } from "@/lib/account";
import { hm } from "@/lib/format";
import {
  createGroup,
  deleteGroup,
  getGroupRanking,
  joinGroup,
  kickGroupMember,
  leaveGroup,
  loadMyGroups,
  prettyCode,
  regenerateGroupCode,
  renameGroup,
  type GroupRankRow,
  type MyGroup,
} from "@/lib/groups";
import { RANKED_SUBJECTS, SUBJECT_COLOR, type RankedSubject } from "@/lib/subjects";
import { koreanError } from "@/lib/supabase";

/**
 * 스터디그룹 — 내 그룹 목록 / 만들기 / 코드로 들어가기, 그룹을 누르면 그룹 안 이번 주 순위.
 * 한 화면 안에서 목록 ↔ 그룹 보기를 바꾼다.
 */
export default function GroupsPage() {
  const [groups, setGroups] = useState<MyGroup[] | null>(null);
  const [ready, setReady] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setGroups(await loadMyGroups());
      setError(null);
    } catch (e) {
      setGroups([]);
      if (notReady(e)) setReady(false);
      else setError(koreanError(e));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    loadMyGroups().then(
      (g) => alive && setGroups(g),
      (e) => {
        if (!alive) return;
        setGroups([]);
        if (notReady(e)) setReady(false);
        else setError(koreanError(e));
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const open = groups?.find((g) => g.id === openId);
  if (open) {
    return (
      <GroupView
        key={open.id}
        group={open}
        onBack={() => setOpenId(null)}
        onChanged={reload}
        onGone={async () => {
          setOpenId(null);
          await reload();
        }}
      />
    );
  }

  return (
    <>
      <Header title="스터디그룹" back={<BackLink href="/me" />} />
      <div className="space-y-4 px-5 pt-2">
        {!ready ? (
          <p className="pt-6 text-center text-[14px] text-muted">준비 중이에요 (데이터베이스 업데이트가 필요해요)</p>
        ) : (
          <>
            <p className="text-[13px] leading-relaxed text-muted">친구들과 그룹을 만들어 이번 주 공부 시간을 겨뤄 보세요. 그룹 순위는 그룹원끼리만 볼 수 있어요.</p>
            {error && <ErrorText>{error}</ErrorText>}

            {groups === null && <AppLoader />}
            {groups && groups.length > 0 && (
              <Card flush className="[&>*+*]:border-t [&>*+*]:border-line">
                {groups.map((g) => (
                  <button key={g.id} type="button" onClick={() => setOpenId(g.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-surface-2">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                      <Users size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[15px] font-semibold">{g.name}</span>
                        {g.is_owner && <Badge tone="warn">방장</Badge>}
                      </span>
                      <span className="text-[12px] text-muted">{g.member_count}명</span>
                    </span>
                    <ChevronRight size={18} className="text-faint" />
                  </button>
                ))}
              </Card>
            )}
            {groups?.length === 0 && !error && (
              <Card className="py-8 text-center">
                <Users size={28} className="mx-auto text-faint" />
                <p className="mt-2 text-[14px] text-muted">아직 들어간 그룹이 없어요</p>
              </Card>
            )}

            <JoinCard
              onJoined={async (id) => {
                await reload();
                setOpenId(id);
              }}
            />
            <CreateCard
              onCreated={async (id) => {
                await reload();
                setOpenId(id);
              }}
            />
            <p className="pb-2 text-center text-[12px] text-faint">그룹은 5개까지 들어갈 수 있고, 3개까지 만들 수 있어요. 한 그룹은 30명까지예요.</p>
          </>
        )}
      </div>
    </>
  );
}

function JoinCard({ onJoined }: { onJoined: (id: string) => Promise<void> }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clean = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  async function submit() {
    if (busy || clean.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const id = await joinGroup(clean);
      setCode("");
      await onJoined(id);
    } catch (e) {
      setError(koreanError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-[15px] font-bold">
        <LogIn size={17} className="text-accent" /> 초대코드로 들어가기
      </h2>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 7))}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="6자리 코드"
          className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-bg px-4 font-mono text-[17px] tracking-[0.2em] outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-faint focus:border-accent"
        />
        <button disabled={busy || clean.length !== 6} className="h-12 shrink-0 rounded-xl bg-accent px-5 text-[15px] font-bold text-bg disabled:opacity-40">
          {busy ? "…" : "참여"}
        </button>
      </form>
      {error && (
        <div className="mt-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
    </Card>
  );
}

function CreateCard({ onCreated }: { onCreated: (id: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = name.trim().length >= 2;

  async function submit() {
    if (busy || !ok) return;
    setBusy(true);
    setError(null);
    try {
      const id = await createGroup(name);
      setName("");
      await onCreated(id);
    } catch (e) {
      setError(koreanError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-[15px] font-bold">
        <Plus size={17} className="text-accent" /> 새 그룹 만들기
      </h2>
      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <InputRow icon={<Users size={18} />}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="그룹 이름 (2~20자)" className={inputCls} />
        </InputRow>
        {error && <ErrorText>{error}</ErrorText>}
        <PrimaryButton disabled={busy || !ok}>{busy ? "만드는 중…" : "만들고 초대코드 받기"}</PrimaryButton>
      </form>
    </Card>
  );
}

// ───────────────────────── 그룹 보기 ─────────────────────────

function GroupView({ group, onBack, onChanged, onGone }: { group: MyGroup; onBack: () => void; onChanged: () => Promise<void>; onGone: () => Promise<void> }) {
  const study = useStudy();
  const [subject, setSubject] = useState<RankedSubject | null>(null);
  const [rows, setRows] = useState<GroupRankRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    getGroupRanking(group.id, subject).then(
      (r) => alive && (setRows(r), setError(null)),
      (e) => alive && setError(koreanError(e)),
    );
    return () => {
      alive = false;
    };
  }, [group.id, subject, study.version, reloadKey]);

  async function act(fn: () => Promise<unknown>, done?: string) {
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (done) setNotice(done);
      await onChanged();
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(koreanError(e));
    }
  }

  async function share() {
    const url = `${location.origin}/groups`;
    const text = `대고 일품타 스터디그룹 '${group.name}'에 들어와! 초대코드: ${group.invite_code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "스터디그룹 초대", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setNotice("초대 문구를 복사했어요");
    } catch {
      // 공유 창을 닫은 경우 등
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(group.invite_code);
      setNotice("초대코드를 복사했어요");
    } catch {
      setNotice(null);
    }
  }

  const live = rows?.filter((r) => r.studying).length ?? 0;

  return (
    <>
      <Header
        title={group.name}
        back={
          <button type="button" onClick={onBack} aria-label="뒤로" className="grid size-10 place-items-center rounded-full text-muted active:bg-surface-2">
            <ArrowLeft size={22} />
          </button>
        }
      />
      <div className="space-y-4 px-5 pt-2">
        {/* 초대코드 */}
        <Card className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-muted">초대코드 · {group.member_count}/30명</p>
            <p className="num mt-0.5 select-all font-mono text-[24px] font-bold tracking-[0.15em] text-accent">{prettyCode(group.invite_code)}</p>
          </div>
          <button type="button" onClick={copyCode} aria-label="코드 복사" className="grid size-11 place-items-center rounded-xl bg-surface-2 text-muted active:opacity-70">
            <Copy size={19} />
          </button>
          <button type="button" onClick={share} aria-label="초대하기" className="grid size-11 place-items-center rounded-xl bg-accent text-bg active:opacity-80">
            <Share2 size={19} />
          </button>
        </Card>
        {notice && <InfoText>{notice}</InfoText>}
        {error && <ErrorText>{error}</ErrorText>}

        {/* 순위 */}
        <div className="flex items-end justify-between pt-2">
          <h2 className="text-[18px] font-bold">이번 주 그룹 순위</h2>
          {live > 0 && (
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-live">
              <span className="live-dot size-2 rounded-full bg-live" /> {live}명 공부 중
            </span>
          )}
        </div>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          <Chip active={subject === null} onClick={() => setSubject(null)} label="전체" />
          {RANKED_SUBJECTS.map((s) => (
            <Chip key={s} active={subject === s} onClick={() => setSubject(s)} label={s} color={SUBJECT_COLOR[s]} />
          ))}
        </div>

        {!rows && !error && <AppLoader />}
        {rows && (
          <ol className="overflow-hidden rounded-2xl border border-line bg-surface">
            {rows.map((r, i) => (
              <li
                key={r.nickname}
                className={`flex items-center gap-3 px-4 py-3 ${r.is_me ? "bg-accent-soft" : ""} ${i > 0 ? "border-t border-line" : ""}`}
              >
                <span className={`num w-6 text-[15px] font-bold ${r.rank <= 3 && r.total_sec > 0 ? "text-warn" : "text-muted"}`}>{r.rank}</span>
                <span className="relative">
                  <ProfileAvatar avatar={r.avatar} nickname={r.nickname} grade={r.title_grade} size={36} />
                  {r.studying && <span className="live-dot absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface bg-live" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <span className="truncate text-[15px] font-medium">{r.nickname}</span>
                    {r.is_owner && <Crown size={13} className="shrink-0 text-warn" fill="currentColor" />}
                    {r.is_me && <span className="text-[12px] text-accent">나</span>}
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5">
                    {r.title_name && <TitleBadge name={r.title_name} grade={r.title_grade} size="xs" />}
                    <span className="num shrink-0 text-[12px] text-faint">
                      {r.grade}-{r.class_no} · 오늘 {hm(r.today_sec)}
                    </span>
                  </span>
                </span>
                <span className="num text-[15px] font-semibold">{hm(r.total_sec)}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="text-center text-[12px] text-faint">매주 월요일 0시 초기화 · 진행 중인 공부는 끝나면 반영돼요</p>

        <GroupSettings group={group} rows={rows} act={act} onGone={onGone} />
      </div>
    </>
  );
}

function GroupSettings({
  group,
  rows,
  act,
  onGone,
}: {
  group: MyGroup;
  rows: GroupRankRow[] | null;
  act: (fn: () => Promise<unknown>, done?: string) => Promise<void>;
  onGone: () => Promise<void>;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(group.name);
  const others = rows?.filter((r) => !r.is_me) ?? [];

  async function leave() {
    const msg = group.is_owner
      ? "그룹을 나갈까요? 방장은 가장 먼저 들어온 친구에게 넘어가요. 혼자 있었다면 그룹이 지워져요."
      : "그룹을 나갈까요? 초대코드로 다시 들어올 수 있어요.";
    if (!confirm(msg)) return;
    try {
      await leaveGroup(group.id);
      await onGone();
    } catch (e) {
      alert(koreanError(e));
    }
  }

  async function remove() {
    if (!confirm(`'${group.name}' 그룹을 지울까요? 모든 멤버가 그룹에서 빠져요.`)) return;
    try {
      await deleteGroup(group.id);
      await onGone();
    } catch (e) {
      alert(koreanError(e));
    }
  }

  return (
    <div className="space-y-3 pt-4">
      {group.is_owner && (
        <Card flush className="[&>*+*]:border-t [&>*+*]:border-line">
          <p className="px-4 pb-2 pt-3 text-[12px] font-semibold text-muted">방장 설정</p>
          {renaming ? (
            <form
              className="flex gap-2 px-4 py-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (name.trim().length < 2) return;
                await act(() => renameGroup(group.id, name), "이름을 바꿨어요");
                setRenaming(false);
              }}
            >
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 text-[15px] outline-none focus:border-accent" />
              <button className="h-10 rounded-lg bg-accent px-4 text-[14px] font-bold text-bg">저장</button>
            </form>
          ) : (
            <SettingRow icon={<Pencil size={18} />} label="그룹 이름 바꾸기" onClick={() => setRenaming(true)} />
          )}
          <SettingRow
            icon={<RefreshCw size={18} />}
            label="초대코드 새로 만들기"
            sub="코드가 모르는 사람에게 퍼졌을 때. 예전 코드는 못 써요"
            onClick={() => confirm("새 코드를 만들까요? 예전 코드로는 들어올 수 없게 돼요.") && act(() => regenerateGroupCode(group.id), "새 초대코드를 만들었어요")}
          />
          {others.map((r) => (
            <SettingRow
              key={r.nickname}
              icon={<UserMinus size={18} />}
              label={`${r.nickname} 내보내기`}
              onClick={() => confirm(`${r.nickname} 님을 그룹에서 내보낼까요?`) && act(() => kickGroupMember(group.id, r.nickname), `${r.nickname} 님을 내보냈어요`)}
            />
          ))}
          <SettingRow icon={<Trash2 size={18} />} label="그룹 지우기" danger onClick={remove} />
        </Card>
      )}
      <Card flush>
        <SettingRow icon={<LogOut size={18} />} label="그룹 나가기" danger onClick={leave} />
      </Card>
    </div>
  );
}

function SettingRow({ icon, label, sub, danger, onClick }: { icon: ReactNode; label: string; sub?: string; danger?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2">
      <span className={danger ? "text-danger" : "text-muted"}>{icon}</span>
      <span className="flex-1">
        <span className={`block text-[15px] ${danger ? "text-danger" : ""}`}>{label}</span>
        {sub && <span className="block text-[12px] text-faint">{sub}</span>}
      </span>
    </button>
  );
}

function Chip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${active ? "border-transparent text-on-subject" : "border-line text-muted"}`}
      style={active ? { background: color ?? "var(--text)", color: color ? undefined : "var(--bg)" } : undefined}
    >
      {label}
    </button>
  );
}

function Header({ title, back }: { title: string; back: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-bg/90 px-2 pt-[env(safe-area-inset-top)] backdrop-blur-lg">
      {back}
      <h1 className="flex-1 truncate text-[17px] font-semibold">{title}</h1>
    </header>
  );
}

function BackLink({ href }: { href: string }) {
  return (
    <Link href={href} aria-label="뒤로" className="grid size-10 place-items-center rounded-full text-muted active:bg-surface-2">
      <ArrowLeft size={22} />
    </Link>
  );
}
