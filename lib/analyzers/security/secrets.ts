import type { SecurityModuleResult, SecurityIssueSeverity } from "./types";
import { safeFetchWithTimeout, redactSecret } from "./types";

interface SecretPattern {
  name: string;
  regex: RegExp;
  severity: SecurityIssueSeverity;
}

const SECRET_PATTERNS: SecretPattern[] = [
  { name: "Google API Key",        regex: /AIza[0-9A-Za-z\-_]{35}/g,                              severity: "critical" },
  { name: "AWS Access Key",        regex: /AKIA[0-9A-Z]{16}/g,                                    severity: "critical" },
  { name: "Stripe Secret Key",     regex: /sk_live_[0-9a-zA-Z]{24,}/g,                            severity: "critical" },
  { name: "Stripe Publishable Key",regex: /pk_live_[0-9a-zA-Z]{24,}/g,                            severity: "medium"  },
  { name: "GitHub Token",          regex: /gh[pousr]_[A-Za-z0-9]{36,}/g,                          severity: "critical" },
  { name: "JWT Token",             regex: /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_+/=]*/g, severity: "critical" },
  { name: "Private Key Block",     regex: /-----BEGIN (?:RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/g,   severity: "critical" },
  { name: "Firebase Config",       regex: /apiKey:\s*["'][A-Za-z0-9\-_]{35,}["']/g,               severity: "critical" },
  { name: "Supabase Key",          regex: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_\-]+/g, severity: "critical" },
  { name: "Slack Token",           regex: /xox[baprs]-[A-Za-z0-9\-]{10,}/g,                       severity: "critical" },
  { name: "Discord Token",         regex: /[MNO][A-Za-z0-9]{23}\.[A-Za-z0-9\-_]{6}\.[A-Za-z0-9\-_]{27}/g, severity: "critical" },
  { name: "Twilio Token",          regex: /SK[0-9a-fA-F]{32}/g,                                   severity: "critical" },
  { name: "SendGrid Key",          regex: /SG\.[A-Za-z0-9\-_.]{22,}\.[A-Za-z0-9\-_.]{43,}/g,      severity: "critical" },
  { name: "Hardcoded Password",    regex: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"']{6,}["']/gi,  severity: "medium"  },
  { name: "Database URL",          regex: /(?:mongodb|postgres|mysql|redis):\/\/[^\s"'<>]+/gi,     severity: "critical" },
  { name: "Internal IP Address",   regex: /(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)\d{1,3}\.\d{1,3}/g, severity: "medium" },
  { name: "Bearer Token",          regex: /['"]?[Bb]earer\s+[A-Za-z0-9\-_.~+/]+=*/g,             severity: "medium"  },
];

const COMMENT_KEYWORDS = /(?:password|secret|key|token|api|internal|todo|fixme|hack|credentials|debug)/i;

/** Collect JS file URLs from the HTML root */
function extractJsUrls(root: ReturnType<typeof import("node-html-parser").parse>, baseUrl: string): string[] {
  const urls: string[] = [];
  const origin = new URL(baseUrl).origin;
  for (const el of root.querySelectorAll("script[src]")) {
    const src = el.getAttribute("src");
    if (!src) continue;
    try {
      const resolved = new URL(src, origin).toString();
      urls.push(resolved);
    } catch {
      // skip invalid
    }
  }
  return urls.slice(0, 10);
}

async function fetchJsContent(url: string): Promise<{ url: string; content: string } | null> {
  const res = await safeFetchWithTimeout(url, undefined, 10000);
  if (!res || !res.ok) return null;
  const size = Number(res.headers.get("content-length") ?? "0");
  if (size > 500000) return null; // skip files > 500KB by content-length
  const text = await res.text();
  if (text.length > 500000) return { url, content: text.slice(0, 500000) };
  return { url, content: text };
}

export async function runSecretsModule(
  html: string,
  root: ReturnType<typeof import("node-html-parser").parse>,
  baseUrl: string
): Promise<SecurityModuleResult> {
  const issues: SecurityModuleResult["issues"] = [];
  const passedChecks: string[] = [];
  const data: Record<string, unknown> = {};

  // Gather all content to scan
  const jsUrls = extractJsUrls(root, baseUrl);
  const jsFiles = await Promise.all(jsUrls.map(fetchJsContent));
  const validJsFiles = jsFiles.filter((f): f is NonNullable<typeof f> => f !== null);

  const sources: Array<{ label: string; content: string }> = [
    { label: "HTML page", content: html },
    ...validJsFiles.map((f) => ({ label: new URL(f.url).pathname, content: f.content })),
  ];

  data.filesScanned = sources.length;
  let totalSecretsFound = 0;

  for (const source of sources) {
    for (const pattern of SECRET_PATTERNS) {
      // Reset regex state
      pattern.regex.lastIndex = 0;
      const matches = source.content.match(pattern.regex);
      if (matches && matches.length > 0) {
        totalSecretsFound += matches.length;
        issues.push({
          title: `${pattern.name} exposed in ${source.label}`,
          description: `Found ${matches.length} instance(s) of ${pattern.name}: ${redactSecret(matches[0])}`,
          fixSuggestion: "Move this to server-side environment variables. Never expose secrets in client-side code.",
          severity: pattern.severity,
          impact: `Exposed ${pattern.name} can be exploited by attackers who inspect client-side code.`,
          effort: "15 minutes"
        });
      }
    }
  }

  // Scan HTML comments
  const commentRegex = /<!--([\s\S]*?)-->/g;
  let commentMatch: RegExpExecArray | null;
  let flaggedComments = 0;
  while ((commentMatch = commentRegex.exec(html)) !== null) {
    const commentBody = commentMatch[1];
    if (COMMENT_KEYWORDS.test(commentBody)) {
      flaggedComments++;
      if (flaggedComments <= 3) {
        issues.push({
          title: "Sensitive HTML comment found",
          description: `An HTML comment contains potentially sensitive keywords: "${commentBody.trim().slice(0, 80)}..."`,
          fixSuggestion: "Remove all developer comments from production HTML. Use a build step to strip comments.",
          severity: "medium",
          impact: "Comments can reveal internal logic, credentials, or technical debt to attackers.",
          effort: "10 minutes"
        });
      }
    }
  }

  data.secretsFound = totalSecretsFound;
  data.flaggedComments = flaggedComments;

  if (totalSecretsFound === 0 && flaggedComments === 0) {
    passedChecks.push("No exposed secrets found");
  }

  let score = 100;
  for (const i of issues) {
    if (i.severity === "critical") score -= 15;
    else if (i.severity === "medium") score -= 8;
    else score -= 3;
  }
  score = Math.max(0, Math.min(100, score));

  return { moduleName: "secrets", issues, passedChecks, score, data };
}
