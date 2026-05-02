import type { AuditIssue } from "@/types/audit";

export type SecurityIssueSeverity = "critical" | "medium" | "low";

export interface SecurityModuleResult {
  moduleName: string;
  issues: Omit<AuditIssue, "category">[];
  passedChecks: string[];
  score: number;
  data: Record<string, unknown>;
}

export interface HeaderCheck {
  name: string;
  header: string;
  pass: boolean;
  value: string | null;
  weight: number;
  description: string;
}

/** Timeout-aware fetch helper — all security network calls must use this */
export async function safeFetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = 10000
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Redact a secret value for display — show first N chars + ellipsis */
export function redactSecret(value: string, visibleChars = 12): string {
  if (value.length <= visibleChars) return "***";
  return value.slice(0, visibleChars) + "...";
}

/** Compare simple semver strings (a < b returns -1, equal 0, a > b returns 1) */
export function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}
