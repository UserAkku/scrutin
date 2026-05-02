import type { SecurityModuleResult } from "./types";
import { safeFetchWithTimeout, compareSemver } from "./types";

interface VulnLib {
  name: string;
  regex: RegExp;
  safe: string;
}

const VULN_LIBS: VulnLib[] = [
  { name: "jQuery",    regex: /jquery[.\-](\d+\.\d+\.\d+)/i,    safe: "3.7.0" },
  { name: "Bootstrap", regex: /bootstrap[.\-](\d+\.\d+\.\d+)/i, safe: "5.3.0" },
  { name: "Lodash",    regex: /lodash[.\-](\d+\.\d+\.\d+)/i,    safe: "4.17.21" },
  { name: "Moment.js", regex: /moment[.\-](\d+\.\d+\.\d+)/i,    safe: "2.29.4" },
  { name: "Angular",   regex: /angular[.\-](\d+\.\d+\.\d+)/i,   safe: "17.0.0" },
  { name: "Vue",       regex: /vue[.\-](\d+\.\d+\.\d+)/i,       safe: "3.3.0" },
];

const DANGEROUS_PATTERNS = [
  { pattern: /eval\s*\(/g,                                        name: "eval() usage",              severity: "critical" as const },
  { pattern: /document\.write\s*\(/g,                             name: "document.write()",          severity: "medium" as const },
  { pattern: /\.innerHTML\s*=/g,                                  name: "innerHTML assignment",      severity: "medium" as const },
  { pattern: /\.outerHTML\s*=/g,                                  name: "outerHTML assignment",      severity: "medium" as const },
  { pattern: /location\.href\s*=.*location\.(search|hash)/g,     name: "URL-based redirect",        severity: "critical" as const },
  { pattern: /setTimeout\s*\(\s*["'`]/g,                          name: "setTimeout with string",    severity: "medium" as const },
  { pattern: /setInterval\s*\(\s*["'`]/g,                         name: "setInterval with string",   severity: "medium" as const },
];

const KNOWN_CDNS = new Set([
  "cdn.jsdelivr.net",
  "cdnjs.cloudflare.com",
  "unpkg.com",
  "ajax.googleapis.com",
  "cdn.polyfill.io",
  "code.jquery.com",
  "stackpath.bootstrapcdn.com",
  "maxcdn.bootstrapcdn.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
]);

function extractScriptSrcs(root: ReturnType<typeof import("node-html-parser").parse>, origin: string): string[] {
  const urls: string[] = [];
  for (const el of root.querySelectorAll("script[src]")) {
    const src = el.getAttribute("src");
    if (!src) continue;
    try {
      urls.push(new URL(src, origin).toString());
    } catch {
      // skip
    }
  }
  return urls;
}

async function fetchJsFile(url: string): Promise<string | null> {
  const res = await safeFetchWithTimeout(url, undefined, 10000);
  if (!res || !res.ok) return null;
  const text = await res.text();
  return text.length > 500000 ? text.slice(0, 500000) : text;
}

export async function runClientSideModule(
  html: string,
  root: ReturnType<typeof import("node-html-parser").parse>,
  baseUrl: string
): Promise<SecurityModuleResult> {
  const issues: SecurityModuleResult["issues"] = [];
  const passedChecks: string[] = [];
  const data: Record<string, unknown> = {};

  const origin = new URL(baseUrl).origin;
  const scriptUrls = extractScriptSrcs(root, origin);
  const jsFiles = await Promise.all(scriptUrls.slice(0, 10).map(fetchJsFile));
  const allContent = [html, ...jsFiles.filter((f): f is string => f !== null)].join("\n");

  // --- Source map exposure ---
  const sourceMapsExposed: string[] = [];
  for (let i = 0; i < scriptUrls.length && i < 10; i++) {
    const content = jsFiles[i];
    if (!content) continue;
    const mapMatch = content.match(/\/\/# sourceMappingURL=(.+)/);
    if (mapMatch) {
      const mapUrl = mapMatch[1].trim();
      try {
        const resolved = new URL(mapUrl, scriptUrls[i]).toString();
        const mapRes = await safeFetchWithTimeout(resolved, { method: "HEAD" }, 5000);
        if (mapRes && mapRes.ok) {
          sourceMapsExposed.push(resolved);
          if (sourceMapsExposed.length <= 3) {
            issues.push({
              title: "Source map publicly accessible",
              description: `Source map file ${new URL(resolved).pathname} is publicly accessible, exposing full original source code.`,
              fixSuggestion: "Remove source maps from production or restrict access via server configuration.",
              severity: "critical",
              impact: "Attackers can read your entire unminified source code.",
              effort: "15 minutes"
            });
          }
        }
      } catch {
        // skip
      }
    }
  }
  data.sourceMapsExposed = sourceMapsExposed.length;
  if (sourceMapsExposed.length === 0) {
    passedChecks.push("No exposed source maps");
  }

  // --- Outdated JS libraries ---
  const vulnerableLibs: Array<{ name: string; found: string; safe: string }> = [];
  for (const lib of VULN_LIBS) {
    lib.regex.lastIndex = 0;
    const match = allContent.match(lib.regex);
    if (match) {
      const foundVersion = match[1];
      if (compareSemver(foundVersion, lib.safe) < 0) {
        vulnerableLibs.push({ name: lib.name, found: foundVersion, safe: lib.safe });
        issues.push({
          title: `Outdated ${lib.name} (${foundVersion})`,
          description: `${lib.name} ${foundVersion} is outdated. Latest safe version is ${lib.safe}. Older versions may have known CVEs.`,
          fixSuggestion: `Update ${lib.name} to at least version ${lib.safe}.`,
          severity: "medium",
          impact: "Known vulnerabilities in outdated libraries can be exploited.",
          effort: "30 minutes"
        });
      }
    }
  }
  data.vulnerableLibs = vulnerableLibs;
  if (vulnerableLibs.length === 0) {
    passedChecks.push("No known outdated JS libraries");
  }

  // --- SRI check (external scripts without integrity) ---
  let sriMissing = 0;
  for (const el of root.querySelectorAll("script[src], link[href][rel='stylesheet']")) {
    const src = el.getAttribute("src") ?? el.getAttribute("href") ?? "";
    if (!src) continue;
    try {
      const srcHost = new URL(src, origin).hostname;
      const pageHost = new URL(origin).hostname;
      if (srcHost !== pageHost && !el.getAttribute("integrity")) {
        sriMissing++;
        if (sriMissing <= 3) {
          issues.push({
            title: `Missing SRI on external resource`,
            description: `External resource from ${srcHost} is loaded without Subresource Integrity (SRI) hash.`,
            fixSuggestion: "Add an integrity attribute with a SHA-384 hash to ensure the file hasn't been tampered with.",
            severity: "medium",
            impact: "If the CDN is compromised, malicious code can be injected.",
            effort: "15 minutes"
          });
        }
      }
    } catch {
      // skip
    }
  }
  if (sriMissing === 0) {
    passedChecks.push("SRI on external resources");
  }

  // --- DOM XSS sinks ---
  // Only scan inline scripts to reduce false positives
  const inlineScripts = root.querySelectorAll("script:not([src])").map((el) => el.text).join("\n");
  for (const dp of DANGEROUS_PATTERNS) {
    dp.pattern.lastIndex = 0;
    const matches = inlineScripts.match(dp.pattern);
    if (matches && matches.length > 0) {
      issues.push({
        title: `Potential DOM XSS: ${dp.name}`,
        description: `Found ${matches.length} instance(s) of ${dp.name} in inline scripts. This can be a DOM XSS vector.`,
        fixSuggestion: `Avoid ${dp.name} in client-side code. Use safer alternatives like textContent, createElement, etc.`,
        severity: dp.severity,
        impact: "DOM-based XSS can allow attackers to execute arbitrary JavaScript.",
        effort: "30 minutes"
      });
    }
  }

  // --- postMessage without origin check ---
  if (/addEventListener\s*\(\s*['"]message['"]/.test(allContent)) {
    if (!/event\.origin|e\.origin|\.origin\s*[!=]==?/.test(allContent)) {
      issues.push({
        title: "postMessage listener without origin check",
        description: "A message event listener was found without verifying the message origin.",
        fixSuggestion: "Always validate event.origin in postMessage handlers to prevent cross-origin attacks.",
        severity: "medium",
        impact: "Attackers can send crafted messages from any origin.",
        effort: "15 minutes"
      });
    }
  }

  // --- Third-party script risk ---
  const externalDomains = new Set<string>();
  for (const url of scriptUrls) {
    try {
      const host = new URL(url).hostname;
      if (host !== new URL(origin).hostname) externalDomains.add(host);
    } catch {
      // skip
    }
  }
  const unknownDomains = [...externalDomains].filter((d) => !KNOWN_CDNS.has(d));
  data.externalScriptDomains = [...externalDomains];
  data.unknownExternalDomains = unknownDomains;
  if (unknownDomains.length > 3) {
    issues.push({
      title: `${unknownDomains.length} unknown third-party script domains`,
      description: `Scripts are loaded from ${unknownDomains.length} domains that are not recognized CDNs: ${unknownDomains.slice(0, 5).join(", ")}`,
      fixSuggestion: "Audit all third-party scripts. Remove unused ones and add SRI hashes.",
      severity: "medium",
      impact: "Third-party scripts have full access to the page DOM and cookies.",
      effort: "1 hour"
    });
  }

  // --- Unencrypted WebSocket ---
  if (/new\s+WebSocket\s*\(\s*['"]ws:\/\//i.test(allContent)) {
    issues.push({
      title: "Unencrypted WebSocket connection",
      description: "A WebSocket connection using ws:// (not wss://) was found, transmitting data in plaintext.",
      fixSuggestion: "Use wss:// (WebSocket Secure) for all WebSocket connections.",
      severity: "medium",
      impact: "WebSocket data can be intercepted by network attackers.",
      effort: "15 minutes"
    });
  }

  // --- API endpoint discovery ---
  const apiRegex = /["'`](\/api\/[a-zA-Z0-9_\-/]{3,})["'`]/g;
  const discoveredEndpoints = new Set<string>();
  let apiMatch: RegExpExecArray | null;
  while ((apiMatch = apiRegex.exec(allContent)) !== null) {
    discoveredEndpoints.add(apiMatch[1]);
  }
  data.discoveredEndpoints = [...discoveredEndpoints];

  // Probe a few endpoints
  const endpointArray = [...discoveredEndpoints].slice(0, 10);
  let openEndpoints = 0;
  for (const ep of endpointArray) {
    try {
      const epRes = await safeFetchWithTimeout(`${origin}${ep}`, { method: "HEAD" }, 5000);
      if (epRes && epRes.ok) openEndpoints++;
    } catch {
      // skip
    }
  }
  if (openEndpoints > 0 && endpointArray.length > 0) {
    issues.push({
      title: `${openEndpoints} API endpoint(s) respond without authentication`,
      description: `Found ${discoveredEndpoints.size} API endpoints in JS bundles. ${openEndpoints} responded with 200 to unauthenticated HEAD requests.`,
      fixSuggestion: "Ensure all API endpoints require proper authentication and authorization.",
      severity: "medium",
      impact: "Unauthenticated API access can lead to data leaks.",
      effort: "1 hour"
    });
  }

  let score = 100;
  for (const i of issues) {
    if (i.severity === "critical") score -= 15;
    else if (i.severity === "medium") score -= 7;
    else score -= 3;
  }
  score = Math.max(0, Math.min(100, score));

  return { moduleName: "clientSide", issues, passedChecks, score, data };
}
