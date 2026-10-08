"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Trash2, RefreshCw } from "lucide-react";
import { deleteAuditAction } from "@/lib/actions";
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
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CategoryTab>("performance");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReauditing, setIsReauditing] = useState(false);
  const isOwner = currentUserId === audit.userId;
  const locked = audit.isGuest;

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this audit?")) return;
    setIsDeleting(true);
    try {
      await deleteAuditAction(audit.id);
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      alert("Failed to delete audit");
      setIsDeleting(false);
    }
  };

  const handleReaudit = async () => {
    setIsReauditing(true);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: audit.url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start audit");
      router.push(`/audit/${data.auditId}`);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to re-audit");
      setIsReauditing(false);
    }
  };

  const [linkCopied, setLinkCopied] = useState(false);
  const handleCopyLink = () => {
    const url = `${window.location.origin}/audit/${audit.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    });
  };

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

  const TABS: { id: CategoryTab; label: string; isLocked: boolean; score: number | string; color: string }[] = [
    { id: "performance", label: "Performance", isLocked: false, score: audit.performanceData?.error ? "N/A" : scores.performance, color: "var(--pastel-blue)" },
    { id: "seo", label: "SEO", isLocked: false, score: audit.seoData?.error ? "N/A" : scores.seo, color: "var(--pastel-pink)" },
    { id: "security", label: "Security", isLocked: locked, score: audit.securityData?.error ? "N/A" : scores.security, color: "var(--pastel-green)" },
    { id: "accessibility", label: "A11y", isLocked: locked, score: audit.accessibilityData?.error ? "N/A" : scores.accessibility, color: "var(--pastel-yellow)" },
    { id: "ux", label: "UX / UI", isLocked: locked, score: audit.uxData?.error ? "N/A" : scores.ux, color: "white" },
    { id: "technical", label: "Technical", isLocked: false, score: audit.technicalData?.error ? "N/A" : scores.technical, color: "var(--pastel-blue)" },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white border-b-brutal border-brutal-black">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-3 min-h-16 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-4 w-full sm:flex-1 min-w-0">
            {audit.faviconUrl && (
              <img src={audit.faviconUrl} alt="Favicon" className="w-6 h-6 sm:w-8 sm:h-8 rounded-none bg-transparent flex-shrink-0" />
            )}
            <h1 className="font-display text-xl sm:text-2xl uppercase tracking-wider truncate text-brutal-black flex-1 min-w-0 overflow-hidden">
              {audit.hostname}
            </h1>
            <div className="flex items-center gap-2 ml-auto sm:ml-4 flex-shrink-0">
              <button 
                onClick={handleReaudit}
                disabled={isReauditing}
                className="p-1.5 sm:p-2 bg-white rounded-lg border-[2px] border-brutal-black hover:bg-[var(--pastel-blue)] transition-colors disabled:opacity-50"
                title="Run New Audit"
              >
                <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 text-brutal-black ${isReauditing ? 'animate-spin' : ''}`} />
              </button>
              {isOwner && (
                <button 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="p-1.5 sm:p-2 bg-white rounded-lg border-[2px] border-brutal-black hover:bg-[#FF8080] transition-colors disabled:opacity-50"
                  title="Delete Audit"
                >
                  <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-brutal-black" />
                </button>
              )}
            </div>
          </div>
          <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
            {!locked ? (
              <>
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-1.5 sm:px-6 sm:py-2 bg-white text-brutal-black font-display text-sm sm:text-base uppercase tracking-wider rounded-lg border-[2px] border-brutal-black hover:bg-[var(--pastel-green)] transition-colors flex items-center justify-center gap-2 h-full w-full"
                >
                  {linkCopied ? "✓ Link Copied!" : "🔗 Share Report"}
                </button>
                <PDFExport
                  audit={{
                    url: audit.url,
                    overallScore: audit.overallScore,
                    issues: audit.issues,
                  }}
                />
              </>
            ) : (
              <button
                disabled
                className="px-4 py-1.5 sm:px-6 sm:py-2 bg-gray-200 text-gray-500 font-display text-sm sm:text-base uppercase tracking-wider rounded-lg border-[2px] border-gray-400 flex items-center justify-center gap-2 h-full w-full opacity-50 cursor-not-allowed"
                title="Sign up to unlock exports"
              >
                🔒 Export Locked
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-8 mt-8 sm:mt-12 space-y-8 sm:space-y-12">
        {/* Hero Score Section */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6 sm:gap-8">
          <div className="brutal-card p-6 sm:p-8 bg-[var(--pastel-blue)] relative min-h-[250px] sm:min-h-[300px] flex flex-col justify-center">
            <div className="brutal-badge -top-4 -right-4 bg-white text-xl w-12 h-12">★</div>
            <p className="font-body text-lg sm:text-xl font-bold text-brutal-black mb-4">Overall Structural Score</p>
            <h2 className="text-[5rem] sm:text-[8rem] leading-none font-display text-brutal-black">{audit.overallScore}%</h2>
            <p className="font-body font-bold text-brutal-black/70 mt-4">Based on {audit.issues.length} total issues found.</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {TABS.map((tab, i) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`brutal-card p-4 sm:p-6 relative flex flex-col items-start transition-all hover:-translate-y-2 focus:outline-none outline-none ${
                  activeTab === tab.id ? "-translate-y-1" : ""
                }`}
                style={{ backgroundColor: tab.color }}
              >
                <div className="brutal-badge -top-3 -right-3 bg-white w-6 h-6 sm:w-8 sm:h-8 text-xs sm:text-sm">0{i + 1}</div>
                <div className="flex w-full items-center justify-between mb-2 sm:mb-4">
                  <span className="font-body font-bold text-xs sm:text-sm uppercase tracking-wider text-brutal-black break-all sm:break-normal text-left">
                    {tab.label}
                  </span>
                  {tab.isLocked && (
                    <span className="text-[10px] sm:text-xs px-1.5 py-0.5 border-2 border-brutal-black bg-white font-bold uppercase rounded-full">Pro</span>
                  )}
                </div>
                <h3 className="text-4xl sm:text-6xl font-display text-brutal-black">{tab.score}</h3>
                <p className="mt-2 sm:mt-4 font-sans font-bold text-[10px] sm:text-xs text-brutal-black/70 uppercase tracking-widest text-left">
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
                <div key={i} className="bg-white brutal-card p-6 hover:-translate-y-1 transition-transform">
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
          {audit.url.replace(/^https?:\/\//, '').replace(/\/$/, '') !== audit.hostname && (
            <div className="bg-[#facc15] border-[3px] border-brutal-black p-4 mb-8 flex items-start gap-4">
              <span className="text-2xl mt-1">ℹ️</span>
              <div>
                <h4 className="font-display uppercase text-brutal-black text-xl mb-1">Audit Scope Information</h4>
                <p className="font-body text-brutal-black font-bold text-sm break-words">
                  Security and Technical audits are performed on the root domain (<span className="underline break-all">{audit.hostname}</span>), while Performance, SEO, and UX/UI checks analyze the exact URL provided (<span className="underline break-all">{audit.url}</span>).
                </p>
              </div>
            </div>
          )}

          {/* Tabs Navigation */}
          <div className="flex flex-wrap gap-4 mb-10 pb-6 border-b-[3px] border-brutal-black">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-2 border-[3px] border-brutal-black rounded-full font-display uppercase tracking-widest text-lg transition-transform ${
                  activeTab === tab.id
                    ? "bg-brutal-black text-white -translate-y-1"
                    : "bg-white text-brutal-black hover:-translate-y-1"
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
