import { generateJson } from "@/lib/gemini";
import { getGrade } from "@/lib/utils";
import { scoreFromIssueDensity } from "@/lib/scoring";
import type { AuditIssue, CategoryResult } from "@/types/audit";
import { fetchHtmlSnapshot } from "@/lib/analyzers/shared";

interface HeaderCheck {
  name: string;
  header: string;
  pass: boolean;
  value: string | null;
  weight: number;
  description: string;
}

function checkSecurityHeaders(headers: Headers): HeaderCheck[] {
  const checks: HeaderCheck[] = [];

  // Content-Security-Policy
  const csp = headers.get("content-security-policy");
  checks.push({
    name: "Content-Security-Policy",
    header: "content-security-policy",
    pass: Boolean(csp),
    value: csp,
    weight: 25,
    description: "Mitigates XSS and data injection attacks by declaring allowed content sources."
  });

  // Strict-Transport-Security
  const hsts = headers.get("strict-transport-security");
  checks.push({
    name: "Strict-Transport-Security",
    header: "strict-transport-security",
    pass: Boolean(hsts),
    value: hsts,
    weight: 20,
    description: "Ensures the browser only connects over HTTPS."
  });

  // X-Content-Type-Options
  const xcto = headers.get("x-content-type-options");
  checks.push({
    name: "X-Content-Type-Options",
    header: "x-content-type-options",
    pass: xcto?.toLowerCase() === "nosniff",
    value: xcto,
    weight: 10,
    description: "Prevents MIME-type sniffing attacks."
  });

  // X-Frame-Options
  const xfo = headers.get("x-frame-options");
  checks.push({
    name: "X-Frame-Options",
    header: "x-frame-options",
    pass: Boolean(xfo),
    value: xfo,
    weight: 10,
    description: "Protects against clickjacking by controlling iframe embedding."
  });

  // Referrer-Policy
  const rp = headers.get("referrer-policy");
  checks.push({
    name: "Referrer-Policy",
    header: "referrer-policy",
    pass: Boolean(rp),
    value: rp,
    weight: 5,
    description: "Controls how much referrer information is passed with outgoing requests."
  });

  // Permissions-Policy (formerly Feature-Policy)
  const pp = headers.get("permissions-policy") ?? headers.get("feature-policy");
  checks.push({
    name: "Permissions-Policy",
    header: "permissions-policy",
    pass: Boolean(pp),
    value: pp,
    weight: 5,
    description: "Restricts browser features like camera, microphone, and geolocation."
  });

  // X-XSS-Protection (legacy but still checked)
  const xxss = headers.get("x-xss-protection");
  checks.push({
    name: "X-XSS-Protection",
    header: "x-xss-protection",
    pass: Boolean(xxss),
    value: xxss,
    weight: 5,
    description: "Legacy XSS filter header for older browsers."
  });

  // Cross-Origin-Opener-Policy
  const coop = headers.get("cross-origin-opener-policy");
  checks.push({
    name: "Cross-Origin-Opener-Policy",
    header: "cross-origin-opener-policy",
    pass: Boolean(coop),
    value: coop,
    weight: 5,
    description: "Isolates the browsing context to prevent cross-origin attacks."
  });

  // Cross-Origin-Resource-Policy
  const corp = headers.get("cross-origin-resource-policy");
  checks.push({
    name: "Cross-Origin-Resource-Policy",
    header: "cross-origin-resource-policy",
    pass: Boolean(corp),
    value: corp,
    weight: 5,
    description: "Controls which origins can load resources from the server."
  });

  // Server header leaking info
  const server = headers.get("server");
  checks.push({
    name: "Server Header Hidden",
    header: "server",
    pass: !server || server.toLowerCase() === "nginx" || server.toLowerCase() === "cloudflare",
    value: server,
    weight: 5,
    description: "Server header should not expose detailed version information."
  });

  // X-Powered-By
  const xpb = headers.get("x-powered-by");
  checks.push({
    name: "X-Powered-By Hidden",
    header: "x-powered-by",
    pass: !xpb,
    value: xpb,
    weight: 5,
    description: "Should be removed to avoid exposing technology stack details."
  });

  return checks;
}

function calculateHeaderScore(checks: HeaderCheck[]): number {
  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const earned = checks.filter((c) => c.pass).reduce((sum, c) => sum + c.weight, 0);
  return Math.round((earned / totalWeight) * 100);
}

