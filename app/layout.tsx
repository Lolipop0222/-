import type { Metadata, Viewport } from "next";
import BottomNav from "@/components/BottomNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "대고 일품타",
  description: "야간자습 시간을 기록하고, 겨루고, 그 사이에 단어를 외우는 앱",
  appleWebApp: { capable: true, title: "일품타", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0b0d12",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full">
        {/* 휴대폰 폭 기준. 큰 화면에서는 가운데 정렬 */}
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
          <main className="flex-1 pb-28">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
