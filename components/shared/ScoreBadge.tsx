import { getGrade } from "@/lib/utils";

export function ScoreBadge({ score }: { score: number }) {
  const grade = getGrade(score);
  return (
    <span className="inline-flex h-10 min-w-10 items-center justify-center border border-foreground bg-foreground px-3 font-display text-sm text-background">
      {grade}
    </span>
  );
}
