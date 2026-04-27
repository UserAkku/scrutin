import { Card } from "@/components/shared/card";
import {
  GaugeIcon,
  MobileIcon,
  SearchIcon,
  ShieldIcon,
  SparklesIcon,
  WrenchIcon
} from "@/components/shared/icons";

const items = [
  { icon: GaugeIcon, title: "Performance", description: "Mobile and desktop Lighthouse scoring with Core Web Vitals and fix strategies." },
  { icon: SearchIcon, title: "SEO", description: "Metadata, headings, schema, internal links, keyword density, and crawl-readiness." },
  { icon: ShieldIcon, title: "Security", description: "Mozilla Observatory-backed header checks with exact server-side remediation guidance." },
  { icon: SparklesIcon, title: "UX / UI", description: "Gemini vision audit for hierarchy, CTA clarity, contrast, and above-the-fold effectiveness." },
  { icon: MobileIcon, title: "Accessibility", description: "WCAG-oriented checks for labels, semantics, naming, and keyboard readiness." },
  { icon: WrenchIcon, title: "Technical", description: "robots.txt, sitemap, redirects, compression, favicon, response time, and infrastructure." }
];

export function Features() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 md:px-8">
      <div className="mb-10 flex items-end justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-foreground/55">What we check</p>
          <h2 className="mt-3 font-display text-2xl uppercase leading-tight sm:text-3xl md:text-4xl">Six Systems. One Report.</h2>
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Card key={item.title} className="min-h-60 p-6">
            <item.icon className="h-6 w-6" />
            <h3 className="mt-8 font-display text-xl uppercase sm:text-2xl">{item.title}</h3>
            <p className="mt-4 text-sm leading-7 text-foreground/70">{item.description}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
