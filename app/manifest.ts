import type { MetadataRoute } from "next";

// 홈 화면에 추가하면 앱처럼 열린다 (PWA)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "대고 일품타",
    short_name: "일품타",
    description: "야간자습 시간을 기록하고, 겨루고, 그 사이에 단어를 외우는 앱",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0d12",
    theme_color: "#0b0d12",
    lang: "ko",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
