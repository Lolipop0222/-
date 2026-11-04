import { notFound } from "next/navigation";
import WordQuiz from "@/components/WordQuiz";
import { WM_DAYS } from "@/lib/wordmaster";

export function generateStaticParams() {
  return Array.from({ length: WM_DAYS }, (_, i) => ({ day: String(i + 1) }));
}

export default async function WordDayPage({ params }: PageProps<"/words/day/[day]">) {
  const { day } = await params;
  const n = Number(day);
  if (!Number.isInteger(n) || n < 1 || n > WM_DAYS) notFound();
  return <WordQuiz day={n} />;
}
