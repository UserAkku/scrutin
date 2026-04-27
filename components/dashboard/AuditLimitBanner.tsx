import { Card } from "@/components/shared/card";

export function AuditLimitBanner({ auditsToday }: { auditsToday: number }) {
  return (
    <Card className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1">
        <p className="text-[10px] uppercase tracking-[0.18em] text-foreground/55 sm:text-xs">Free plan usage</p>
        <h2 className="mt-2 font-display text-base uppercase leading-snug sm:text-xl md:text-2xl">{auditsToday}/10 audits used today</h2>
      </div>
      <div className="text-xs text-foreground/65 sm:max-w-[200px] sm:text-right sm:text-sm">The counter resets at midnight based on your latest recorded audit day.</div>
    </Card>
  );
}

