import Link from "next/link";
import { Button } from "@/components/shared/button";
import { Card } from "@/components/shared/card";
import { CategoryGrid } from "@/components/audit/CategoryGrid";
import { OverallScore } from "@/components/audit/OverallScore";

export default function SamplePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-12 md:px-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">Sample report</p>
          <h1 className="mt-3 font-display text-3xl uppercase sm:text-5xl">Reference Audit Snapshot</h1>
        </div>
        <Link href="/signup">
          <Button>Unlock Full Reports</Button>
        </Link>
      </div>
      <Card className="p-8">
        <OverallScore score={81} />
      </Card>
      <CategoryGrid
        scores={{ performance: 88, seo: 79, security: 68, ux: 84, accessibility: 76, technical: 83 }}
        counts={{ performance: 4, seo: 6, security: 7, ux: 3, accessibility: 5, technical: 2 }}
      />
    </div>
  );
}
