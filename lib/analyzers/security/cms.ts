import type { SecurityModuleResult } from "./types";
import { safeFetchWithTimeout } from "./types";

interface CmsSignature {
  name: string;
  indicators: string[];
}

const CMS_SIGNATURES: CmsSignature[] = [
  { name: "WordPress",  indicators: ["wp-content/", "wp-json/", 'name="generator" content="WordPress'] },
  { name: "Drupal",     indicators: ["/sites/default/", "Drupal.settings", "x-generator: Drupal"] },
  { name: "Joomla",     indicators: ["/components/com_", "Joomla!", "/media/jui/"] },
  { name: "Magento",    indicators: ["/skin/frontend/", "Mage.Cookies", "/js/mage/"] },
  { name: "Shopify",    indicators: ["cdn.shopify.com", "Shopify.theme"] },
  { name: "Laravel",    indicators: ["laravel_session", "X-Powered-By: PHP"] },
  { name: "Django",     indicators: ["csrfmiddlewaretoken", "__django"] },
  { name: "Next.js",    indicators: ["__NEXT_DATA__", "/_next/static/"] },
  { name: "Nuxt.js",    indicators: ["__NUXT__", "/_nuxt/"] },
];

export async function runCmsModule(
  html: string,
  root: ReturnType<typeof import("node-html-parser").parse>,
  origin: string,
  headers: Headers
): Promise<SecurityModuleResult> {
  const issues: SecurityModuleResult["issues"] = [];
  const passedChecks: string[] = [];
  const data: Record<string, unknown> = {};

  const headersText = [...headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n");
  const combined = html + "\n" + headersText;
  const detectedTech: string[] = [];

  // Detect CMS/Framework
  for (const sig of CMS_SIGNATURES) {
    const found = sig.indicators.some((ind) => combined.includes(ind));
    if (found) {
      detectedTech.push(sig.name);
    }
  }
  data.detectedTech = detectedTech;

  // WordPress-specific checks
  const isWordPress = detectedTech.includes("WordPress");
  if (isWordPress) {
    // Version exposure from generator meta
    const genMeta = root.querySelector('meta[name="generator"]');
    const genContent = genMeta?.getAttribute("content") ?? "";
    if (genContent.includes("WordPress")) {
      const versionMatch = genContent.match(/WordPress\s+([\d.]+)/i);
      if (versionMatch) {
        data.wordpressVersion = versionMatch[1];
        issues.push({
          title: `WordPress version exposed: ${versionMatch[1]}`,
          description: "The exact WordPress version is visible in the generator meta tag.",
          fixSuggestion: "Remove the generator meta tag by adding remove_action('wp_head', 'wp_generator') to your theme.",
          severity: "medium",
          impact: "Attackers can look up known vulnerabilities for this specific version.",
          effort: "10 minutes"
        });
      }
    }

    // WordPress-specific endpoint probes
    const wpChecks: Array<{ path: string; severity: "critical" | "medium"; label: string }> = [
      { path: "/wp-json/wp/v2/users", severity: "critical", label: "WordPress user list exposed" },
      { path: "/xmlrpc.php",          severity: "medium",   label: "XML-RPC enabled (brute-force surface)" },
      { path: "/wp-content/readme.html", severity: "medium", label: "WordPress readme.html exposed" },
    ];

    for (const check of wpChecks) {
      try {
        const res = await safeFetchWithTimeout(`${origin}${check.path}`, { method: "HEAD" }, 5000);
        if (res && res.ok) {
          issues.push({
            title: check.label,
            description: `The endpoint ${check.path} is publicly accessible.`,
            fixSuggestion: `Block access to ${check.path} via server configuration or a security plugin.`,
            severity: check.severity,
            impact: check.severity === "critical"
              ? "Attackers can enumerate usernames for credential stuffing."
              : "This endpoint reveals information useful for attacks.",
            effort: "15 minutes"
          });
        }
      } catch {
        // skip
      }
    }
  }

  // Error page fingerprinting
  try {
    const notFoundRes = await safeFetchWithTimeout(
      `${origin}/this-path-definitely-does-not-exist-xyz987abc`,
      undefined,
      10000
    );
    if (notFoundRes) {
      const errorBody = (await notFoundRes.text()).slice(0, 5000);
      const stackTracePatterns = [
        /at\s+\S+\s+\([^)]*\.(js|ts|php|py|rb):\d+/,
        /Traceback\s+\(most recent call last\)/i,
        /Exception in thread/i,
      ];
      const frameworkNames = ["Express", "Laravel", "Django", "Rails", "Flask", "FastAPI", "Spring"];
      const serverPaths = ["/var/www/", "/home/app/", "C:\\inetpub\\", "/srv/", "/opt/"];

      const foundStack = stackTracePatterns.some((p) => p.test(errorBody));
      const foundFramework = frameworkNames.find((f) => errorBody.includes(f));
      const foundPath = serverPaths.find((p) => errorBody.includes(p));

      if (foundStack || foundFramework || foundPath) {
        issues.push({
          title: "Error page reveals server details",
          description: `The 404 error page exposes ${[
            foundStack ? "stack traces" : "",
            foundFramework ? `framework name (${foundFramework})` : "",
            foundPath ? "server file paths" : "",
          ].filter(Boolean).join(", ")}.`,
          fixSuggestion: "Configure custom error pages that do not reveal any server-side implementation details.",
          severity: "medium",
          impact: "Stack traces and paths help attackers map the application internals.",
          effort: "30 minutes"
        });
      } else {
        passedChecks.push("Error pages do not leak server details");
      }
    }
  } catch {
    // skip
  }

  // GraphQL introspection
  try {
    const gqlRes = await safeFetchWithTimeout(`${origin}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ __schema { types { name } } }" }),
    }, 10000);

    if (gqlRes && gqlRes.ok) {
      try {
        const gqlBody = await gqlRes.text();
        if (gqlBody.includes("__schema")) {
          issues.push({
            title: "GraphQL introspection enabled",
            description: "The GraphQL endpoint allows introspection queries, exposing the entire API schema.",
            fixSuggestion: "Disable introspection in production. Most GraphQL servers have a configuration option for this.",
            severity: "critical",
            impact: "Attackers can map every query, mutation, and type in your API.",
            effort: "15 minutes"
          });
        }
      } catch {
        // skip
      }
    }
  } catch {
    // skip
  }

  if (detectedTech.length > 0) {
    data.detected = detectedTech.join(", ");
  }

  let score = 100;
  for (const i of issues) {
    if (i.severity === "critical") score -= 15;
    else if (i.severity === "medium") score -= 8;
    else score -= 3;
  }
  score = Math.max(0, Math.min(100, score));

  return { moduleName: "cms", issues, passedChecks, score, data };
}
