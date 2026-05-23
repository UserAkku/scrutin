"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/shared/button";

type AuditRow = {
  id: string;
  url: string;
  hostname: string;
  faviconUrl: string | null;
  status: string;
  progress: number;
  overallScore: number;
  performanceScore: number;
  seoScore: number;
  securityScore: number;
  uxScore: number;
  accessibilityScore: number;
  technicalScore: number;
  targetTitle: string | null;
  techStack: Record<string, string> | null;
  isPublic: boolean;
  isGuest: boolean;
  createdAt: string;
  jobCompletedAt: string | null;
  issueCount: number;
};

type Props = {
  user: { name: string | null; email: string; plan: string; auditsToday: number; memberSince: string };
  audits: AuditRow[];
  stats: { total: number; avgScore: number; totalIssues: number; running: number };
};

const PASTEL_COLORS = ["var(--pastel-blue)", "var(--pastel-pink)", "var(--pastel-green)", "var(--pastel-yellow)"];

function CustomSelect({ 
  value, 
  onChange, 
  options 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  options: { label: string; value: string }[] 
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div className="relative">
      <button 
        onClick={() => setOpen(!open)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="brutal-input text-lg font-bold uppercase cursor-pointer bg-white flex items-center justify-between min-w-[180px] w-full text-left"
      >
        <span>{selectedOption.label}</span>
        <ChevronDown className="w-5 h-5 ml-2 text-brutal-black" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-2 w-full bg-white border-[3px] border-brutal-black rounded-xl z-50 overflow-hidden flex flex-col">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-4 py-3 font-bold uppercase text-brutal-black hover:bg-[var(--pastel-yellow)] transition-colors border-b-2 border-brutal-black/10 last:border-0 ${value === opt.value ? 'bg-[var(--pastel-yellow)]' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AuditCard({ audit, index }: { audit: AuditRow & { revision?: number }; index: number }) {
  const date = new Date(audit.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const bg = PASTEL_COLORS[index % PASTEL_COLORS.length];
  
  return (
    <Link href={`/audit/${audit.id}`} className="block relative group">
      <div 
        className={`brutal-card p-6 relative flex flex-col sm:flex-row gap-6 items-start sm:items-center hover:-translate-y-2 transition-all duration-300`}
        style={{ backgroundColor: bg }}
      >
        <div className="brutal-badge -top-4 -left-4 text-xl w-10 h-10 font-bold bg-white">
          {index + 1 < 10 ? `0${index + 1}` : index + 1}
        </div>
        
        <div className="flex-1 min-w-0 w-full overflow-hidden">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap mb-2 w-full">
            <h3 className="text-xl sm:text-2xl font-display uppercase truncate text-brutal-black max-w-full">
              {audit.hostname}
            </h3>
            {audit.status === "complete" ? (
              <span className="bg-white border-2 border-brutal-black px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-bold uppercase rounded-full">Done</span>
            ) : audit.status === "error" ? (
              <span className="bg-[#FF4444] text-white border-2 border-brutal-black px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-bold uppercase rounded-full">Failed</span>
            ) : (
              <span className="bg-yellow-300 border-2 border-brutal-black px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-bold uppercase rounded-full animate-pulse">Running {audit.progress}%</span>
            )}

          </div>
          <p className="font-body text-brutal-black/80 font-bold text-xs sm:text-sm mb-4 truncate w-full">
            {audit.targetTitle || audit.url}
          </p>
          <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs font-bold uppercase font-body text-brutal-black/80 flex-wrap">
            <span className="border-2 border-brutal-black/30 rounded px-1.5 py-0.5 sm:px-2 sm:py-1 bg-white/50">{date}</span>
            {audit.issueCount > 0 && <span className="border-2 border-red-500/50 rounded px-1.5 py-0.5 sm:px-2 sm:py-1 bg-red-100 text-red-900">⚠️ {audit.issueCount} Issues</span>}
            {(audit.revision ?? 0) > 0 && (
              <span className="bg-[var(--pastel-blue)] border-2 border-brutal-black px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-brutal-black">
                {audit.revision === 1 ? "Revised" : `Revised ${audit.revision}`}
              </span>
            )}
          </div>
        </div>

        {audit.status === "complete" && (
          <div className="flex flex-col items-center justify-center bg-white border-[3px] border-brutal-black rounded-xl p-4 min-w-[100px] sm:min-w-[120px] mt-4 sm:mt-0 w-full sm:w-auto">
            <span className="text-xs sm:text-sm font-bold uppercase font-body text-brutal-black mb-1">Score</span>
            <span className="text-4xl sm:text-5xl font-display text-brutal-black">{audit.overallScore}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

export function DashboardClient({ user, audits, stats }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "complete" | "running">("all");
  const [sortBy, setSortBy] = useState<"date" | "score">("date");

  const auditsWithRevisions = useMemo(() => {
    const urlGroups = new Map<string, AuditRow[]>();
    const chronologicalAudits = [...audits].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    chronologicalAudits.forEach(audit => {
      const group = urlGroups.get(audit.url) || [];
      group.push(audit);
      urlGroups.set(audit.url, group);
    });
    
    return audits.map(audit => {
      const group = urlGroups.get(audit.url) || [];
      const revisionIndex = group.findIndex(a => a.id === audit.id);
      return {
        ...audit,
        revision: revisionIndex > 0 ? revisionIndex : 0
      };
    });
  }, [audits]);

  const filtered = useMemo(() => {
    let list = auditsWithRevisions;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) => {
        const matchHost = a.hostname.toLowerCase().startsWith(q);
        const matchTitle = (a.targetTitle ?? "").toLowerCase().split(/\s+/).some(w => w.startsWith(q));
        return matchHost || matchTitle;
      });
    }
    if (filter === "complete") list = list.filter((a) => a.status === "complete");
    if (filter === "running") list = list.filter((a) => a.status === "running" || a.status === "pending");
    if (sortBy === "score") list = [...list].sort((a, b) => b.overallScore - a.overallScore);
    return list;
  }, [auditsWithRevisions, search, filter, sortBy]);

  const initials = user.name ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : user.email[0].toUpperCase();

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-8 py-8 sm:py-12 md:py-20">
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-10 sm:mb-16">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-[3px] border-brutal-black bg-[var(--pastel-yellow)] flex items-center justify-center text-3xl sm:text-4xl font-display text-brutal-black flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl sm:text-5xl font-display uppercase tracking-tight text-brutal-black truncate max-w-full">
              {user.name ?? "Dashboard"}
            </h1>
            <p className="font-body font-bold text-sm sm:text-lg text-brutal-black/70 mt-1 truncate">{user.email}</p>
          </div>
        </div>
        <Link href="/" className="w-full sm:w-auto flex-shrink-0">
          <Button size="lg" className="w-full sm:w-auto text-lg sm:text-xl flex items-center justify-center gap-2">NEW AUDIT <Plus className="w-5 h-5 stroke-[3]" /></Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-10 sm:mb-16">
        {[
          { label: "Total Audits", value: stats.total, color: "var(--pastel-blue)" },
          { label: "Avg Score", value: stats.avgScore, color: "var(--pastel-pink)" },
          { label: "Issues", value: stats.totalIssues, color: "var(--pastel-green)" },
          { label: "Daily Limit", value: `${user.auditsToday}/10`, color: "var(--pastel-yellow)" },
        ].map((stat, i) => (
          <div key={stat.label} className="brutal-card p-4 sm:p-6 bg-white relative" style={{ backgroundColor: stat.color }}>
            <div className="brutal-badge -top-3 -right-3 text-[10px] sm:text-xs bg-white w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-full border-2 border-brutal-black font-sans">0{i+1}</div>
            <div className="text-4xl sm:text-5xl md:text-6xl font-display text-brutal-black mb-1 sm:mb-2 truncate">{stat.value}</div>
            <div className="font-body font-bold text-[10px] sm:text-sm uppercase tracking-widest text-brutal-black/80 truncate">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-10">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="SEARCH DOMAINS..."
          className="brutal-input flex-1 text-lg font-bold uppercase placeholder:normal-case placeholder:text-gray-500"
        />
        <CustomSelect 
          value={filter} 
          onChange={(v) => setFilter(v as any)} 
          options={[
            { value: "all", label: "ALL STATUS" },
            { value: "complete", label: "COMPLETED" },
            { value: "running", label: "RUNNING" }
          ]} 
        />
        <CustomSelect 
          value={sortBy} 
          onChange={(v) => setSortBy(v as any)} 
          options={[
            { value: "date", label: "NEWEST" },
            { value: "score", label: "TOP SCORE" }
          ]} 
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-32 bg-white brutal-card border-dashed">
          <h2 className="text-4xl font-display uppercase mb-4 text-brutal-black">No Audits Found</h2>
          <Link href="/"><Button>START YOUR FIRST AUDIT</Button></Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {filtered.map((audit, i) => <AuditCard key={audit.id} audit={audit} index={i} />)}
        </div>
      )}
    </div>
  );
}
