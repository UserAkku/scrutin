import { Card } from "@/components/shared/card";

export function AuditLimitBanner({ auditsToday }: { auditsToday: number }) {
  return (
    <Card className="flex items-center justify-between gap-4 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">Free plan usage</p>
        <h2 className="mt-2 font-display text-2xl uppercase">{auditsToday}/10 audits used today</h2>
      </div>
      <div className="text-sm text-foreground/65">The counter resets at midnight based on your latest recorded audit day.</div>
    </Card>
  );
}
