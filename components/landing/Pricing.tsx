import { Card } from "@/components/shared/card";
import { Button } from "@/components/shared/button";
import { CheckIcon } from "@/components/shared/icons";

export function Pricing() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 md:px-8">
      <div className="mb-10">
        <p className="text-xs uppercase tracking-[0.22em] text-foreground/55">Pricing</p>
        <h2 className="mt-3 font-display text-3xl uppercase sm:text-4xl">Start Free. Scale Later.</h2>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-8">
          <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">Free</p>
          <h3 className="mt-4 font-display text-4xl uppercase">$0</h3>
          <p className="mt-3 text-sm leading-7 text-foreground/70">Partial guest audits, full account dashboard, 10 saved audits per day, and shareable reports.</p>
          <div className="mt-8 space-y-4 text-sm">
            {["10 audits/day", "Full report after signup", "History for last 20 audits", "PDF export"].map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <CheckIcon className="h-4 w-4" />
                {feature}
              </div>
            ))}
          </div>
          <Button className="mt-8">Create Free Account</Button>
        </Card>
        <Card className="bg-black p-8 text-background shadow-brutal">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.18em] text-background/55">Pro</p>
            <span className="border border-white/25 px-3 py-1 text-[10px] uppercase tracking-[0.18em]">Coming Soon</span>
          </div>
          <h3 className="mt-4 font-display text-4xl uppercase">$49</h3>
          <p className="mt-3 text-sm leading-7 text-background/75">Higher volume, white-labeled PDFs, client workspaces, scheduled re-audits, and deeper competitive tracking.</p>
          <div className="mt-8 space-y-4 text-sm">
            {["Unlimited audits", "Agency-ready exports", "Branded public links", "Priority queue"].map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <CheckIcon className="h-4 w-4" />
                {feature}
              </div>
            ))}
          </div>
          <Button variant="secondary" className="mt-8 border-white bg-background text-black">Notify Me</Button>
        </Card>
      </div>
    </section>
  );
}
