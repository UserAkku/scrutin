import { AuditInputForm } from "@/components/landing/AuditInputForm";
import { Card } from "@/components/shared/card";
import { ScoreGauge } from "@/components/shared/ScoreGauge";
import { ShieldIcon, TimerIcon, ZapIcon } from "@/components/shared/icons";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border flex items-center min-h-[calc(100vh-73px)]">
      <div className="mx-auto w-full grid max-w-7xl gap-10 px-4 py-12 md:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:py-0">
        <div className="space-y-8 flex flex-col justify-center">
          <p className="max-w-xs text-xs uppercase tracking-[0.22em] text-foreground/60">
            Daily repetition. System logging. Structural integrity for every public website you ship.
          </p>
          <div className="space-y-5">
            <h1 className="max-w-4xl font-display text-2xl uppercase leading-[1.2] sm:text-4xl lg:text-5xl xl:text-6xl">
              Audit Every Page Like It&apos;s Mission Critical.
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-foreground/75 sm:text-base sm:leading-8">
              Enter your website URL and get a professional audit report in under two minutes. Performance, SEO, security, UX, accessibility, and technical fixes are mapped into exact action steps.
            </p>
          </div>
          <AuditInputForm />
          <div className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-foreground/65 sm:flex-row sm:flex-wrap sm:gap-4 sm:text-xs">
            <span>10,000+ websites analyzed</span>
            <span>Guest audits available</span>
            <span>Exportable PDF reports</span>
          </div>
        </div>
        <Card className="grid gap-8 bg-foreground dark:bg-panel p-6 sm:p-8 text-background dark:text-foreground shadow-brutal">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-[0.18em] text-background/70 dark:text-foreground/70 sm:text-xs">Live score preview</p>
              <h2 className="mt-3 max-w-[200px] font-display text-xl uppercase leading-tight sm:max-w-none sm:text-2xl md:text-3xl">Structural Status</h2>
            </div>
            <div className="shrink-0">
              <ScoreGauge score={86} label="overall" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["Performance", "92"],
              ["SEO", "84"],
              ["Security", "78"],
              ["UX/UI", "88"]
            ].map(([label, score]) => (
              <div key={label} className="border border-white/20 dark:border-border p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-background/55 dark:text-foreground/55">{label}</p>
                <p className="mt-3 font-display text-3xl">{score}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 text-sm text-background/80 dark:text-foreground/80">
            <div className="flex items-center gap-3">
              <ZapIcon className="h-4 w-4" />
              Render-blocking CSS delaying first paint by 540 ms.
            </div>
            <div className="flex items-center gap-3">
              <ShieldIcon className="h-4 w-4" />
              Missing `Content-Security-Policy` and weak cookie flags.
            </div>
            <div className="flex items-center gap-3">
              <TimerIcon className="h-4 w-4" />
              Quick wins ready with step-by-step remediation paths.
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
