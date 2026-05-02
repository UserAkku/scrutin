import type { HeaderCheck, SecurityModuleResult } from "./types";

function checkSecurityHeaders(headers: Headers): HeaderCheck[] {
  const checks: HeaderCheck[] = [];

  const csp = headers.get("content-security-policy");
  checks.push({
    name: "Content-Security-Policy",
    header: "content-security-policy",
    pass: Boolean(csp),
    value: csp,
    weight: 25,
    description: "Mitigates XSS and data injection attacks by declaring allowed content sources."
  });

  const hsts = headers.get("strict-transport-security");
  checks.push({
    name: "Strict-Transport-Security",
    header: "strict-transport-security",
    pass: Boolean(hsts),
    value: hsts,
    weight: 20,
    description: "Ensures the browser only connects over HTTPS."
  });

  const xcto = headers.get("x-content-type-options");
  checks.push({
    name: "X-Content-Type-Options",
    header: "x-content-type-options",
    pass: xcto?.toLowerCase() === "nosniff",
    value: xcto,
    weight: 10,
    description: "Prevents MIME-type sniffing attacks."
  });

  const xfo = headers.get("x-frame-options");
  checks.push({
    name: "X-Frame-Options",
    header: "x-frame-options",
    pass: Boolean(xfo),
    value: xfo,
    weight: 10,
    description: "Protects against clickjacking by controlling iframe embedding."
  });

  const rp = headers.get("referrer-policy");
  checks.push({
    name: "Referrer-Policy",
    header: "referrer-policy",
    pass: Boolean(rp),
    value: rp,
    weight: 5,
    description: "Controls how much referrer information is passed with outgoing requests."
  });

  const pp = headers.get("permissions-policy") ?? headers.get("feature-policy");
  checks.push({
    name: "Permissions-Policy",
    header: "permissions-policy",
    pass: Boolean(pp),
    value: pp,
    weight: 5,
    description: "Restricts browser features like camera, microphone, and geolocation."
  });

  const xxss = headers.get("x-xss-protection");
  checks.push({
    name: "X-XSS-Protection",
    header: "x-xss-protection",
    pass: Boolean(xxss),
    value: xxss,
    weight: 5,
    description: "Legacy XSS filter header for older browsers."
  });

  const coop = headers.get("cross-origin-opener-policy");
  checks.push({
    name: "Cross-Origin-Opener-Policy",
    header: "cross-origin-opener-policy",
    pass: Boolean(coop),
    value: coop,
    weight: 5,
    description: "Isolates the browsing context to prevent cross-origin attacks."
  });

  const corp = headers.get("cross-origin-resource-policy");
  checks.push({
    name: "Cross-Origin-Resource-Policy",
    header: "cross-origin-resource-policy",
    pass: Boolean(corp),
    value: corp,
    weight: 5,
    description: "Controls which origins can load resources from the server."
  });

  const server = headers.get("server");
  checks.push({
    name: "Server Header Hidden",
    header: "server",
    pass: !server || server.toLowerCase() === "nginx" || server.toLowerCase() === "cloudflare",
    value: server,
    weight: 5,
    description: "Server header should not expose detailed version information."
  });

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

export async function runHeadersModule(headers: Headers, isHeadersFromProxy: boolean): Promise<SecurityModuleResult> {
  const checks = checkSecurityHeaders(headers);
  const score = calculateHeaderScore(checks);
  const failedChecks = checks.filter((c) => !c.pass);

  const issues = failedChecks.map((check) => ({
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

  if (isHeadersFromProxy) {
    issues.push({
      title: "Limited Security Analysis (Proxy Used)",
      description: "The target website blocked direct connection attempts. Security headers were analyzed from a proxy server and may not accurately reflect the target's actual security posture.",
      fixSuggestion: "Ensure your server allows automated requests or check headers manually using browser devtools.",
      severity: "low" as const,
      impact: "Confidence in security header check is low.",
      effort: "N/A"
    });
  }

  const testsMap: Record<string, { pass: boolean; value: string | null }> = {};
  for (const check of checks) {
    testsMap[check.name] = { pass: check.pass, value: check.value };
  }

  return {
    moduleName: "headers",
    issues,
    passedChecks: checks.filter((c) => c.pass).map((c) => c.name),
    score,
    data: { checks: testsMap, score }
  };
}
