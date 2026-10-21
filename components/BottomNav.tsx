"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, House, Timer, User } from "lucide-react";

const TABS = [
  { href: "/", label: "홈", icon: House },
  { href: "/timer", label: "일품타", icon: Timer },
  { href: "/words", label: "워마", icon: BookOpen },
  { href: "/calendar", label: "캘린더", icon: CalendarDays },
  { href: "/me", label: "내정보", icon: User },
];

// 집중해야 하는 화면에서는 탭을 숨긴다
const HIDDEN_ON = ["/login", "/words/review"];

export default function BottomNav() {
  const pathname = usePathname();
  if (HIDDEN_ON.includes(pathname)) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg">
      <ul className="grid grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                  active ? "text-text" : "text-faint"
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 1.8} className={active ? "text-accent" : ""} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
