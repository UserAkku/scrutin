"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/shared/button";
import { Card } from "@/components/shared/card";
import { CategoryGrid } from "@/components/audit/CategoryGrid";
import { OverallScore } from "@/components/audit/OverallScore";
import { IssueList } from "@/components/audit/IssueList";

const dummyIssues = {
  performance: [
    { id: "1", title: "Eliminate render-blocking resources", severity: "critical" as const, description: "Resources are blocking the first paint of your page.", fixSuggestion: "Inline critical JS/CSS and defer non-critical scripts." },
    { id: "2", title: "Serve images in next-gen formats", severity: "medium" as const, description: "Image formats like WebP provide better compression.", fixSuggestion: "Convert JPEGs and PNGs to WebP formats using an image CDN." },
  ],
  seo: [
    { id: "3", title: "Missing meta description", severity: "medium" as const, description: "Meta descriptions are important for CTR from search results.", fixSuggestion: "Add a concise, compelling <meta name=\"description\"> tag." },
  ],
  security: [
    { id: "4", title: "Missing Content-Security-Policy", severity: "critical" as const, description: "CSP prevents XSS attacks.", fixSuggestion: "Implement a strict CSP header on your origin server." },
    { id: "5", title: "Cookies missing Secure flag", severity: "medium" as const, description: "Cookies can be intercepted over HTTP.", fixSuggestion: "Add the 'Secure' attribute to all sensitive cookies." },
  ],
  ux: [
    { id: "6", title: "Tap targets are too small", severity: "medium" as const, description: "Interactive elements are too close together.", fixSuggestion: "Increase padding on buttons to at least 48x48px." },
  ]
};

export default function SamplePage() {
  const [unlocked, setUnlocked] = useState(false);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-12 md:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">Sample report</p>
          <h1 className="mt-3 font-display text-3xl uppercase sm:text-5xl">Reference Audit Snapshot</h1>
        </div>
        {!unlocked ? (
          <Button onClick={() => setUnlocked(true)}>Unlock Full Report</Button>
        ) : (
          <Link href="/signup">
            <Button variant="secondary">Create Account for Your Site</Button>
          </Link>
        )}
      </div>

      <Card className="p-8">
        <OverallScore score={81} />
      </Card>

      <CategoryGrid
        scores={{ performance: 88, seo: 79, security: 68, ux: 84, accessibility: 76, technical: 83 }}
        counts={{ performance: 2, seo: 1, security: 2, ux: 1, accessibility: 0, technical: 0 }}
      />

      {unlocked ? (
        <div className="space-y-6 mt-8 animate-in fade-in duration-700 slide-in-from-bottom-4">
          <Card className="p-8">
            <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">Performance</p>
            <div className="mt-5 space-y-6">
              <IssueList issues={dummyIssues.performance} />
            </div>
          </Card>

          <Card className="p-8">
            <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">SEO</p>
            <div className="mt-5 space-y-6">
              <IssueList issues={dummyIssues.seo} />
            </div>
          </Card>

          <Card className="p-8">
            <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">Security</p>
            <div className="mt-5 space-y-6">
              <IssueList issues={dummyIssues.security} />
            </div>
          </Card>

          <Card className="p-8">
            <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">UX / UI</p>
            <div className="mt-5 space-y-6">
              <IssueList issues={dummyIssues.ux} />
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}