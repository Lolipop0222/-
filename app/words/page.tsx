import { PageHeader } from "@/components/ui";
import WordsHub from "@/components/words/WordsHub";

export default function WordsPage() {
  return (
    <>
      <PageHeader title="워마" sub="워드마스터 수능 2000 · 외우고 복습하기" />
      <div className="px-5 pb-6">
        <WordsHub />
      </div>
    </>
  );
}
