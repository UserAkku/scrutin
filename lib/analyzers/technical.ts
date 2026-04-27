import { scoreListCompletion } from "@/lib/analyzers/shared";
import { scoreFromIssueDensity } from "@/lib/scoring";
import { getGrade, normalizeUrl } from "@/lib/utils";
import type { CategoryResult } from "@/types/audit";

async function safeFetch(url: string, init?: RequestInit) {
  try {
    return await fetch(url, { cache: "no-store", ...init });
  } catch {
    return null;
  }
}

export async function analyzeTechnical(targetUrl: string): Promise<CategoryResult> {
  const url = normalizeUrl(targetUrl);
  const rootResponse = await safeFetch(url.toString());
  const robotsResponse = await safeFetch(new URL("/robots.txt", url).toString());
  const sitemapResponse = await safeFetch(new URL("/sitemap.xml", url).toString());
  const faviconResponse = await safeFetch(new URL("/favicon.ico", url).toString());
  const httpVersionResponse = rootResponse?.headers.get("server") ?? "unknown";
  const startedAt = Date.now();
  await safeFetch(url.toString(), { method: "HEAD" });
  const responseTime = Date.now() - startedAt;

  const issues = [
    !robotsResponse?.ok
      ? {
          category: "technical" as const,
          severity: "medium" as const,
          title: "robots.txt is missing",
          description: "Search engines do not have a crawl instruction file available.",
          fixSuggestion: "Create a robots.txt file at the site root with explicit allow/disallow rules and your sitemap location.",
          impact: "Crawler behavior becomes less predictable.",
          effort: "15 minutes"
        }
      : null,
    !sitemapResponse?.ok
      ? {
          category: "technical" as const,
          severity: "medium" as const,
          title: "sitemap.xml is missing",
          description: "The site is not exposing a machine-readable XML sitemap.",
          fixSuggestion: "Generate a sitemap.xml that lists canonical URLs and submit it in Google Search Console.",
          impact: "Important pages may be discovered more slowly.",
          effort: "30 minutes"
        }
      : null,
    !faviconResponse?.ok
      ? {
          category: "technical" as const,
          severity: "low" as const,
          title: "Favicon not detected",
          description: "A default favicon.ico file could not be fetched from the site root.",
          fixSuggestion: "Add a favicon and reference it from the document head for better browser and SERP presentation.",
          impact: "Brand recognition and polish are reduced.",
          effort: "10 minutes"
        }
      : null,
    !String(url).startsWith("https://")
      ? {
          category: "technical" as const,
          severity: "critical" as const,
          title: "Site is not using HTTPS",
          description: "The submitted URL is not secured with HTTPS.",
          fixSuggestion: "Install an SSL certificate, force HTTPS redirects, and update internal links and canonicals.",
          impact: "Security, trust, and SEO are all negatively affected.",
          effort: "1 hour"
        }
      : null
  ].filter((issue): issue is NonNullable<typeof issue> => Boolean(issue));

  const checkScore = scoreListCompletion([
    robotsResponse?.ok ?? false,
    sitemapResponse?.ok ?? false,
    faviconResponse?.ok ?? false,
    Boolean(rootResponse?.headers.get("content-type")),
    Boolean(rootResponse?.headers.get("content-encoding")),
    Boolean(rootResponse?.headers.get("content-length")),
    Boolean(rootResponse?.headers.get("server"))
  ]);
  const penaltyScore = scoreFromIssueDensity(issues.length, 18, 8, 3, issues);
  const score = Math.round((checkScore + penaltyScore) / 2);

  return {
    category: "technical",
    score,
    grade: getGrade(score),
    summary: "Technical crawlability, response behavior, and site infrastructure were checked directly against public endpoints.",
    issues,
    passedChecks: [
      robotsResponse?.ok ? "robots.txt available" : "",
      sitemapResponse?.ok ? "sitemap.xml available" : "",
      faviconResponse?.ok ? "favicon.ico available" : "",
      rootResponse?.headers.get("content-encoding") ? "Compression enabled" : ""
    ].filter(Boolean),
    data: {
      robotsTxtExists: robotsResponse?.ok ?? false,
      sitemapExists: sitemapResponse?.ok ?? false,
      faviconExists: faviconResponse?.ok ?? false,
      responseTimeMs: responseTime,
      pageSize: Number(rootResponse?.headers.get("content-length") ?? 0),
      compression: rootResponse?.headers.get("content-encoding"),
      server: httpVersionResponse
    }
  };
}
