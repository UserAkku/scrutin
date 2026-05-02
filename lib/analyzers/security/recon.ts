import type { SecurityModuleResult } from "./types";
import { safeFetchWithTimeout } from "./types";

const CLOUD_PATTERNS = [
  /https?:\/\/[a-z0-9\-]+\.s3\.amazonaws\.com\/[^\s"']*/g,
  /https?:\/\/s3[.\-][a-z0-9\-]+\.amazonaws\.com\/[a-z0-9\-]+/g,
  /https?:\/\/storage\.googleapis\.com\/[a-z0-9\-]+/g,
  /https?:\/\/[a-z0-9\-]+\.blob\.core\.windows\.net/g,
  /https?:\/\/[a-z0-9\-]+\.r2\.cloudflarestorage\.com/g,
];

const PII_PATTERNS = [
  { name: "Indian phone number", regex: /(?:\+91|0)?[6-9]\d{9}/g },
  { name: "Aadhaar number",      regex: /\b\d{4}\s\d{4}\s\d{4}\b/g },
  { name: "PAN number",          regex: /[A-Z]{5}\d{4}[A-Z]/g },
  { name: "Credit card number",  regex: /\b(?:\d[ \-]?){13,16}\b/g },
];

const INTERESTING_ROBOTS_PATHS = ["/admin", "/api", "/internal", "/staging", "/backup", "/private", "/secret", "/dashboard"];

export async function runReconModule(
  html: string,
  origin: string,
  hostname: string,
  targetUrl: string
): Promise<SecurityModuleResult> {
  const issues: SecurityModuleResult["issues"] = [];
  const passedChecks: string[] = [];
  const data: Record<string, unknown> = {};

  // --- robots.txt analysis ---
  try {
    const robotsRes = await safeFetchWithTimeout(`${origin}/robots.txt`, undefined, 10000);
    if (robotsRes && robotsRes.ok) {
      const text = await robotsRes.text();
      const disallowed = text
        .split("\n")
        .filter((l) => l.startsWith("Disallow:"))
        .map((l) => l.replace("Disallow:", "").trim())
        .filter((l) => l.length > 1);

      data.robotsDisallowed = disallowed;
      const flagged = disallowed.filter((p) => INTERESTING_ROBOTS_PATHS.some((i) => p.includes(i)));
      if (flagged.length > 0) {
        issues.push({
          title: "Robots.txt reveals sensitive paths",
          description: `robots.txt disallows interesting paths: ${flagged.slice(0, 5).join(", ")}. Attackers commonly check robots.txt for hidden URLs.`,
          fixSuggestion: "Consider whether listing sensitive paths in robots.txt actually helps. Protect them with authentication instead.",
          severity: "medium",
          impact: "Sensitive paths are disclosed to anyone who reads robots.txt.",
          effort: "15 minutes"
        });
      } else {
        passedChecks.push("robots.txt does not reveal sensitive paths");
      }
    }
  } catch {
    // skip
  }

  // --- sitemap.xml ---
  try {
    const sitemapRes = await safeFetchWithTimeout(`${origin}/sitemap.xml`, undefined, 10000);
    if (sitemapRes && sitemapRes.ok) {
      const sitemapText = await sitemapRes.text();
      const urlCount = (sitemapText.match(/<loc>/g) ?? []).length;
      data.sitemapUrls = urlCount;

      const sensitiveInSitemap = INTERESTING_ROBOTS_PATHS.some((p) => sitemapText.includes(p));
      if (sensitiveInSitemap) {
        issues.push({
          title: "Sitemap.xml exposes sensitive paths",
          description: "The sitemap.xml contains URLs that appear to be admin or internal paths.",
          fixSuggestion: "Remove internal and admin URLs from the public sitemap.",
          severity: "medium",
          impact: "Attackers can discover hidden admin or internal endpoints.",
          effort: "10 minutes"
        });
      }
    }
  } catch {
    // skip
  }

  // --- security.txt ---
  let hasSecurityTxt = false;
  for (const path of ["/.well-known/security.txt", "/security.txt"]) {
    try {
      const secRes = await safeFetchWithTimeout(`${origin}${path}`, { method: "HEAD" }, 5000);
      if (secRes && secRes.ok) {
        hasSecurityTxt = true;
        break;
      }
    } catch {
      // skip
    }
  }
  if (hasSecurityTxt) {
    passedChecks.push("security.txt present");
  } else {
    issues.push({
      title: "No security.txt found",
      description: "Neither /.well-known/security.txt nor /security.txt was found.",
      fixSuggestion: "Create a security.txt file with contact information for responsible disclosure. See https://securitytxt.org/",
      severity: "low",
      impact: "Security researchers may not know how to report vulnerabilities to you.",
      effort: "10 minutes"
    });
  }
  data.securityTxt = hasSecurityTxt;

  // --- Google Safe Browsing ---
  const sbKey = process.env.SAFE_BROWSING_API_KEY?.trim();
  if (sbKey) {
    try {
      const sbRes = await safeFetchWithTimeout(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${sbKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client: { clientId: "scrutin", clientVersion: "1.0" },
            threatInfo: {
              threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
              platformTypes: ["ANY_PLATFORM"],
              threatEntryTypes: ["URL"],
              threatEntries: [{ url: targetUrl }],
            },
          }),
        },
        10000
      );
      if (sbRes && sbRes.ok) {
        const sbBody = (await sbRes.json()) as { matches?: Array<{ threatType: string }> };
        if (sbBody.matches && sbBody.matches.length > 0) {
          const threats = sbBody.matches.map((m) => m.threatType).join(", ");
          issues.push({
            title: "Google Safe Browsing flagged this URL",
            description: `Threat types: ${threats}. This site may be blocked by browsers.`,
            fixSuggestion: "Investigate and remove any malware, phishing content, or unwanted software. Request a review via Google Search Console.",
            severity: "critical",
            impact: "Browsers will show a warning page before allowing users to visit.",
            effort: "Varies"
          });
        } else {
          passedChecks.push("Google Safe Browsing: clean");
        }
      }
    } catch {
      // skip
    }
  }

  // --- HaveIBeenPwned domain check ---
  const hibpKey = process.env.HIBP_API_KEY?.trim();
  if (hibpKey) {
    try {
      const hibpRes = await safeFetchWithTimeout(
        `https://haveibeenpwned.com/api/v3/breaches?domain=${hostname}`,
        { headers: { "hibp-api-key": hibpKey, "user-agent": "Scrutin" } },
        10000
      );
      if (hibpRes && hibpRes.ok) {
        const breaches = (await hibpRes.json()) as Array<{ Name: string; BreachDate: string; PwnCount: number }>;
        if (breaches.length > 0) {
          const topBreaches = breaches.slice(0, 3).map((b) => `${b.Name} (${b.BreachDate}, ${b.PwnCount.toLocaleString()} accounts)`);
          issues.push({
            title: `${breaches.length} data breach(es) associated with this domain`,
            description: `Known breaches: ${topBreaches.join("; ")}`,
            fixSuggestion: "Ensure all users have changed passwords since the breach. Implement 2FA and monitor for credential stuffing.",
            severity: "critical",
            impact: "User credentials from past breaches may be used in attacks.",
            effort: "Ongoing"
          });
          data.breaches = breaches.length;
        } else {
          passedChecks.push("No known breaches on HIBP");
        }
      }
    } catch {
      // skip
    }
  }

  // --- Cloud storage bucket exposure ---
  const foundBuckets = new Set<string>();
  for (const pattern of CLOUD_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      foundBuckets.add(match[0]);
    }
  }
  if (foundBuckets.size > 0) {
    for (const bucketUrl of [...foundBuckets].slice(0, 5)) {
      try {
        const bucketRes = await safeFetchWithTimeout(bucketUrl, undefined, 5000);
        if (bucketRes && bucketRes.ok) {
          const body = (await bucketRes.text()).slice(0, 500);
          const isListing = body.includes("<ListBucketResult") || body.includes("<EnumerationResults") || body.includes('"kind":"storage#objects"');
          if (isListing) {
            issues.push({
              title: "Cloud storage bucket with public listing",
              description: `Bucket ${bucketUrl} exposes a file listing publicly.`,
              fixSuggestion: "Disable public listing on the cloud storage bucket. Set proper IAM policies.",
              severity: "critical",
              impact: "Attackers can enumerate and download all files from the bucket.",
              effort: "15 minutes"
            });
          } else {
            issues.push({
              title: "Public cloud storage bucket",
              description: `Bucket ${bucketUrl} is publicly accessible.`,
              fixSuggestion: "Review bucket permissions. Only allow public access if intentional.",
              severity: "medium",
              impact: "Files in the bucket are accessible to anyone.",
              effort: "15 minutes"
            });
          }
        }
      } catch {
        // skip
      }
    }
    data.publicBuckets = foundBuckets.size;
  }

  // --- Rate limiting detection ---
  let rateLimit429 = false;
  try {
    for (let i = 0; i < 15; i++) {
      const rlRes = await safeFetchWithTimeout(targetUrl, { method: "HEAD" }, 3000);
      if (rlRes && rlRes.status === 429) {
        rateLimit429 = true;
        break;
      }
    }
    if (!rateLimit429) {
      issues.push({
        title: "No rate limiting detected",
        description: "15 rapid sequential requests did not trigger a 429 response. Note: this is a basic check; rate limiting may exist at a different layer.",
        fixSuggestion: "Implement rate limiting to prevent brute-force and DDoS attacks.",
        severity: "medium",
        impact: "Without rate limiting, attackers can perform brute-force attacks.",
        effort: "1 hour"
      });
    } else {
      passedChecks.push("Rate limiting detected");
    }
  } catch {
    // skip
  }
  data.rateLimitDetected = rateLimit429;

  // --- Email harvesting ---
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const foundEmails = [...new Set(html.match(emailRegex) ?? [])].filter(
    (e) => !e.startsWith("noreply@") && !e.startsWith("no-reply@")
  );
  if (foundEmails.length > 0) {
    data.exposedEmails = foundEmails.slice(0, 10);
    issues.push({
      title: `${foundEmails.length} email address(es) exposed in HTML`,
      description: `Found email addresses in page source: ${foundEmails.slice(0, 3).join(", ")}${foundEmails.length > 3 ? "..." : ""}`,
      fixSuggestion: "Use contact forms or obfuscation instead of plain-text email addresses.",
      severity: "low",
      impact: "Exposed emails will be harvested by spam bots.",
      effort: "15 minutes"
    });
  }

  // --- PII detection ---
  // Strip scripts and styles before scanning for PII
  const visibleText = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  for (const pii of PII_PATTERNS) {
    pii.regex.lastIndex = 0;
    const matches = visibleText.match(pii.regex);
    if (matches && matches.length > 0) {
      issues.push({
        title: `Possible ${pii.name} exposed in page content`,
        description: `Found ${matches.length} pattern(s) matching ${pii.name} in visible page text. Value redacted for privacy.`,
        fixSuggestion: "Remove or mask PII from publicly accessible pages.",
        severity: "critical",
        impact: "Personally Identifiable Information exposure violates privacy regulations.",
        effort: "15 minutes"
      });
    }
  }

  // --- Dependency confusion (package.json) ---
  try {
    const pkgRes = await safeFetchWithTimeout(`${origin}/package.json`, undefined, 5000);
    if (pkgRes && pkgRes.ok) {
      const pkgText = await pkgRes.text();
      try {
        const pkg = JSON.parse(pkgText) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
        const scoped = Object.keys(allDeps).filter((d) => d.startsWith("@"));
        if (scoped.length > 0) {
          issues.push({
            title: "Dependency confusion risk via exposed package.json",
            description: `package.json is publicly accessible and contains ${scoped.length} scoped package(s): ${scoped.slice(0, 3).join(", ")}. Attackers could register these on the public npm registry.`,
            fixSuggestion: "Block access to package.json in production and audit scoped packages.",
            severity: "medium",
            impact: "Dependency confusion attacks can inject malicious code into your build pipeline.",
            effort: "30 minutes"
          });
        }
      } catch {
        // invalid JSON
      }
    }
  } catch {
    // skip
  }

  let score = 100;
  for (const i of issues) {
    if (i.severity === "critical") score -= 15;
    else if (i.severity === "medium") score -= 7;
    else score -= 3;
  }
  score = Math.max(0, Math.min(100, score));

  return { moduleName: "recon", issues, passedChecks, score, data };
}
