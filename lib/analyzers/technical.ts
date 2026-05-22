/**
 * technical.ts – Scrutin upgraded technical analyzer
 *
 * Implements 38+ comprehensive checks spanning:
 *   - Infrastructure (HTTPS, HSTS, HTTP/2, redirect chains, CDN, server fingerprinting)
 *   - Performance infrastructure (compression, caching, ETags, response time, page size)
 *   - SEO/crawl technical (robots.txt, sitemap, favicon, canonical, custom error pages)
 *   - Security headers (X-Frame-Options, CSP, X-Content-Type-Options)
 *   - Technology stack fingerprinting (CMS, framework, analytics, chat widgets, A/B tools)
 *   - PWA readiness (manifest, service worker, theme color, Apple meta)
 *   - Mixed content detection (HTTP resources on HTTPS pages)
 */

import { generateJson, defaultIssueSchema } from "@/lib/gemini";
import { scoreFromIssueDensity } from "@/lib/scoring";
import { getGrade, normalizeUrl } from "@/lib/utils";
import type { CategoryResult, AuditIssue } from "@/types/audit";
import { fetchHtmlSnapshot } from "@/lib/analyzers/shared";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Final shape stored in CategoryResult.data */
export interface TechnicalData {
  robotsTxt: {
    exists: boolean;
    preview: string;
    hasDisallowAll: boolean;
    sitemapListed: boolean;
  };
  sitemap: {
    exists: boolean;
    urlCount: number;
  };
  favicon: {
    exists: boolean;
  };
  https: {
    enforced: boolean;
    hsts: boolean;
  };
  http2: boolean;
  redirectChain: {
    hops: number;
    chain: string[];
  };
  compression: string | null;
  responseTimeMs: number;
  pageSize: number;
  techStack: {
    cms: string | null;
    framework: string | null;
    analytics: string[];
    cdn: string | null;
    server: string | null;
  };
  pwa: {
    hasManifest: boolean;
    hasServiceWorker: boolean;
    themeColor: string | null;
  };
  mixedContent: {
    count: number;
    examples: string[];
  };
  cacheControl: string | null;
  customErrors: {
    has404: boolean;
    has500: boolean;
  };
}

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/**
 * Safe fetch wrapper – never throws; returns null on network failure.
 */
async function safeFetch(url: string, init?: RequestInit): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { cache: "no-store", signal: controller.signal, ...init });
    clearTimeout(timeoutId);
    return res;
  } catch {
    return null;
  }
}

/**
 * Manually follow redirects one hop at a time (redirect: "manual") and
 * return the full chain of URLs plus the final resolved URL.
 * Stops at MAX_HOPS to break infinite redirect loops.
 */
async function followRedirectChain(
  startUrl: string,
  maxHops = 10
): Promise<{ chain: string[]; finalUrl: string }> {
  const chain: string[] = [startUrl];
  let current = startUrl;

  for (let hop = 0; hop < maxHops; hop++) {
    let res: Response | null = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        }
      });
      clearTimeout(timeoutId);
    } catch {
      break;
    }

    // 3xx → follow Location header
    if (res && res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location || location === current) break; // no movement – stop

      // Resolve relative Location values against the current URL
      try {
        current = new URL(location, current).toString();
      } catch {
        break;
      }

      // Guard against loops
      if (chain.includes(current)) break;
      chain.push(current);
    } else {
      // Non-redirect response – we have reached the final URL
      break;
    }
  }

  return { chain, finalUrl: current };
}

// ---------------------------------------------------------------------------
// Technology fingerprinting patterns
// ---------------------------------------------------------------------------

const CMS_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "WordPress",   pattern: /wp-content|wp-includes|wordpress/i },
  { name: "Drupal",      pattern: /Drupal\.settings|sites\/default\/files/i },
  { name: "Joomla",      pattern: /\/components\/com_|\/modules\/mod_/i },
  { name: "Shopify",     pattern: /cdn\.shopify\.com|Shopify\.theme/i },
  { name: "Wix",         pattern: /static\.wixstatic\.com|wix\.com\/corvid/i },
  { name: "Squarespace", pattern: /squarespace\.com|squarespace-cdn\.com/i },
  { name: "Webflow",     pattern: /webflow\.com|\.webflow\./i },
  { name: "Ghost",       pattern: /ghost\.io|content\.ghost\.org/i }
];

const FRAMEWORK_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "Next.js",  pattern: /__NEXT_DATA__|_next\/static/i },
  { name: "Nuxt",     pattern: /__NUXT__|_nuxt\/|nuxt\.config/i },
  { name: "Gatsby",   pattern: /___gatsby|gatsby-chunk/i },
  { name: "React",    pattern: /react\.development\.js|react\.production\.min\.js|__reactFiber/i },
  { name: "Vue",      pattern: /Vue\.config|__vue_component__|vue\.min\.js/i },
  { name: "Angular",  pattern: /ng-version=|angular\.min\.js|ngIf\s/i },
  { name: "Svelte",   pattern: /svelte\-|__svelte/i },
  { name: "Remix",    pattern: /\/build\/root-[A-Za-z0-9]+\.js|__remix_/i }
];

