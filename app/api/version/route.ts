import { connection } from "next/server";

/**
 * GET /api/version — 지금 배포된 앱의 버전.
 * 열려 있는 앱(웹·APK)이 이걸 가끔 물어봐서 자기 버전과 다르면 새로 불러온다 (components/UpdateWatcher.tsx).
 */
export async function GET() {
  await connection(); // 빌드할 때 굳히지 않고 요청마다 응답
  return Response.json(
    { version: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
