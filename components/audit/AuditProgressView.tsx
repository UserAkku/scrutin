"use client";

import { useEffect, useState, useCallback } from "react";

/* ─── Types ─────────────────────────────────────────────────────────────────── */

type CategoryStatus = "queued" | "running" | "complete" | "error";

interface StatusPayload {
  id: string;
  status: string;
  progress: number;
  currentStep: string | null;
  elapsedMs: number;
  scores: {
    overall: number;
    performance: number;
    seo: number;
    security: number;
    ux: number;
    accessibility: number;
    technical: number;
  };
}

/* ─── Category metadata ─────────────────────────────────────────────────────── */

const CATEGORIES = [
  { key: "performance",   label: "Performance",   icon: "⚡", range: [0, 20] },
  { key: "seo",           label: "SEO",           icon: "🔍", range: [20, 37] },
  { key: "security",      label: "Security",      icon: "🛡", range: [37, 54] },
  { key: "accessibility", label: "Accessibility", icon: "♿", range: [54, 71] },
  { key: "ux",            label: "UX / UI",       icon: "🎨", range: [71, 88] },
  { key: "technical",     label: "Technical",     icon: "⚙️", range: [88, 100] },
] as const;

/* ─── Helper: derive per-category status from overall progress ───────────────── */

function getCategoryStatus(progress: number, range: readonly [number, number]): CategoryStatus {
  if (progress >= range[1]) return "complete";
  if (progress >= range[0]) return "running";
  return "queued";
}

/* ─── Status pill ───────────────────────────────────────────────────────────── */

