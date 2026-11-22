"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ThemeIcon, type IconSlot } from "@/lib/themeIcons";

// 아이콘은 테마에 따라 바뀐다 (lib/themeIcons.ts)
const TABS: { href: string; label: string; slot: IconSlot }[] = [
  { href: "/", label: "홈", slot: "home" },
  { href: "/timer", label: "일품타", slot: "timer" },
  { href: "/words", label: "워마", slot: "words" },
  { href: "/calendar", label: "캘린더", slot: "calendar" },
  { href: "/me", label: "내정보", slot: "me" },
];

// 집중해야 하는 화면에서는 탭을 숨긴다
const HIDDEN_ON = ["/login", "/login/reset", "/words/review"];

export default function BottomNav() {
  const pathname = usePathname();
  const auth = useAuth();
  if (auth.status !== "ready" || HIDDEN_ON.includes(pathname) || pathname.startsWith("/words/day/")) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg">
      <ul className="grid grid-cols-5">
        {TABS.map(({ href, label, slot }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                  active ? "text-text" : "text-faint"
                }`}
              >
                <ThemeIcon slot={slot} size={22} strokeWidth={active ? 2.4 : 1.8} className={active ? "text-accent" : ""} />
                {label}
                {active && <span aria-hidden className="nav-mark" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