export async function analyzeSecurity(targetUrl: string): Promise<CategoryResult> {
  const snapshot = await fetchHtmlSnapshot(targetUrl);
  const { headers, root, url } = snapshot;

  const checks = checkSecurityHeaders(headers);
  const headerScore = calculateHeaderScore(checks);

  // Check HTTPS
  const isHttps = url.startsWith("https://");

  // Check for mixed content indicators in HTML
  const mixedContent = root
    .querySelectorAll("script[src], link[href], img[src], iframe[src]")
    .filter((el) => {
      const src = el.getAttribute("src") ?? el.getAttribute("href") ?? "";
      return src.startsWith("http://");
    }).length;

  // Check cookie flags (from set-cookie headers)
  const setCookies = headers.get("set-cookie") ?? "";
  const hasSecureCookies = !setCookies || setCookies.toLowerCase().includes("secure");
  const hasHttpOnlyCookies = !setCookies || setCookies.toLowerCase().includes("httponly");

  const failedChecks = checks.filter((c) => !c.pass);

  // Build fallback issues from failed checks
  const fallbackIssues: Omit<AuditIssue, "category">[] = failedChecks.map((check) => ({
    title: `Missing ${check.name}`,
    description: check.description,
    fixSuggestion: `Add the ${check.name} header to your server response. ${
      check.header === "content-security-policy"
        ? "Start with a report-only policy and iteratively tighten it."
        : check.header === "strict-transport-security"
          ? "Set 'Strict-Transport-Security: max-age=31536000; includeSubDomains'."
          : `Configure the ${check.header} header on your web server or CDN.`
    }`,
    severity: check.weight >= 20 ? ("critical" as const) : check.weight >= 10 ? ("medium" as const) : ("low" as const),
    impact: `Security score impact: -${check.weight} points`,
    effort: "10-30 minutes"
  }));

  if (!isHttps) {
    fallbackIssues.unshift({
      title: "Site not served over HTTPS",
      description: "The page is served over plain HTTP, exposing all traffic to interception.",
      fixSuggestion: "Obtain a TLS certificate and redirect all HTTP traffic to HTTPS.",
      severity: "critical",
      impact: "All data is transmitted in plaintext.",
      effort: "30 minutes"
    });
  }

  if (mixedContent > 0) {
    fallbackIssues.push({
      title: "Mixed content detected",
      description: `${mixedContent} resource(s) are loaded over HTTP on an HTTPS page.`,
      fixSuggestion: "Update all resource URLs to use HTTPS or protocol-relative URLs.",
      severity: "medium",
      impact: "Browsers may block insecure resources, breaking page functionality.",
      effort: "15 minutes"
    });
  }

  // Try AI analysis for richer insights
  let aiResponse:
    | {
        summary: string;
        issues: Array<{
          title: string;
          description: string;
          fixSuggestion: string;
          severity: "critical" | "medium" | "low";
          impact: string;
          effort: string;
        }>;
      }
    | null = null;

  try {
    aiResponse = await generateJson<{
      summary: string;
      issues: Array<{
        title: string;
        description: string;
        fixSuggestion: string;
        severity: "critical" | "medium" | "low";
        impact: string;
        effort: string;
      }>;
    }>(
      `You are an application security engineer. Analyze these HTTP security header results and return JSON with "summary" and "issues".
Each issue must have: title, description, fixSuggestion, severity (critical/medium/low), impact, effort.
Host: ${new URL(url).hostname}
HTTPS: ${isHttps}
Header score: ${headerScore}/100
Mixed content resources: ${mixedContent}
Secure cookies: ${hasSecureCookies}
HttpOnly cookies: ${hasHttpOnlyCookies}
Header checks:
${checks.map((c) => `  ${c.name}: ${c.pass ? "PASS" : "FAIL"} (value: ${c.value ?? "missing"})`).join("\n")}`
    );
  } catch {
    aiResponse = null;
  }

  // Combine HTTPS bonus into score
  let score = headerScore;
  if (!isHttps) score = Math.max(0, score - 20);
  if (mixedContent > 0) score = Math.max(0, score - 10);

  const issues = (aiResponse?.issues ?? fallbackIssues).map((issue) => ({
    ...issue,
    category: "security" as const
  }));

  // Re-adjust score based on final issue count for consistency
  const finalScore = Math.min(score, scoreFromIssueDensity(issues.length, 12, 6, 3, issues));

  const testsMap: Record<string, { pass: boolean; value: string | null }> = {};
  for (const check of checks) {
    testsMap[check.name] = { pass: check.pass, value: check.value };
  }

  return {
    category: "security",
    score: finalScore,
    grade: getGrade(finalScore),
    summary:
      aiResponse?.summary ??
      `Security audit completed. ${checks.filter((c) => c.pass).length}/${checks.length} header checks passed. Score: ${finalScore}/100.`,
    issues,
    passedChecks: checks.filter((c) => c.pass).map((c) => c.name),
    data: {
      grade: getGrade(finalScore),
      score: finalScore,
      https: isHttps,
      mixedContent,
      secureCookies: hasSecureCookies,
      httpOnlyCookies: hasHttpOnlyCookies,
      tests: testsMap
    }
  };
}
