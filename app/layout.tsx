import type { Metadata, Viewport } from "next";
import AuthProvider from "@/components/AuthProvider";
import BottomNav from "@/components/BottomNav";
import StudyProvider from "@/components/StudyProvider";
import ThemeProvider from "@/components/ThemeProvider";
import TitlesProvider from "@/components/TitlesProvider";
import LevelWatcher from "@/components/LevelWatcher";
import UpdateWatcher from "@/components/UpdateWatcher";
import { THEME_BOOT_SCRIPT } from "@/lib/themes";
import "./globals.css";

export const metadata: Metadata = {
  title: "대품타",
  description: "야간자습 시간을 기록하고, 겨루고, 그 사이에 단어를 외우는 앱",
  appleWebApp: { capable: true, title: "대품타", statusBarStyle: "black-translucent" },
  // Next는 표준 mobile-web-app-capable만 넣는다 → 예전 iOS도 홈 화면에서 주소창 없이 열리게 애플 이름도 같이 (아이폰 설치 = /install)
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#0b0d12",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* 저장된 테마를 그리기 전에 붙인다 (깜빡임 방지). 고정된 코드 문자열이라 사용자 입력이 들어가지 않는다 */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full">
        {/* 휴대폰 폭 기준. 큰 화면에서는 가운데 정렬 */}
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
          <ThemeProvider>
            <AuthProvider>
              <StudyProvider>
                <TitlesProvider>
                  <main className="flex-1 pb-28">{children}</main>
                  <BottomNav />
                  <UpdateWatcher />
                  <LevelWatcher />
                </TitlesProvider>
              </StudyProvider>
            </AuthProvider>
          </ThemeProvider>
        </div>
      </body>
    </html>
  );
}
