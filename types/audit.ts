export type AuditCategory =
  | "performance"
  | "seo"
  | "security"
  | "ux"
  | "accessibility"
  | "technical";

export type IssueSeverity = "critical" | "medium" | "low";

export interface AuditIssue {
  id?: string;
  category: AuditCategory;
  severity: IssueSeverity;
  title: string;
  description: string;
  fixSuggestion: string;
  impact?: string | null;
  effort?: string | null;
}

export interface CategoryScore {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  issueCount: number;
}

export interface CategoryResult<TData = unknown> {
  category: AuditCategory;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  summary: string;
  issues: AuditIssue[];
  passedChecks: string[];
  data: TData;
}

export interface ProgressEvent {
  status: "queued" | "running" | "complete" | "error";
  category?: AuditCategory;
  score?: number;
  overallScore?: number;
  message?: string;
}

export interface AuditStreamState {
  categories: Partial<Record<AuditCategory, ProgressEvent>>;
  finished: boolean;
}

export interface KeywordDensity {
  term: string;
  count: number;
  density: number;
}

export interface PerformanceMetric {
  label: string;
  value: number;
  displayValue: string;
  rating: "good" | "needs-improvement" | "poor";
}

export interface ReportVisibilityPayload {
  isPublic: boolean;
}