function StatusPill({ status }: { status: CategoryStatus }) {
  const map: Record<CategoryStatus, { label: string; classes: string }> = {
    queued:   { label: "Queued",   classes: "bg-gray-200 text-gray-500 border-2 border-gray-400" },
    running:  { label: "Running",  classes: "bg-yellow-300 text-brutal-black border-2 border-brutal-black animate-pulse" },
    complete: { label: "Done",     classes: "bg-white text-brutal-black border-2 border-brutal-black" },
    error:    { label: "Error",    classes: "bg-red-500 text-white border-2 border-brutal-black" },
  };
  const { label, classes } = map[status];
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-widest ${classes}`}>
      {status === "complete" && <span className="mr-1">✓</span>}
      {label}
    </span>
  );
}

/* ─── Elapsed time formatter ────────────────────────────────────────────────── */

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/* ─── Browser Mockup with scan-line ────────────────────────────────────────── */

function BrowserMockup({ hostname, progress }: { hostname: string; progress: number }) {
  return (
    <div className="brutal-card w-full max-w-xl overflow-hidden bg-white">
      {/* Chrome bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b-brutal border-brutal-black bg-[var(--pastel-blue)]">
        <div className="flex gap-2">
          <span className="w-4 h-4 rounded-full border-2 border-brutal-black bg-white" />
          <span className="w-4 h-4 rounded-full border-2 border-brutal-black bg-white" />
          <span className="w-4 h-4 rounded-full border-2 border-brutal-black bg-white" />
        </div>
        <div className="flex-1 rounded-full px-4 py-1.5 flex items-center gap-2 bg-white border-2 border-brutal-black font-body font-bold text-brutal-black">
          <span className="text-green-500 text-lg leading-none">●</span>
          <span className="text-sm">https://{hostname}</span>
        </div>
      </div>

      {/* Scan viewport */}
      <div className="relative h-40 bg-[var(--bg)]">
        {/* Fake page skeleton lines */}
        <div className="p-5 space-y-4 opacity-50">
          <div className="h-4 w-3/5 rounded-full bg-brutal-black" />
          <div className="h-3 w-full rounded-full bg-brutal-black" />
          <div className="h-3 w-4/5 rounded-full bg-brutal-black" />
          <div className="h-3 w-2/3 rounded-full bg-brutal-black" />
        </div>
      </div>

      {/* Progress bar at bottom of browser */}
      <div className="h-4 w-full bg-white border-t-brutal border-brutal-black relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-[var(--pastel-pink)] border-r-brutal border-brutal-black"
          style={{ width: `${progress}%`, transition: "width 0.6s ease" }}
        />
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────────────── */

interface AuditProgressViewProps {
  auditId: string;
  hostname: string;
  initialProgress: number;
  initialStatus: string;
  initialStep: string | null;
}

export function AuditProgressView({
  auditId,
  hostname,
  initialProgress,
  initialStatus,
  initialStep,
}: AuditProgressViewProps) {
  const [progress, setProgress] = useState(initialProgress);
  const [status, setStatus] = useState(initialStatus);
  const [elapsed, setElapsed] = useState(0);
  const [dots, setDots] = useState(".");

  /* Animated ellipsis for step label */
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? "." : d + ".")), 600);
    return () => clearInterval(id);
  }, []);

  /* Poll /api/audit/[id]/status every 3 seconds */
  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/audit/${auditId}/status`, { cache: "no-store" });
      if (!res.ok) return;
      const data: StatusPayload = await res.json();

      setProgress(data.progress ?? 0);
      setStatus(data.status);
      setElapsed(data.elapsedMs ?? 0);

      if (data.status === "complete") {
        window.location.reload();
      }
    } catch {
      // Network hiccup — silently retry next interval
    }
  }, [auditId]);

  useEffect(() => {
    if (status === "complete" || status === "error") return;
    poll();                                      // immediate first poll
    const id = setInterval(poll, 3000);          // then every 3 s
    return () => clearInterval(id);
  }, [poll, status]);

  const completedCount = CATEGORIES.filter(
    ({ range }) => getCategoryStatus(progress, range) === "complete"
  ).length;

  // Sync the top level label with whatever the progress bar actually shows as running
  const runningCategory = CATEGORIES.find(
    ({ range }) => getCategoryStatus(progress, range) === "running"
  );
  const displayStep = status === "complete" ? "Complete" : (runningCategory?.label || "Processing");

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-4 py-16 gap-12 bg-[var(--bg)]">
      
      {/* ── Header ── */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full border-[3px] border-brutal-black bg-white text-brutal-black font-bold uppercase tracking-widest text-sm">
          <span className="w-3 h-3 rounded-full bg-yellow-400 border-2 border-brutal-black animate-pulse" />
          Audit in progress
        </div>
        <h1 className="text-5xl sm:text-7xl font-display text-brutal-black uppercase">
          Scanning <br/>
          <span className="bg-white px-4 border-brutal border-brutal-black inline-block mt-2">{hostname}</span>
        </h1>
        <p className="text-lg max-w-md mx-auto font-body font-bold text-brutal-black mt-6">
          You can safely close this tab. We're running the audit in the background and results will be ready soon.
        </p>
      </div>

      {status === "error" ? (
        <div className="w-full max-w-xl brutal-card p-8 bg-[#FFCBEB] text-center space-y-6">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-4xl font-display uppercase text-brutal-black">Audit Failed</h2>
          <p className="text-lg font-body font-bold text-brutal-black/80">
            The audit process was interrupted or encountered an error. This usually happens if the target URL is unreachable or the process was cancelled.
          </p>
          <a href="/" className="inline-flex bg-brutal-black text-white font-display border-2 border-brutal-black rounded-xl px-6 py-3 uppercase tracking-wider transition-transform hover:-translate-y-1">Start New Audit</a>
        </div>
      ) : (
        <>
          {/* ── Browser mockup ── */}
          <BrowserMockup hostname={hostname} progress={progress} />

      {/* ── Progress numbers ── */}
      <div className="w-full max-w-xl space-y-4">
        <div className="flex items-end justify-between text-brutal-black">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest mb-1">
              Current step
            </p>
            <p className="text-2xl font-display uppercase">
              {displayStep}{dots}
            </p>
          </div>
          <div className="text-right">
            <p className="text-6xl font-display leading-none">
              {progress}%
            </p>
            {elapsed > 0 && (
              <p className="text-sm font-bold mt-2">
                {formatElapsed(elapsed)} elapsed
              </p>
            )}
          </div>
        </div>

        {/* Master progress bar */}
        <div className="h-6 w-full border-[3px] border-brutal-black rounded-full bg-white overflow-hidden p-1">
          <div
            className="h-full bg-brutal-black rounded-full"
            style={{ width: `${progress}%`, transition: "width 0.8s ease" }}
          />
        </div>
        <p className="text-sm font-bold text-right text-brutal-black">
          {completedCount} / {CATEGORIES.length} categories complete
        </p>
      </div>

      {/* ── Category pills grid ── */}
      <div className="w-full max-w-xl grid grid-cols-2 sm:grid-cols-3 gap-4">
        {CATEGORIES.map(({ key, label, icon, range }, i) => {
          const catStatus = getCategoryStatus(progress, range);
          const bgColors = ["var(--pastel-blue)", "var(--pastel-pink)", "var(--pastel-green)", "var(--pastel-yellow)", "white", "var(--pastel-blue)"];
          return (
            <div
              key={key}
              className="brutal-card p-4 flex flex-col gap-3 relative"
              style={{ backgroundColor: bgColors[i] }}
            >
              <div className="brutal-badge -top-2 -right-2 bg-white w-6 h-6 text-xs">
                {i + 1}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-2xl" role="img" aria-label={label}>{icon}</span>
                <StatusPill status={catStatus} />
              </div>
              <p className="text-sm font-bold uppercase tracking-wide text-brutal-black font-body">
                {label}
              </p>
            </div>
          );
        })}
      </div>
        </>
      )}

    </div>
  );
}
