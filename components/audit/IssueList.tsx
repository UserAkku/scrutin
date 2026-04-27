import { Accordion } from "@/components/shared/accordion";
import { IssueCard } from "@/components/audit/IssueCard";

export function IssueList({
  issues
}: {
  issues: Array<{
    id: string;
    title: string;
    description: string;
    fixSuggestion: string;
    severity: string;
    impact?: string | null;
    effort?: string | null;
  }>;
}) {
  if (issues.length === 0) {
    return <p className="text-sm text-foreground/60">No issues detected for this category.</p>;
  }

  return (
    <Accordion type="single" collapsible>
      {issues.map((issue) => (
        <IssueCard key={issue.id} issue={issue} value={issue.id} />
      ))}
    </Accordion>
  );
}
