import { Card } from "@/components/shared/card";
import { ScoreBadge } from "@/components/shared/ScoreBadge";
import { ScoreGauge } from "@/components/shared/ScoreGauge";

export function CategoryCard({
  title,
  score,
  issueCount
}: {
  title: string;
  score: number;
  issueCount: number;
}) {
  return (
    <Card className="flex items-center justify-between gap-4 p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">{title}</p>
        <div className="mt-4 flex items-center gap-3">
          <ScoreBadge score={score} />
          <div className="text-sm text-foreground/70">{issueCount} issues found</div>
        </div>
      </div>
      <ScoreGauge score={score} size={86} />
    </Card>
  );
}
