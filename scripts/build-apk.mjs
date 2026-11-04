// 안드로이드 APK 만들기: npm run apk -- https://배포주소.vercel.app
// 필요: JDK 21, Android SDK (ANDROID_HOME 환경변수 또는 android/local.properties)
// 결과: dist/daego-ilpumta.apk (디버그 서명 — 친구들에게 테스트용으로 나눠 줄 때 쓴다)
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";

const raw = process.argv[2];
let url;
try {
  url = new URL(raw);
} catch {
  console.error("사용법: npm run apk -- https://배포주소.vercel.app");
  process.exit(1);
}
if (url.protocol !== "https:") {
  console.error("✗ https:// 주소만 쓸 수 있어요");
  process.exit(1);
}
const appUrl = url.origin;

// 1) 인터넷이 안 될 때 보여 줄 화면 — "다시 시도"가 앱 주소로 돌아가게 주소를 채워 넣는다
rmSync(".apk-web", { recursive: true, force: true });
mkdirSync(".apk-web");
for (const f of readdirSync("android-shell")) {
  writeFileSync(`.apk-web/${f}`, readFileSync(`android-shell/${f}`, "utf8").replaceAll("__APP_URL__", appUrl));
}

// 2) 설정을 안드로이드 프로젝트에 반영하고 빌드
const run = (cmd, opts = {}) => execSync(cmd, { stdio: "inherit", ...opts });
run("npx cap sync android", { env: { ...process.env, APP_URL: appUrl } });
run(process.platform === "win32" ? "gradlew.bat assembleDebug" : "./gradlew assembleDebug", { cwd: "android" });

mkdirSync("dist", { recursive: true });
cpSync("android/app/build/outputs/apk/debug/app-debug.apk", "dist/daego-ilpumta.apk");
console.log(`\n✓ dist/daego-ilpumta.apk  (${appUrl} 을 여는 앱)`);
