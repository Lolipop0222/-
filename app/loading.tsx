import { AppLoader } from "@/components/BrandLoader";

/** 화면을 옮겨 가는 동안 (앱 안 로딩 — 두 번째 그림) */
export default function Loading() {
  return (
    <div className="grid min-h-[60dvh] place-items-center">
      <AppLoader />
    </div>
  );
}
