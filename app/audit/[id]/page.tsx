import Link from "next/link";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { Card } from "@/components/shared/card";
import { Button } from "@/components/shared/button";
import { AuditProgress } from "@/components/audit/AuditProgress";
import { OverallScore } from "@/components/audit/OverallScore";
import { CategoryGrid } from "@/components/audit/CategoryGrid";
import { IssueList } from "@/components/audit/IssueList";
import { LockedOverlay } from "@/components/audit/LockedOverlay";
import { ShareReport } from "@/components/audit/ShareReport";
import { CoreWebVitals } from "@/components/audit/CoreWebVitals";
import { SecurityDetails } from "@/components/audit/SecurityDetails";
import { SEODetails } from "@/components/audit/SEODetails";
import { UXDetails } from "@/components/audit/UXDetails";
import { AccessibilityDetails } from "@/components/audit/AccessibilityDetails";
import { TechnicalDetails } from "@/components/audit/TechnicalDetails";
import { auth } from "@/lib/auth";
import { getAuditForViewer, getQuickWins } from "@/lib/audit-access";
import { formatDate } from "@/lib/utils";

const PDFExport = dynamic(
  () => import("@/components/audit/PDFExport").then((mod) => mod.PDFExport),
  { ssr: false }
);

export default async function AuditPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const audit = await getAuditForViewer(params.id, session?.user?.id);

  if (!audit) {
    notFound();
  }

  const categoryIssues = {
    performance: audit.issues.filter((issue) => issue.category === "performance"),
    seo: audit.issues.filter((issue) => issue.category === "seo"),
    security: audit.issues.filter((issue) => issue.category === "security"),
    ux: audit.issues.filter((issue) => issue.category === "ux"),
    accessibility: audit.issues.filter((issue) => issue.category === "accessibility"),
    technical: audit.issues.filter((issue) => issue.category === "technical")
  };

  const scores = {
    performance: audit.performanceScore,
    seo: audit.seoScore,
    security: audit.securityScore,
    ux: audit.uxScore,
    accessibility: audit.accessibilityScore,
    technical: audit.technicalScore
  };

  const quickWins = getQuickWins(audit.issues);
  const locked = audit.isGuest;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-12 md:px-8">
      <Card className="p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {audit.faviconUrl ? (
                <img src={audit.faviconUrl} alt="" width={32} height={32} className="rounded-full border border-black/10" />
              ) : null}
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">Audit report</p>
                <h1 className="mt-2 break-all font-display text-2xl uppercase sm:text-4xl">{audit.url}</h1>
              </div>
            </div>
            <p className="text-sm text-foreground/65">Created {formatDate(audit.createdAt)}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <PDFExport
              audit={{
                url: audit.url,
                overallScore: audit.overallScore,
                issues: audit.issues.map((issue) => ({
                  title: issue.title,
                  severity: issue.severity,
                  fixSuggestion: issue.fixSuggestion
                }))
              }}
            />
            <Link href="/dashboard">
              <Button variant="secondary">Dashboard</Button>
            </Link>
          </div>
        </div>
      </Card>

      {audit.status !== "complete" ? <AuditProgress auditId={audit.id} /> : null}

      <Card className="p-8">
        <OverallScore score={audit.overallScore} />
      </Card>

      <CategoryGrid
        scores={scores}
        counts={Object.fromEntries(Object.entries(categoryIssues).map(([key, value]) => [key, value.length]))}
      />

      <Card className="p-8">
        <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">Quick wins</p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {quickWins.map((item) => (
            <div key={`${item.category}-${item.title}`} className="border border-black/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">{item.category}</p>
              <h3 className="mt-2 font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-7 text-foreground/70">{item.fixSuggestion}</p>
            </div>
          ))}
        </div>
      </Card>

      <ShareReport auditId={audit.id} initialIsPublic={audit.isPublic} canEdit={session?.user?.id === audit.userId} />

      <div className="space-y-6">
        <Card className="p-8">
          <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">Performance</p>
          <div className="mt-5 space-y-6">
            <CoreWebVitals metrics={((audit.performanceData as { metrics?: Array<{ label: string; displayValue: string; rating: string }> } | null)?.metrics) ?? []} />
            <IssueList issues={categoryIssues.performance} />
          </div>
        </Card>

        <Card className="p-8">
          <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">SEO</p>
          <div className="mt-5 space-y-6">
            <SEODetails data={audit.seoData as Record<string, unknown> | null} />
            <IssueList issues={categoryIssues.seo} />
          </div>
        </Card>

        <div className="relative">
          <Card className="p-8">
            <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">Security</p>
            <div className="mt-5 space-y-6">
              <SecurityDetails data={audit.securityData as Record<string, unknown> | null} />
              <IssueList issues={categoryIssues.security} />
            </div>
          </Card>
          {locked ? <LockedOverlay /> : null}
        </div>

        <div className="relative">
          <Card className="p-8">
            <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">UX / UI</p>
            <div className="mt-5 space-y-6">
              <UXDetails data={audit.uxData as Record<string, unknown> | null} />
              <IssueList issues={categoryIssues.ux} />
            </div>
          </Card>
          {locked ? <LockedOverlay /> : null}
        </div>

        <div className="relative">
          <Card className="p-8">
            <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">Accessibility</p>
            <div className="mt-5 space-y-6">
              <AccessibilityDetails data={audit.accessibilityData as Record<string, unknown> | null} />
              <IssueList issues={categoryIssues.accessibility} />
            </div>
          </Card>
          {locked ? <LockedOverlay /> : null}
        </div>

        <Card className="p-8">
          <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">Technical</p>
          <div className="mt-5 space-y-6">
            <TechnicalDetails data={audit.technicalData as Record<string, unknown> | null} />
            <IssueList issues={categoryIssues.technical} />
          </div>
        </Card>
      </div>
    </div>
  );
}
