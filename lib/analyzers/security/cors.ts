import type { SecurityModuleResult } from "./types";
import { safeFetchWithTimeout } from "./types";

export async function runCorsModule(targetUrl: string): Promise<SecurityModuleResult> {
  const issues: SecurityModuleResult["issues"] = [];
  const passedChecks: string[] = [];
  const data: Record<string, unknown> = {};

  // CORS preflight with evil origin
  try {
    const corsRes = await safeFetchWithTimeout(targetUrl, {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil-attacker.com",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Authorization",
      },
    }, 10000);

    if (corsRes) {
      const acao = corsRes.headers.get("access-control-allow-origin");
      const acac = corsRes.headers.get("access-control-allow-credentials");
      const acam = corsRes.headers.get("access-control-allow-methods") ?? "";

      data.allowOrigin = acao;
      data.allowCredentials = acac;
      data.allowMethods = acam;

      // Check 1: wildcard + credentials
      if (acao === "*" && acac === "true") {
        issues.push({
          title: "CORS wildcard with credentials",
          description: "Access-Control-Allow-Origin is * while Allow-Credentials is true. This is a dangerous misconfiguration.",
          fixSuggestion: "Never combine wildcard origin with credentials. Specify exact allowed origins.",
          severity: "critical",
          impact: "Any website can make authenticated requests to your API.",
          effort: "30 minutes"
        });
      }
      // Check 2: origin reflection
      else if (acao === "https://evil-attacker.com") {
        issues.push({
          title: "CORS origin reflection vulnerability",
          description: "The server reflects any Origin header in Access-Control-Allow-Origin, allowing any website to read responses.",
          fixSuggestion: "Implement an allowlist of trusted origins instead of reflecting the Origin header.",
          severity: "critical",
          impact: "Any attacker-controlled website can steal data from authenticated API responses.",
          effort: "1 hour"
        });
        data.vulnerable = true;
      }
      // Check 3: wildcard (no credentials)
      else if (acao === "*") {
        issues.push({
          title: "CORS allows any origin",
          description: "Access-Control-Allow-Origin is set to *, allowing any website to read public responses.",
          fixSuggestion: "If the API serves private data, restrict CORS to specific trusted origins.",
          severity: "medium",
          impact: "Public API responses are readable by any website.",
          effort: "30 minutes"
        });
      } else if (acao) {
        passedChecks.push("CORS configured with specific origin");
      } else {
        passedChecks.push("No permissive CORS headers");
      }

      // Check 4: TRACE in allowed methods
      if (acam.toUpperCase().includes("TRACE")) {
        issues.push({
          title: "TRACE method allowed via CORS",
          description: "CORS allows the TRACE method, which can be exploited for Cross-Site Tracing (XST) attacks.",
          fixSuggestion: "Remove TRACE from Access-Control-Allow-Methods and disable it on the server.",
          severity: "critical",
          impact: "Attackers can use XST to steal authentication cookies and headers.",
          effort: "15 minutes"
        });
      }

      // Check 5: PUT/DELETE without auth
      const dangerousMethods = ["PUT", "DELETE"].filter((m) =>
        acam.toUpperCase().includes(m)
      );
      if (dangerousMethods.length > 0) {
        issues.push({
          title: `Dangerous HTTP methods allowed: ${dangerousMethods.join(", ")}`,
          description: `CORS allows ${dangerousMethods.join(" and ")} methods which can modify or delete data.`,
          fixSuggestion: "Ensure these methods require proper authentication and are only exposed to trusted origins.",
          severity: "medium",
          impact: "Unauthorized data modification or deletion may be possible.",
          effort: "30 minutes"
        });
      }
    }
  } catch {
    // CORS check failed — skip
  }

  // Direct TRACE request
  try {
    const traceRes = await safeFetchWithTimeout(targetUrl, { method: "TRACE" }, 10000);
    if (traceRes && traceRes.ok) {
      issues.push({
        title: "HTTP TRACE method enabled",
        description: "The server responds to TRACE requests, enabling Cross-Site Tracing (XST) attacks.",
        fixSuggestion: "Disable the TRACE method in your web server configuration.",
        severity: "critical",
        impact: "Attackers can use XST to bypass HttpOnly cookie protections.",
        effort: "15 minutes"
      });
    } else {
      passedChecks.push("TRACE method disabled");
    }
  } catch {
    passedChecks.push("TRACE method disabled");
  }

  let score = 100;
  for (const i of issues) {
    if (i.severity === "critical") score -= 20;
    else if (i.severity === "medium") score -= 10;
    else score -= 5;
  }
  score = Math.max(0, Math.min(100, score));

  return { moduleName: "cors", issues, passedChecks, score, data };
}
