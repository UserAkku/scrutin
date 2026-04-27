import { ScoreBadge } from "@/components/shared/ScoreBadge";
import { ScoreGauge } from "@/components/shared/ScoreGauge";
import { Button } from "@/components/shared/button";

export function OverallScore({
  score,
  onReaudit
}: {
  score: number;
  onReaudit?: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-6">
        <ScoreGauge score={score} size={160} label="overall" />
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">Overall score</p>
          <div className="mt-3 flex items-center gap-3">
            <ScoreBadge score={score} />
            <span className="font-display text-4xl uppercase">{score}</span>
          </div>
        </div>
      </div>
      {onReaudit ? <Button onClick={onReaudit}>Re-Audit</Button> : null}
    </div>
  );
}
