"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase, type Profile } from "@/lib/supabase";

type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "needsProfile"; user: User } // 가입은 했지만 닉네임·학년·반·초대코드를 아직 안 넣음
  | { status: "ready"; user: User; profile: Profile };

type AuthContext = AuthState & { refreshProfile: () => Promise<void>; signOut: () => Promise<void> };

const Ctx = createContext<AuthContext | null>(null);

export function useAuth(): AuthContext {
  const v = useContext(Ctx);
  if (!v) throw new Error("AuthProvider 밖에서 useAuth를 썼습니다");
  return v;
}

/** 로그인한 학생 프로필. ready 상태인 화면에서만 쓴다 */
export function useProfile(): Profile {
  const auth = useAuth();
  if (auth.status !== "ready") throw new Error("로그인 전에는 프로필이 없습니다");
  return auth.profile;
}

// 로그인하지 않아도 볼 수 있는 화면
const PUBLIC_PATHS = ["/login", "/login/reset", "/me/privacy"];

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const router = useRouter();
  const pathname = usePathname();

  // 로그인·로그아웃이 빠르게 이어질 때(계정 삭제 등) 늦게 끝난 예전 조회가 최신 상태를 덮지 않게
  const loadSeq = useRef(0);

  const load = useCallback(async (user: User | null) => {
    const seq = ++loadSeq.current;
    if (!user) {
      setState({ status: "signedOut" });
      return;
    }
    const sb = supabase();
    let { data, error } = await sb.from("profiles").select("id, nickname, grade, class_no, avatar, title_code").eq("id", user.id).maybeSingle();
    if (error?.code === "42703") {
      // schema.sql(칭호·프로필 그림)을 아직 실행하지 않은 DB — 예전 열만 읽는다 (안 그러면 프로필이 없는 걸로 보여 가입 화면에 갇힌다)
      ({ data, error } = await sb.from("profiles").select("id, nickname, grade, class_no").eq("id", user.id).maybeSingle());
    }
    if (seq !== loadSeq.current) return;
    if (error) {
      // 인터넷이 끊긴 경우 등 — 로그인 상태는 유지하고 프로필만 다시 시도하게 둔다
      console.error("[auth] 프로필 불러오기 실패", error);
    }
    setState(data ? { status: "ready", user, profile: data as Profile } : { status: "needsProfile", user });
  }, []);

  useEffect(() => {
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => load(data.session?.user ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      // 토큰 갱신마다 프로필을 다시 읽을 필요는 없다
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        // 콜백 안에서 바로 Supabase를 부르면 막힐 수 있어 다음 틱으로 미룬다 (supabase-js 권장)
        setTimeout(() => load(session?.user ?? null), 0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  // 로그인 안 했으면 /login으로, 다 됐는데 /login에 있으면 홈으로
  const isPublic = PUBLIC_PATHS.includes(pathname);
  useEffect(() => {
    if (state.status === "loading") return;
    if (state.status !== "ready" && !isPublic) router.replace("/login");
    if (state.status === "ready" && pathname === "/login") router.replace("/");
  }, [state.status, isPublic, pathname, router]);

  const value: AuthContext = {
    ...state,
    refreshProfile: async () => {
      const { data } = await supabase().auth.getUser();
      await load(data.user);
    },
    signOut: async () => {
      await supabase().auth.signOut();
    },
  };

  // 로그인 확인 전이거나 넘어가는 중에는 화면을 그리지 않는다 (가짜 화면이 번쩍이지 않게)
  const show = isPublic || state.status === "ready";
  return (
    <Ctx.Provider value={value}>
      {show ? children : <Splash />}
    </Ctx.Provider>
  );
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="size-8 animate-spin rounded-full border-4 border-accent/30 border-t-accent" />
    </div>
  );
}
