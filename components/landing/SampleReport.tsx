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
        <p className="text-xs uppercase tracking-[0.22em] text-brutal-black/70 font-body font-bold">Sample issues</p>
        <h2 className="mt-3 font-display text-4xl uppercase leading-tight sm:text-5xl md:text-6xl text-brutal-black">What a Full Report Feels Like</h2>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {[
          { issue: issues[0], color: "bg-[var(--pastel-pink)]" },
          { issue: issues[1], color: "bg-white" },
          { issue: issues[2], color: "bg-[var(--pastel-blue)]" }
        ].map(({ issue, color }) => (
          <div key={issue.title} className={`brutal-card p-8 relative ${color}`}>
            <div className="absolute top-6 right-6">
              <SeverityBadge severity={issue.severity} />
            </div>
            <h3 className="mt-8 font-display text-2xl uppercase pr-4 text-brutal-black">{issue.title}</h3>
            <p className="mt-4 text-base leading-7 font-body font-bold text-brutal-black/80">{issue.fix}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