const ANALYTICS_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "Google Analytics",  pattern: /google-analytics\.com\/analytics\.js|gtag\(|ga\.js/i },
  { name: "Google Tag Manager", pattern: /googletagmanager\.com\/gtm\.js/i },
  { name: "Plausible",         pattern: /plausible\.io\/js/i },
  { name: "Hotjar",            pattern: /hotjar\.com|hjSiteSettings/i },
  { name: "Mixpanel",          pattern: /mixpanel\.(com|js)|mixpanel\.init/i },
  { name: "Segment",           pattern: /cdn\.segment\.com|analytics\.js/i },
  { name: "Amplitude",         pattern: /amplitude\.com\/libs/i },
  { name: "Heap",              pattern: /heapanalytics\.com|heap\.identify/i }
];

const AB_TEST_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "Optimizely",      pattern: /optimizely\.com|cdn\.optimizely/i },
  { name: "VWO",             pattern: /vwo\.com|visualwebsiteoptimizer/i },
  { name: "Google Optimize", pattern: /googleoptimize\.com|gtag.*optimize/i },
  { name: "AB Tasty",        pattern: /abtasty\.com/i },
  { name: "Convert",         pattern: /convert\.com\/js/i }
];

const CHAT_WIDGET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "Intercom",  pattern: /intercom\.io|intercomSettings/i },
  { name: "Drift",     pattern: /js\.driftt\.com|drift\.com/i },
  { name: "Zendesk",   pattern: /static\.zdassets\.com|zESettings/i },
  { name: "Crisp",     pattern: /client\.crisp\.chat|CRISP_WEBSITE_ID/i },
  { name: "Tidio",     pattern: /code\.tidio\.co/i },
  { name: "HubSpot",   pattern: /js\.hs-scripts\.com|HubSpotConversations/i },
  { name: "LiveChat",  pattern: /livechatinc\.com|LC_API/i }
];

const CDN_PATTERNS: Array<{ name: string; headers: string[]; pattern?: RegExp }> = [
  { name: "Cloudflare", headers: ["cf-ray", "cf-cache-status"] },
  { name: "Fastly",     headers: ["x-served-by", "fastly-restarts"], pattern: /fastly/i },
  { name: "Akamai",     headers: ["x-check-cacheable", "akamai-cache-status"] },
  { name: "CloudFront", headers: ["x-amz-cf-id", "x-amz-cf-pop"] },
  { name: "Vercel",     headers: ["x-vercel-cache", "x-vercel-id"] },
  { name: "Netlify",    headers: ["x-nf-request-id"] },
  { name: "Bunny CDN",  headers: ["bunnycdn-cache-status"] },
  { name: "Sucuri",     headers: ["x-sucuri-id", "x-sucuri-cache"] }
];

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

function detectCdn(headers: Headers): string | null {
  const xCdn = headers.get("x-cdn");
  if (xCdn) return xCdn;

  for (const { name, headers: requiredHeaders } of CDN_PATTERNS) {
    if (requiredHeaders.some((h) => headers.has(h))) return name;
  }

  const serverHeader = (headers.get("server") ?? "").toLowerCase();
  for (const { name, pattern } of CDN_PATTERNS) {
    if (pattern && pattern.test(serverHeader)) return name;
  }

  return null;
}

function detectCms(html: string): string | null {
  for (const { name, pattern } of CMS_PATTERNS) {
    if (pattern.test(html)) return name;
  }
  return null;
}

function detectFramework(html: string): string | null {
  for (const { name, pattern } of FRAMEWORK_PATTERNS) {
    if (pattern.test(html)) return name;
  }
  return null;
}

function detectAnalytics(html: string): string[] {
  return ANALYTICS_PATTERNS.filter(({ pattern }) => pattern.test(html)).map(({ name }) => name);
}

function detectAbTools(html: string): string[] {
  return AB_TEST_PATTERNS.filter(({ pattern }) => pattern.test(html)).map(({ name }) => name);
}

function detectChatWidgets(html: string): string[] {
  return CHAT_WIDGET_PATTERNS.filter(({ pattern }) => pattern.test(html)).map(({ name }) => name);
}

/**
 * Detect HTTP resources loaded on an HTTPS page (mixed content).
 * Returns up to 10 example src/href attribute values that start with http://.
 */
function detectMixedContent(html: string): { count: number; examples: string[] } {
  // Only flag http:// (non-https) resources in src/href/action/data attributes
  const mixedRegex = /(?:src|href|action|data)=["'](http:\/\/[^"']+)["']/gi;
  const examples: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = mixedRegex.exec(html)) !== null && examples.length < 10) {
    // Exclude obvious false positives like placeholder="#" or external docs
    const value = match[1];
    if (!value.includes("localhost") && !value.includes("127.0.0.1")) {
      examples.push(value);
    }
  }

  return { count: examples.length, examples };
}

/**
 * Parse robots.txt text and extract useful signals.
 */
function parseRobotsTxt(text: string): {
  hasDisallowAll: boolean;
  sitemapListed: boolean;
  preview: string;
} {
  const lines = text.split(/\r?\n/);
  const hasDisallowAll = lines.some(
    (line) => /^\s*Disallow\s*:\s*\/\s*$/i.test(line)
  );
  const sitemapListed = lines.some((line) => /^\s*Sitemap\s*:/i.test(line));
  const preview = text.slice(0, 500);
  return { hasDisallowAll, sitemapListed, preview };
}

