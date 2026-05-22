"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { getQuickWins } from "@/lib/audit-access";
import { IssueList } from "@/components/audit/IssueList";
import { CoreWebVitals } from "@/components/audit/CoreWebVitals";
import { SEODetails } from "@/components/audit/SEODetails";
import { SecurityDetails } from "@/components/audit/SecurityDetails";
import { UXDetails } from "@/components/audit/UXDetails";
import { AccessibilityDetails } from "@/components/audit/AccessibilityDetails";
import { TechnicalDetails } from "@/components/audit/TechnicalDetails";
import { LockedOverlay } from "@/components/audit/LockedOverlay";

const PDFExport = dynamic(
  () => import("@/components/audit/PDFExport").then((mod) => mod.PDFExport),
  { ssr: false }
);

type CategoryTab = "performance" | "seo" | "security" | "accessibility" | "ux" | "technical";

export function AuditReportClient({ audit, currentUserId }: { audit: any; currentUserId?: string }) {
  const [activeTab, setActiveTab] = useState<CategoryTab>("performance");
  const isOwner = currentUserId === audit.userId;
  const locked = audit.isGuest;

  const categoryIssues = useMemo(() => ({
    performance: audit.issues.filter((i: any) => i.category === "performance"),
    seo: audit.issues.filter((i: any) => i.category === "seo"),
    security: audit.issues.filter((i: any) => i.category === "security"),
    ux: audit.issues.filter((i: any) => i.category === "ux"),
    accessibility: audit.issues.filter((i: any) => i.category === "accessibility"),
    technical: audit.issues.filter((i: any) => i.category === "technical")
  }), [audit.issues]);

  const scores = {
    performance: audit.performanceScore,
    seo: audit.seoScore,
    security: audit.securityScore,
    ux: audit.uxScore,
    accessibility: audit.accessibilityScore,
    technical: audit.technicalScore
  };

  const quickWins = getQuickWins(audit.issues).slice(0, 4);

  const TABS: { id: CategoryTab; label: string; isLocked: boolean; score: number; color: string }[] = [
    { id: "performance", label: "Performance", isLocked: false, score: scores.performance, color: "var(--pastel-blue)" },
    { id: "seo", label: "SEO", isLocked: false, score: scores.seo, color: "var(--pastel-pink)" },
    { id: "security", label: "Security", isLocked: locked, score: scores.security, color: "var(--pastel-green)" },
    { id: "accessibility", label: "A11y", isLocked: locked, score: scores.accessibility, color: "var(--pastel-yellow)" },
    { id: "ux", label: "UX / UI", isLocked: locked, score: scores.ux, color: "white" },
    { id: "technical", label: "Technical", isLocked: false, score: scores.technical, color: "var(--pastel-blue)" },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white border-b-brutal border-brutal-black shadow-brutal">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {audit.faviconUrl && (
              <img src={audit.faviconUrl} alt="Favicon" className="w-8 h-8 rounded-none border-[2px] border-brutal-black bg-white" />
            )}
            <h1 className="font-display text-2xl uppercase tracking-wider truncate max-w-[200px] sm:max-w-[400px] text-brutal-black">
              {audit.hostname}
            </h1>
            <div className="hidden sm:flex items-center gap-2 px-4 py-1 border-[2px] border-brutal-black bg-[var(--pastel-yellow)] shadow-[2px_2px_0px_0px_#2D2323]">
              <span className="font-body font-bold text-xs uppercase">Overall Score</span>
              <span className="font-display text-xl">{audit.overallScore}%</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PDFExport
              audit={{
                url: audit.url,
                overallScore: audit.overallScore,
                issues: audit.issues,
              }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 mt-12 space-y-12">
        {/* Hero Score Section */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-8">
          <div className="brutal-card p-8 bg-[var(--pastel-blue)] relative min-h-[300px] flex flex-col justify-center">
            <div className="brutal-badge -top-4 -right-4 bg-white text-xl w-12 h-12">★</div>
            <p className="font-body text-xl font-bold text-brutal-black mb-4">Overall Structural Score</p>
            <h2 className="text-[8rem] leading-none font-display text-brutal-black">{audit.overallScore}%</h2>
            <p className="font-body font-bold text-brutal-black/70 mt-4">Based on {audit.issues.length} total issues found.</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {TABS.map((tab, i) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`brutal-card p-6 relative flex flex-col items-start transition-transform hover:-translate-y-2 hover:shadow-brutal-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-brutal-black ${
                  activeTab === tab.id ? "-translate-y-2 shadow-brutal-lg ring-4 ring-brutal-black ring-inset" : ""
                }`}
                style={{ backgroundColor: tab.color }}
              >
                <div className="brutal-badge -top-3 -right-3 bg-white w-8 h-8 text-sm">0{i + 1}</div>
                <div className="flex w-full items-center justify-between mb-4">
                  <span className="font-body font-bold text-sm uppercase tracking-wider text-brutal-black">
                    {tab.label}
                  </span>
                  {tab.isLocked && (
                    <span className="text-xs px-2 py-0.5 border-2 border-brutal-black bg-white font-bold uppercase rounded-full">Pro</span>
                  )}
                </div>
                <h3 className="text-6xl font-display text-brutal-black">{tab.score}</h3>
                <p className="mt-4 font-body font-bold text-xs text-brutal-black/70 uppercase">
                  {categoryIssues[tab.id].length} issues
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Quick Wins */}
        {quickWins.length > 0 && (
          <div className="brutal-card p-8 bg-[var(--pastel-green)] relative">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8 border-b-brutal border-brutal-black pb-4">
              <h2 className="text-4xl font-display uppercase text-brutal-black">Quick Wins</h2>
              <span className="font-body font-bold text-brutal-black/70">High impact, low effort fixes</span>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {quickWins.map((issue, i) => (
                <div key={i} className="bg-white brutal-card p-6 hover:-translate-y-1 hover:shadow-brutal-lg transition-transform">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs px-2 py-1 border-2 border-brutal-black font-bold uppercase tracking-wider bg-[var(--pastel-yellow)]">
                      {issue.category}
                    </span>
                    <span className="text-xs px-2 py-1 border-2 border-brutal-black font-bold uppercase tracking-wider bg-[#FF8080] text-white">
                      Critical
                    </span>
                  </div>
                  <h3 className="font-body font-bold text-xl text-brutal-black mb-2 leading-tight">{issue.title}</h3>
                  <p className="text-sm text-brutal-black font-medium">{issue.fixSuggestion}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category Deep Dive */}
        <div id="details" className="brutal-card p-8 bg-white min-h-[500px] relative">
          
          {/* Scope Info Banner */}
          <div className="bg-[#facc15] border-[3px] border-brutal-black p-4 mb-8 flex items-start gap-4 shadow-[4px_4px_0px_0px_#2D2323]">
            <span className="text-2xl mt-1">ℹ️</span>
            <div>
              <h4 className="font-display uppercase text-brutal-black text-xl mb-1">Audit Scope Information</h4>
              <p className="font-body text-brutal-black font-bold text-sm">
                Security and Technical audits are performed on the root domain (<span className="underline">{audit.hostname}</span>), while Performance, SEO, and UX/UI checks analyze the exact URL provided (<span className="underline">{audit.url}</span>).
              </p>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="flex flex-wrap gap-4 mb-10 pb-6 border-b-[3px] border-brutal-black">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-2 border-[3px] border-brutal-black rounded-full font-display uppercase tracking-widest text-lg transition-transform ${
                  activeTab === tab.id
                    ? "bg-brutal-black text-white -translate-y-1 shadow-[4px_4px_0px_0px_#C4F0FF]"
                    : "bg-white text-brutal-black hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#2D2323]"
                }`}
              >
                {tab.label}
                {tab.isLocked && " 🔒"}
              </button>
            ))}
          </div>

          {/* Active Tab Content */}
          <div className="relative">
            {activeTab === "performance" && (
              <div className="space-y-10">
                <CoreWebVitals metrics={audit.performanceData?.metrics ?? []} />
                <IssueList issues={categoryIssues.performance} />
              </div>
            )}
            
            {activeTab === "seo" && (
              <div className="space-y-10">
                <SEODetails data={audit.seoData} />
                <IssueList issues={categoryIssues.seo} />
              </div>
            )}
            
            {activeTab === "technical" && (
              <div className="space-y-10">
                <TechnicalDetails data={audit.technicalData} />
                <IssueList issues={categoryIssues.technical} />
              </div>
            )}

            {activeTab === "security" && (
              <div className="space-y-10 relative">
                <SecurityDetails data={audit.securityData} />
                <IssueList issues={categoryIssues.security} />
                {locked && <LockedOverlay />}
              </div>
            )}

            {activeTab === "ux" && (
              <div className="space-y-10 relative">
                <UXDetails data={audit.uxData} />
                <IssueList issues={categoryIssues.ux} />
                {locked && <LockedOverlay />}
              </div>
            )}

            {activeTab === "accessibility" && (
              <div className="space-y-10 relative">
                <AccessibilityDetails data={audit.accessibilityData} />
                <IssueList issues={categoryIssues.accessibility} />
                {locked && <LockedOverlay />}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
