import type { CapacitorConfig } from "@capacitor/cli";

/**
 * 안드로이드 앱(APK) 설정.
 * 앱은 배포된 웹 주소(APP_URL)를 그대로 연다 — NEIS 키 같은 비밀은 서버(Vercel)에만 있다.
 * 빌드: npm run apk -- https://배포주소.vercel.app
 */
const url = process.env.APP_URL;

const config: CapacitorConfig = {
  appId: "com.daegoilpumta.app",
  appName: "대고 일품타",
  // android-shell/을 바탕으로 scripts/build-apk.mjs가 만드는 폴더 (인터넷이 안 될 때 보여 줄 화면)
  webDir: ".apk-web",
  server: url ? { url, errorPath: "offline.html" } : undefined,
  android: { backgroundColor: "#0b0d12" },
  plugins: {
    // 화면이 상태바 밑까지 그려지고, 웹의 env(safe-area-inset-*) 여백으로 피한다 (layout.tsx viewportFit: cover)
    SystemBars: { insetsHandling: "native", initialViewportFitValueHint: "cover", style: "DARK" },
  },
};

export default config;