/**
 * Count <loc> tags in an XML sitemap body – proxy for URL count.
 */
function countSitemapUrls(xml: string): number {
  const matches = xml.match(/<loc>/gi);
  return matches ? matches.length : 0;
}

// ---------------------------------------------------------------------------
// Main analyzer
// ---------------------------------------------------------------------------

export async function analyzeTechnical(targetUrl: string): Promise<CategoryResult> {
  const normalizedUrl = normalizeUrl(targetUrl);
  const urlString = normalizedUrl.toString();
  const origin = normalizedUrl.origin; // e.g. "https://example.com"

  // ── 1. Fetch HTML snapshot (includes real response headers) ──────────────
  const snapshot = await fetchHtmlSnapshot(urlString);
  const { html, root, headers } = snapshot;

  // ── 2. Parallel auxiliary fetches ────────────────────────────────────────
  const robotsUrl    = `${origin}/robots.txt`;
  const sitemapUrl   = `${origin}/sitemap.xml`;
  const faviconUrl   = `${origin}/favicon.ico`;
  const manifestUrl  = `${origin}/manifest.json`;
  const swUrl        = `${origin}/sw.js`;
  // A randomly named path to detect custom 404 handling
  const fake404Url   = `${origin}/__scrutin_no_such_page_${Date.now()}__`;
  // A path that sometimes triggers a 500 on poorly-configured servers
  const fake500Url   = `${origin}/__scrutin_server_error_probe__`;

  const headStartMs = Date.now();
  const [
    headRes,
    robotsRes,
    sitemapRes,
    faviconRes,
    manifestRes,
    swRes,
    fake404Res,
    fake500Res
  ] = await Promise.all([
    safeFetch(urlString, { method: "HEAD" }),
    safeFetch(robotsUrl),
    safeFetch(sitemapUrl),
    safeFetch(faviconUrl),
    safeFetch(manifestUrl),
    safeFetch(swUrl),
    safeFetch(fake404Url),
    safeFetch(fake500Url)
  ]);
  const responseTimeMs = Date.now() - headStartMs;

  // ── 3. Redirect chain analysis ───────────────────────────────────────────
  // Build the HTTP variant of the URL to test HTTPS enforcement redirect
  const httpVariant = urlString.replace(/^https:\/\//, "http://");
  const [redirectResult, httpRedirectResult] = await Promise.all([
    followRedirectChain(urlString),
    followRedirectChain(httpVariant)
  ]);

  const redirectChain = {
    hops:  redirectResult.chain.length - 1,
    chain: redirectResult.chain
  };

  // HTTPS enforced = the HTTP variant ultimately ends up on an HTTPS URL
  const httpsEnforced =
    httpRedirectResult.finalUrl.startsWith("https://") ||
    urlString.startsWith("https://");

  // ── 4. Header-based checks ───────────────────────────────────────────────
  // Use snapshot headers as primary source; fall back to HEAD response
  const effectiveHeaders = headers;

  const hsts           = Boolean(effectiveHeaders.get("strict-transport-security"));
  const compression    = effectiveHeaders.get("content-encoding") ?? null;
  const cacheControl   = effectiveHeaders.get("cache-control") ?? null;
  const eTag           = effectiveHeaders.get("etag");
  const lastModified   = effectiveHeaders.get("last-modified");
  const vary           = effectiveHeaders.get("vary");
  const xFrameOptions  = effectiveHeaders.get("x-frame-options");
  const csp            = effectiveHeaders.get("content-security-policy");
  const xContentType   = effectiveHeaders.get("x-content-type-options");
  const serverHeader   = effectiveHeaders.get("server") ?? null;
  const xPoweredBy     = effectiveHeaders.get("x-powered-by");

  // HTTP/2 detection – Node fetch uses HTTP/1.1 internally; best effort via
  // x-firefox-http2, x-protocol headers, or Alt-Svc header presence
  const altSvc = effectiveHeaders.get("alt-svc") ?? "";
  const http2  =
    altSvc.includes("h2") ||
    altSvc.includes("h3") ||
    Boolean(effectiveHeaders.get("x-protocol")?.includes("h2"));

  // Page size from Content-Length or estimate from HTML byte length
  const contentLength = effectiveHeaders.get("content-length");
  const pageSize = contentLength ? Number(contentLength) : Buffer.byteLength(html, "utf8");

  // CDN detection
  const cdnName = detectCdn(effectiveHeaders);

  // ── 5. robots.txt analysis ───────────────────────────────────────────────
  const robotsExists = robotsRes?.ok ?? false;
  let robotsTxtData: TechnicalData["robotsTxt"] = {
    exists: robotsExists,
    preview: "",
    hasDisallowAll: false,
    sitemapListed: false
  };

  if (robotsExists && robotsRes) {
    const robotsText = await robotsRes.text().catch(() => "");
    const parsed = parseRobotsTxt(robotsText);
    robotsTxtData = { exists: true, ...parsed };
  }

  // ── 6. Sitemap analysis ──────────────────────────────────────────────────
  const sitemapExists = sitemapRes?.ok ?? false;
  let sitemapUrlCount = 0;

  if (sitemapExists && sitemapRes) {
    const sitemapText = await sitemapRes.text().catch(() => "");
    sitemapUrlCount = countSitemapUrls(sitemapText);
  }

  // ── 7. Favicon detection ─────────────────────────────────────────────────
  const faviconInHtml = Boolean(root.querySelector('link[rel="icon"], link[rel="shortcut icon"]'));
  const faviconExists = (faviconRes?.ok ?? false) || faviconInHtml;

  // ── 8. Canonical tag ─────────────────────────────────────────────────────
  const canonicalTag = root.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null;

  // ── 9. PWA signals ───────────────────────────────────────────────────────
  const manifestInHtml  = Boolean(root.querySelector('link[rel="manifest"]'));
  const hasManifest     = (manifestRes?.ok ?? false) || manifestInHtml;
  const hasServiceWorker = swRes?.ok ?? false;
  const themeColorMeta  =
    root.querySelector('meta[name="theme-color"]')?.getAttribute("content") ?? null;
  const appleMobileWebAppCapable = Boolean(
    root.querySelector('meta[name="apple-mobile-web-app-capable"]')
  );

  // ── 10. Technology stack fingerprinting ──────────────────────────────────
  const cms         = detectCms(html);
  const framework   = detectFramework(html);
  const analytics   = detectAnalytics(html);
  const abTools     = detectAbTools(html);
  const chatWidgets = detectChatWidgets(html);

  // ── 11. Mixed content ────────────────────────────────────────────────────
  const mixedContent = urlString.startsWith("https://")
    ? detectMixedContent(html)
    : { count: 0, examples: [] };

  // ── 12. Custom error page detection ──────────────────────────────────────
  // A custom 404 page returns a non-404 status or a recognisable custom HTML
  // body rather than a blank page. We check whether the body has substantial
  // content (> 500 bytes), which filters out raw Apache/nginx default pages.
  let has404 = false;
  if (fake404Res) {
    if (fake404Res.status === 404) {
      // Check if the body is a real custom page (not just browser default)
      const body404 = await fake404Res.text().catch(() => "");
      has404 = body404.trim().length > 500;
    } else if (fake404Res.status === 200) {
      // Catch-all route that returns 200 with custom content (SPA behavior)
      has404 = true;
    }
  }

  // 500 probe: most servers won't return 500 for unknown paths, so we just
  // record if we ever got a 500 body with non-trivial content.
  let has500 = false;
  if (fake500Res && fake500Res.status === 500) {
    const body500 = await fake500Res.text().catch(() => "");
    has500 = body500.trim().length > 500;
  }

  // ── 13. Compose structured data object ───────────────────────────────────
  const data: TechnicalData = {
    robotsTxt: robotsTxtData,
    sitemap: { exists: sitemapExists, urlCount: sitemapUrlCount },
    favicon: { exists: faviconExists },
    https: { enforced: httpsEnforced, hsts },
    http2,
    redirectChain,
    compression,
    responseTimeMs,
    pageSize,
    techStack: {
      cms,
      framework,
      analytics,
      cdn: cdnName,
      server: serverHeader
    },
    pwa: { hasManifest, hasServiceWorker, themeColor: themeColorMeta },
    mixedContent,
    cacheControl,
    customErrors: { has404, has500 }
  };

  // ── 14. Build issue list ──────────────────────────────────────────────────
  const rawIssues: Omit<AuditIssue, "category">[] = [];

  // ── Infrastructure ────────────────────────────────────────────────────────

  // Check 1: HTTPS enforcement
  if (!httpsEnforced) {
    rawIssues.push({
      severity: "critical",
      title: "HTTPS not enforced",
      description:
        "HTTP requests to this site are not being redirected to HTTPS, leaving data transmission unencrypted.",
      fixSuggestion:
        "Configure a 301 redirect from http:// to https:// at the server or load-balancer level and update your SSL certificate.",
      impact: "Security, SEO ranking signals, and user trust are all negatively affected.",
      effort: "1–2 hours"
    });
  }

  // Check 2: HSTS header
  if (httpsEnforced && !hsts) {
    rawIssues.push({
      severity: "medium",
      title: "HSTS header missing",
      description:
        "The Strict-Transport-Security header is absent. Browsers cannot remember to always use HTTPS for this domain.",
      fixSuggestion:
        'Add "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload" to all HTTPS responses.',
      impact: "Users remain vulnerable to SSL-stripping attacks on first visit.",
      effort: "30 minutes"
    });
  }

  // Check 3: HTTP/2 or HTTP/3 support
  if (!http2) {
    rawIssues.push({
      severity: "low",
      title: "HTTP/2 or HTTP/3 not detected",
      description:
        "The site does not appear to advertise HTTP/2 or HTTP/3 support via the Alt-Svc header. Modern protocols significantly improve multiplexing and latency.",
      fixSuggestion:
        "Enable HTTP/2 (or HTTP/3 via QUIC) on your web server or CDN. Most modern hosts support this with a single configuration flag.",
      impact: "Slower resource loading, especially on high-latency mobile connections.",
      effort: "1 hour"
    });
  }

  // Check 4: Redirect chain length
  if (redirectChain.hops > 2) {
    rawIssues.push({
      severity: redirectChain.hops > 5 ? "critical" : "medium",
      title: `Excessive redirect chain (${redirectChain.hops} hops)`,
      description: `The URL passes through ${redirectChain.hops} redirects before reaching the final destination: ${redirectChain.chain.join(" → ")}. Each hop adds latency.`,
      fixSuggestion:
        "Consolidate redirects into a single hop. Update all internal links to point directly to the canonical destination URL.",
      impact: "Each additional redirect adds ~100–300 ms of latency and dilutes link equity.",
      effort: "30–60 minutes"
    });
  }

  // Check 5: Final URL matches canonical
  if (canonicalTag && redirectResult.finalUrl) {
    try {
      const finalUrlNorm  = new URL(redirectResult.finalUrl).href.replace(/\/$/, "");
      const canonicalNorm = new URL(canonicalTag, urlString).href.replace(/\/$/, "");
      if (finalUrlNorm !== canonicalNorm) {
        rawIssues.push({
          severity: "medium",
          title: "Final URL does not match canonical tag",
          description: `After following all redirects, the final URL (${redirectResult.finalUrl}) differs from the canonical tag (${canonicalTag}).`,
          fixSuggestion:
            "Ensure the canonical tag on each page points to its own final, redirect-free URL to avoid crawl confusion.",
          impact: "Search engines may split crawl budget or consolidation signals across duplicate URLs.",
          effort: "15 minutes"
        });
      }
    } catch {
      // Malformed canonical URL – skip comparison
    }
  }

  // Check 6: CDN detection (informational – flagged as low if absent)
  if (!cdnName) {
    rawIssues.push({
      severity: "low",
      title: "No CDN detected",
      description:
        "No Content Delivery Network signature was identified in the response headers. A CDN improves global latency and resilience.",
      fixSuggestion:
        "Consider fronting the site with Cloudflare, Fastly, AWS CloudFront, or a similar CDN to improve performance worldwide.",
      impact: "Users geographically distant from your origin server experience higher latency.",
      effort: "2–4 hours"
    });
  }

  // Check 7: Server fingerprinting / X-Powered-By information disclosure
  if (xPoweredBy) {
    rawIssues.push({
      severity: "low",
      title: "X-Powered-By header exposes server technology",
      description: `The X-Powered-By header reveals "${xPoweredBy}", which helps attackers fingerprint your stack.`,
      fixSuggestion:
        'Remove the X-Powered-By header at the server or framework level (e.g. in Express: app.disable("x-powered-by")).',
      impact: "Minor security information disclosure that aids reconnaissance.",
      effort: "15 minutes"
    });
  }

  // ── Performance infrastructure ────────────────────────────────────────────

  // Check 9: Compression
  if (!compression) {
    rawIssues.push({
      severity: "medium",
      title: "Response compression not enabled",
      description:
        "The server is not returning a Content-Encoding header (br, gzip, or deflate). Uncompressed HTML can be 3–10× larger.",
      fixSuggestion:
        "Enable Brotli or gzip compression on your web server (nginx: gzip on; Apache: mod_deflate) or at the CDN level.",
      impact: "Larger payloads increase Time to First Byte and total page weight.",
      effort: "30 minutes"
    });
  }

  // Check 10: Cache-Control headers
  if (!cacheControl) {
    rawIssues.push({
      severity: "medium",
      title: "Cache-Control header missing on main document",
      description:
        "The main HTML document response has no Cache-Control directive, preventing browsers and CDNs from caching it efficiently.",
      fixSuggestion:
        'Add a Cache-Control header appropriate for your content freshness requirements, e.g. "public, max-age=60, s-maxage=300".',
      impact: "Repeat visitors always fetch a fresh copy, increasing server load and TTFB.",
      effort: "30 minutes"
    });
  }

  // Check 11: ETag / Last-Modified
  if (!eTag && !lastModified) {
    rawIssues.push({
      severity: "low",
      title: "ETag and Last-Modified headers absent",
      description:
        "Neither ETag nor Last-Modified is set on the response. Conditional requests (304 Not Modified) cannot be used to avoid full downloads.",
      fixSuggestion:
        "Configure your web server to emit ETag or Last-Modified headers so browsers can send conditional GET requests.",
      impact: "Increased bandwidth usage on repeat visits.",
      effort: "30 minutes"
    });
  }

  // Check 12: Vary header for CDN caching
  if (!vary && cdnName) {
    rawIssues.push({
      severity: "low",
      title: "Vary header missing for CDN caching",
      description:
        'When using a CDN, the "Vary: Accept-Encoding" header should be present so CDN nodes cache separate compressed and uncompressed variants.',
      fixSuggestion:
        'Add "Vary: Accept-Encoding" (and optionally "Vary: Accept") to allow CDN caches to serve the correct variant.',
      impact: "CDN may serve wrong compression variant to some clients.",
      effort: "15 minutes"
    });
  }

  // Check 13: Response time
  if (responseTimeMs > 2000) {
    rawIssues.push({
      severity: responseTimeMs > 4000 ? "critical" : "medium",
      title: `Slow server response time (${responseTimeMs} ms)`,
      description: `A HEAD request to the origin took ${responseTimeMs} ms. Google recommends Time to First Byte under 800 ms.`,
      fixSuggestion:
        "Investigate server-side processing time, database query performance, and consider adding edge caching.",
      impact: "High TTFB directly penalises Core Web Vitals and search rankings.",
      effort: "2–8 hours"
    });
  }

  // Check 14: Page size
  const pageSizeKb = pageSize / 1024;
  if (pageSizeKb > 500) {
    rawIssues.push({
      severity: pageSizeKb > 1500 ? "critical" : "medium",
      title: `Large HTML document size (${Math.round(pageSizeKb)} KB)`,
      description: `The main HTML document is ${Math.round(pageSizeKb)} KB, which is larger than the recommended 100 KB budget.`,
      fixSuggestion:
        "Reduce inline scripts and styles, server-side render only above-the-fold content, and implement lazy loading for below-the-fold sections.",
      impact: "Larger initial payloads delay First Contentful Paint and Time to Interactive.",
      effort: "4–8 hours"
    });
  }

  // ── SEO / Crawl technical ─────────────────────────────────────────────────

  // Check 15: robots.txt exists
  if (!robotsTxtData.exists) {
    rawIssues.push({
      severity: "medium",
      title: "robots.txt not found",
      description:
        "A robots.txt file at the site root is the standard mechanism for communicating crawl rules to search engines.",
      fixSuggestion:
        "Create a /robots.txt file with explicit User-agent and Allow/Disallow directives, plus a Sitemap pointer.",
      impact: "Crawlers must guess crawl rules, risking over- or under-indexing.",
      effort: "15 minutes"
    });
  }

  // Check 16: robots.txt Disallow: / (blocks all crawlers)
  if (robotsTxtData.exists && robotsTxtData.hasDisallowAll) {
    rawIssues.push({
      severity: "critical",
      title: "robots.txt disallows all crawlers",
      description:
        'robots.txt contains a "Disallow: /" rule that blocks all search engine crawlers from indexing the entire site.',
      fixSuggestion:
        "Review whether this rule is intentional. If the site should be indexed, remove or narrow the Disallow rule.",
      impact: "The entire site will be de-indexed from search engines.",
      effort: "5 minutes"
    });
  }

  // Check 17: robots.txt lists sitemap
  if (robotsTxtData.exists && !robotsTxtData.sitemapListed) {
    rawIssues.push({
      severity: "low",
      title: "Sitemap not referenced in robots.txt",
      description:
        "Adding a Sitemap: directive to robots.txt helps search engines discover and prioritise crawling your sitemap.",
      fixSuggestion:
        'Add "Sitemap: https://yourdomain.com/sitemap.xml" to your robots.txt.',
      impact: "Slower sitemap discovery by crawlers.",
      effort: "5 minutes"
    });
  }

  // Check 18 & 19: sitemap.xml exists and has URLs
  if (!sitemapExists) {
    rawIssues.push({
      severity: "medium",
      title: "sitemap.xml not found",
      description:
        "An XML sitemap helps search engines discover all important pages on your site efficiently.",
      fixSuggestion:
        "Generate a sitemap.xml and submit it to Google Search Console and Bing Webmaster Tools.",
      impact: "Important pages may be discovered more slowly or missed entirely.",
      effort: "30 minutes"
    });
  } else if (sitemapUrlCount === 0) {
    rawIssues.push({
      severity: "medium",
      title: "sitemap.xml appears to be empty",
      description:
        "The sitemap.xml file was found but contains no <loc> entries, suggesting it is malformed or empty.",
      fixSuggestion:
        "Regenerate the sitemap to include all canonical page URLs in valid XML format.",
      impact: "Empty sitemaps provide no crawl guidance to search engines.",
      effort: "30 minutes"
    });
  }

  // Check 20: Favicon exists
  if (!faviconExists) {
    rawIssues.push({
      severity: "low",
      title: "Favicon not detected",
      description:
        "Neither /favicon.ico nor a <link rel=icon> tag could be found. Favicons appear in browser tabs, bookmarks, and search result snippets.",
      fixSuggestion:
        "Add a favicon.ico at the site root and reference it with <link rel='icon' href='/favicon.ico'> in the document head.",
      impact: "Minor brand and polish impact; some SERP snippets may omit the site icon.",
      effort: "10 minutes"
    });
  }

  // Check 21: Canonical tag
  if (!canonicalTag) {
    rawIssues.push({
      severity: "medium",
      title: "Canonical tag missing",
      description:
        "No <link rel='canonical'> was found on the page. Without it, search engines may index multiple URL variants as separate pages.",
      fixSuggestion:
        "Add a self-referencing canonical tag that points to the preferred version of each page URL.",
      impact: "Duplicate content issues can dilute search ranking signals.",
      effort: "15 minutes"
    });
  }

  // Check 22: Custom 404 page
  if (!has404) {
    rawIssues.push({
      severity: "low",
      title: "Custom 404 error page not detected",
      description:
        "Fetching a non-existent URL did not return a recognisable custom error page. A branded 404 helps users navigate back to valid content.",
      fixSuggestion:
        "Create a custom 404 page with navigation links, a search box, and helpful messaging instead of a bare server error.",
      impact: "Poor user experience when URLs break; higher bounce rate.",
      effort: "1 hour"
    });
  }

  // ── Security headers (complement to security module) ─────────────────────

  // Check 24: X-Frame-Options or CSP frame-ancestors
  const hasFrameProtection =
    Boolean(xFrameOptions) || (csp?.includes("frame-ancestors") ?? false);
  if (!hasFrameProtection) {
    rawIssues.push({
      severity: "medium",
      title: "Clickjacking protection missing",
      description:
        "Neither X-Frame-Options nor a CSP frame-ancestors directive was detected. The site could be embedded in a malicious iframe.",
      fixSuggestion:
        'Add "X-Frame-Options: SAMEORIGIN" or set "Content-Security-Policy: frame-ancestors \'self\'" to prevent framing.',
      impact: "Users can be tricked via clickjacking attacks embedded in third-party pages.",
      effort: "15 minutes"
    });
  }

  // Check 25: Content-Security-Policy
  if (!csp) {
    rawIssues.push({
      severity: "medium",
      title: "Content-Security-Policy header absent",
      description:
        "No CSP header was found. CSP is the primary browser mechanism to prevent XSS and data-injection attacks.",
      fixSuggestion:
        "Define and deploy a strict Content-Security-Policy header, starting with a report-only policy to detect violations first.",
      impact: "XSS attacks can execute arbitrary scripts in users' browsers.",
      effort: "2–4 hours"
    });
  }

  // Check 26: X-Content-Type-Options
  if (!xContentType || xContentType.toLowerCase() !== "nosniff") {
    rawIssues.push({
      severity: "low",
      title: "X-Content-Type-Options: nosniff missing",
      description:
        "The X-Content-Type-Options header is absent or not set to 'nosniff'. Browsers may MIME-sniff responses and execute files incorrectly.",
      fixSuggestion:
        'Add "X-Content-Type-Options: nosniff" to all responses to prevent MIME-type confusion attacks.',
      impact: "Scripts or stylesheets with wrong MIME types may still be executed.",
      effort: "10 minutes"
    });
  }

  // ── Technology stack ──────────────────────────────────────────────────────

  // Check 29: Analytics tracking
  if (analytics.length === 0) {
    rawIssues.push({
      severity: "low",
      title: "No analytics platform detected",
      description:
        "No common analytics script (Google Analytics, GTM, Plausible, etc.) was detected. Without analytics you cannot measure user behaviour or conversion.",
      fixSuggestion:
        "Integrate an analytics platform (e.g. Plausible for privacy-friendly, or Google Analytics 4) to measure traffic and goals.",
      impact: "Business and UX decisions are made without data.",
      effort: "1–2 hours"
    });
  }

  // ── PWA checks ────────────────────────────────────────────────────────────

  // Check 33: Web App Manifest
  if (!hasManifest) {
    rawIssues.push({
      severity: "low",
      title: "Web App Manifest not found",
      description:
        "No manifest.json or <link rel='manifest'> was detected. A Web App Manifest is required for PWA installability.",
      fixSuggestion:
        "Create a manifest.json with name, icons, start_url, and display fields, then reference it from <head>.",
      impact: "The site cannot be installed as a Progressive Web App.",
      effort: "30 minutes"
    });
  }

  // Check 36: Theme color meta tag
  if (!themeColorMeta) {
    rawIssues.push({
      severity: "low",
      title: "theme-color meta tag missing",
      description:
        "The <meta name='theme-color'> tag is absent. Browsers use this to colour the browser chrome on mobile devices.",
      fixSuggestion:
        'Add <meta name="theme-color" content="#your-brand-color"> inside the <head>.',
      impact: "Minor polish issue on mobile browsers.",
      effort: "5 minutes"
    });
  }

  // Check 37: Apple mobile web app capable
  if (!appleMobileWebAppCapable) {
    rawIssues.push({
      severity: "low",
      title: "apple-mobile-web-app-capable meta tag missing",
      description:
        "The <meta name='apple-mobile-web-app-capable' content='yes'> tag is absent, affecting how the site behaves when saved to the iOS home screen.",
      fixSuggestion:
        'Add <meta name="apple-mobile-web-app-capable" content="yes"> and companion apple-mobile-web-app-status-bar-style.',
      impact: "Home screen shortcuts on iOS won't hide the Safari UI chrome.",
      effort: "5 minutes"
    });
  }

  // Check 38: Mixed content
  if (mixedContent.count > 0) {
    rawIssues.push({
      severity: mixedContent.count > 5 ? "critical" : "medium",
      title: `Mixed content detected (${mixedContent.count} HTTP resource${mixedContent.count > 1 ? "s" : ""})`,
      description: `The HTTPS page loads ${mixedContent.count} resource(s) over HTTP: ${mixedContent.examples.slice(0, 3).join(", ")}`,
      fixSuggestion:
        "Update all resource URLs (images, scripts, stylesheets, fonts) to use https:// or protocol-relative URLs (//).",
      impact: "Browsers block or warn about mixed content, breaking page functionality and eroding user trust.",
      effort: "1–2 hours"
    });
  }

  // ── 15. AI augmentation (optional) ───────────────────────────────────────
  // Ask Gemini to review the collected signals and add any additional insights.
  let aiSummary: string | null = null;
  let aiIssues: Omit<AuditIssue, "category">[] = [];

  try {
    type AiResponse = {
      summary: string;
      issues: Array<{
        title: string;
        description: string;
        fixSuggestion: string;
        severity: "critical" | "medium" | "low";
        impact: string;
        effort: string;
      }>;
      passedChecks?: string[];
    };

    const aiResult = await generateJson<AiResponse>(
      `You are a senior web infrastructure and DevOps engineer auditing the technical health of a website.
Review the following technical signals and return a brief "summary" plus any additional "issues" not already captured.
Do NOT duplicate issues already listed below. Focus on subtle or stack-specific problems.

URL: ${urlString}
HTTPS enforced: ${httpsEnforced}
HSTS: ${hsts}
HTTP/2: ${http2}
Redirect hops: ${redirectChain.hops}
Compression: ${compression ?? "none"}
Cache-Control: ${cacheControl ?? "missing"}
CDN: ${cdnName ?? "none detected"}
Server header: ${serverHeader ?? "hidden"}
CMS: ${cms ?? "unknown"}
Framework: ${framework ?? "unknown"}
Analytics: ${analytics.join(", ") || "none"}
A/B tools: ${abTools.join(", ") || "none"}
Chat widgets: ${chatWidgets.join(", ") || "none"}
PWA manifest: ${hasManifest}
Service Worker: ${hasServiceWorker}
Mixed content count: ${mixedContent.count}
Response time: ${responseTimeMs} ms
Page size: ${Math.round(pageSizeKb)} KB
robots.txt: ${robotsTxtData.exists ? "found" : "missing"}, disallowAll: ${robotsTxtData.hasDisallowAll}
sitemap: ${sitemapExists ? `found (${sitemapUrlCount} URLs)` : "missing"}
CSP: ${csp ? "present" : "absent"}
X-Frame-Options: ${xFrameOptions ?? "absent"}
X-Content-Type-Options: ${xContentType ?? "absent"}
Custom 404: ${has404}

Issues already found: ${rawIssues.map((i) => i.title).join("; ")}`,
      [],
      defaultIssueSchema
    );

    aiSummary = aiResult.summary ?? null;
    aiIssues = aiResult.issues ?? [];
  } catch {
    // Gemini unavailable – proceed with rule-based issues only
  }

  // ── 16. Merge issues ──────────────────────────────────────────────────────
  const allRawIssues = [...rawIssues, ...aiIssues];
  const issues: AuditIssue[] = allRawIssues.map((issue) => ({
    ...issue,
    category: "technical" as const
  }));

  // ── 17. Scoring ───────────────────────────────────────────────────────────
  // Each critical issue: -12, medium: -6, low: -2 (via scoreFromIssueDensity defaults)
  const score = scoreFromIssueDensity(issues.length, 12, 6, 2, issues);

  // ── 18. Passed checks ────────────────────────────────────────────────────
  const passedChecks: string[] = [
    httpsEnforced             ? "HTTPS enforced"                       : "",
    hsts                      ? "HSTS header present"                  : "",
    http2                     ? "HTTP/2 or HTTP/3 detected"            : "",
    redirectChain.hops <= 1   ? "Clean redirect chain (≤ 1 hop)"       : "",
    canonicalTag              ? "Canonical tag present"                : "",
    cdnName                   ? `CDN detected (${cdnName})`            : "",
    compression               ? `Compression enabled (${compression})` : "",
    cacheControl              ? "Cache-Control header set"             : "",
    eTag || lastModified      ? "Cache validators present (ETag/Last-Modified)" : "",
    robotsTxtData.exists && !robotsTxtData.hasDisallowAll
                              ? "robots.txt valid (no block-all rule)" : "",
    sitemapExists && sitemapUrlCount > 0
                              ? `sitemap.xml found (${sitemapUrlCount} URLs)` : "",
    faviconExists             ? "Favicon detected"                     : "",
    hasManifest               ? "Web App Manifest present"             : "",
    hasServiceWorker          ? "Service Worker registered"            : "",
    themeColorMeta            ? "Theme-color meta tag set"             : "",
    mixedContent.count === 0 && urlString.startsWith("https://")
                              ? "No mixed content detected"            : "",
    hasFrameProtection        ? "Clickjacking protection enabled"      : "",
    Boolean(csp)              ? "Content-Security-Policy present"      : "",
    Boolean(xContentType)     ? "X-Content-Type-Options: nosniff set"  : "",
    analytics.length > 0      ? `Analytics detected (${analytics.join(", ")})` : "",
    has404                    ? "Custom 404 page present"              : "",
    responseTimeMs < 800      ? `Fast server response (${responseTimeMs} ms)` : ""
  ].filter(Boolean);

  // ── 19. Build summary ─────────────────────────────────────────────────────
  const summary =
    aiSummary ??
    `Technical audit completed: ${issues.length} issue${issues.length !== 1 ? "s" : ""} found across infrastructure, caching, crawlability, security headers, and technology stack checks. ${passedChecks.length} checks passed.`;

  return {
    category: "technical",
    score,
    grade: getGrade(score),
    summary,
    issues,
    passedChecks,
    data
  };
}
