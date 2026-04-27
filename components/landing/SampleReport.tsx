import { Card } from "@/components/shared/card";
import { SeverityBadge } from "@/components/shared/SeverityBadge";

export function SampleReport() {
  const issues = [
    {
      severity: "critical" as const,
      title: "No Content-Security-Policy header",
      fix: "Add a restrictive CSP header, test inline script allowances, and roll out in report-only mode before enforcing."
    },
    {
      severity: "medium" as const,
      title: "Hero CTA blends into surrounding content",
      fix: "Increase contrast, isolate the action block, and shorten button copy to one direct verb."
    },
    {
      severity: "low" as const,
      title: "12 images missing alt text",
      fix: "Write concise, intent-driven alt text for product, team, and trust badge images."
    }
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 md:px-8">
      <div className="mb-10">
        <p className="text-xs uppercase tracking-[0.22em] text-foreground/55">Sample issues</p>
        <h2 className="mt-3 font-display text-2xl uppercase leading-tight sm:text-3xl md:text-4xl">What a Full Report Feels Like</h2>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {issues.map((issue) => (
          <Card key={issue.title} className="p-6">
            <SeverityBadge severity={issue.severity} />
            <h3 className="mt-6 font-display text-2xl uppercase">{issue.title}</h3>
            <p className="mt-4 text-sm leading-7 text-foreground/70">{issue.fix}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
