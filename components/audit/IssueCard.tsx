import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/shared/accordion";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { FixSuggestion } from "@/components/audit/FixSuggestion";

export function IssueCard({
  issue,
  value
}: {
  issue: {
    title: string;
    description: string;
    fixSuggestion: string;
    severity: string;
    impact?: string | null;
    effort?: string | null;
  };
  value: string;
}) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger>
        <div className="flex flex-1 items-center gap-4">
          <SeverityBadge severity={issue.severity} />
          <span>{issue.title}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4">
          <p className="text-foreground/75">{issue.description}</p>
          <FixSuggestion text={issue.fixSuggestion} />
          <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-foreground/55">
            {issue.impact ? <span>Impact: {issue.impact}</span> : null}
            {issue.effort ? <span>Effort: {issue.effort}</span> : null}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
