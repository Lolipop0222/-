import Link from "next/link";
import { ChevronRight } from "lucide-react";
import PrintArchiveLogo from "@/components/PrintArchiveLogo";
import { Card } from "@/components/ui";

/** 홈 → 프린트 아카이브 바로 가기 */
export default function HomePrints() {
  return (
    <Link href="/prints" className="block">
      <Card className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <PrintArchiveLogo width={150} />
          <p className="mt-1.5 text-[13px] text-muted">수행평가 자료·학습지 모아 보기</p>
        </div>
        <ChevronRight size={20} className="text-faint" />
      </Card>
    </Link>
  );
}
