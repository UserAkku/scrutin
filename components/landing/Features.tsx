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
          <h2 className="mt-3 font-display text-4xl uppercase leading-tight sm:text-5xl md:text-6xl text-brutal-black">Six Systems. One Report.</h2>
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => {
          const colors = [
            "bg-[var(--pastel-blue)]",
            "bg-[var(--pastel-pink)]",
            "bg-[var(--pastel-green)]",
            "bg-[var(--pastel-yellow)]",
            "bg-[var(--pastel-pink)]",
            "bg-[var(--pastel-blue)]"
          ];
          const cardColor = colors[index % colors.length];
          return (
            <Card key={item.title} className={`min-h-60 p-8 relative ${cardColor}`}>
              <div className="absolute -top-4 -right-4 w-10 h-10 rounded-full border-2 border-brutal-black bg-white flex items-center justify-center font-display text-lg z-10">
                0{index + 1}
              </div>
              <div className="w-12 h-12 rounded-full border-2 border-brutal-black bg-white flex items-center justify-center mb-6">
                <item.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-2 font-display text-xl uppercase sm:text-2xl">{item.title}</h3>
              <p className="mt-4 text-sm leading-7 font-body text-text-secondary font-medium">{item.description}</p>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
