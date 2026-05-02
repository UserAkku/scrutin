import { generateJson, defaultIssueSchema } from "@/lib/gemini";
import { scoreFromIssueDensity } from "@/lib/scoring";
import { getGrade } from "@/lib/utils";
import type { AuditIssue, CategoryResult } from "@/types/audit";
import {
  extractTopKeywords,
  fetchHtmlSnapshot,
  textContent
} from "@/lib/analyzers/shared";

export async function analyzeSeo(targetUrl: string): Promise<CategoryResult> {
  const snapshot = await fetchHtmlSnapshot(targetUrl);
  const { root, html } = snapshot;
  const title = root.querySelector("title")?.text.trim() ?? "";
  const metaDescription =
    root.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";
  const headings = root.querySelectorAll("h1, h2, h3, h4, h5, h6");
  const h1Tags = root.querySelectorAll("h1");
  const images = root.querySelectorAll("img");
  const imagesWithoutAlt = images
    .filter((image) => !image.getAttribute("alt"))
    .map((image) => image.getAttribute("src") ?? "unknown");
  const canonical = root.querySelector('link[rel="canonical"]')?.getAttribute("href");
  const internalLinks = root
    .querySelectorAll("a[href]")
    .filter((link) => (link.getAttribute("href") ?? "").startsWith("/")).length;
  const externalLinks = root
    .querySelectorAll("a[href]")
    .filter((link) => /^https?:\/\//.test(link.getAttribute("href") ?? "")).length;
  const hasTwitterCard = Boolean(root.querySelector('meta[name="twitter:card"]'));
  const openGraphFields = ["og:title", "og:description", "og:image"].map((property) =>
    Boolean(root.querySelector(`meta[property="${property}"]`))
  );
  const schemaBlocks = root.querySelectorAll('script[type="application/ld+json"]');
  const bodyText = textContent(html);
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
  const keywords = extractTopKeywords(bodyText);
  const noIndex = Boolean(root.querySelector('meta[name="robots"][content*="noindex"]'));
  const hreflangCount = root.querySelectorAll('link[hreflang]').length;

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
      `You are a technical SEO consultant. Audit this website and return JSON with "summary" and "issues".
URL: ${snapshot.url}
Title: ${title}
Meta description: ${metaDescription}
H1 count: ${h1Tags.length}
Heading outline: ${headings.map((heading) => heading.tagName).join(", ")}
Images without alt: ${JSON.stringify(imagesWithoutAlt)}
Canonical: ${canonical ?? "missing"}
Open graph complete: ${openGraphFields.every(Boolean)}
Twitter card: ${hasTwitterCard}
Schema count: ${schemaBlocks.length}
Internal links: ${internalLinks}
External links: ${externalLinks}
Word count: ${wordCount}
Keywords: ${JSON.stringify(keywords)}
Hreflang tags: ${hreflangCount}
Noindex detected: ${noIndex}
HTML excerpt: ${html.slice(0, 12000)}`,
      [],
      defaultIssueSchema
    );
  } catch {
    aiResponse = null;
  }

  const fallbackIssues: Omit<AuditIssue, "category">[] = [];
  if (!title) {
    fallbackIssues.push({
      title: "Missing title tag",
      description: "The page does not expose a searchable title in the document head.",
      fixSuggestion: "Add a unique, keyword-relevant title tag around 50-60 characters.",
      severity: "critical",
      impact: "Search visibility and CTR can drop significantly.",
      effort: "10 minutes"
    });
  }
  if (!metaDescription) {
    fallbackIssues.push({
      title: "Missing meta description",
      description: "Search engines do not have a custom summary to show for this page.",
      fixSuggestion: "Add a compelling meta description around 150-160 characters.",
      severity: "medium",
      impact: "Lower click-through rate from search results.",
      effort: "10 minutes"
    });
  }
  if (imagesWithoutAlt.length > 0) {
    fallbackIssues.push({
      title: "Images missing alt text",
      description: `${imagesWithoutAlt.length} image(s) are missing alternative text.`,
      fixSuggestion: "Add concise descriptive alt text to meaningful images and empty alt for decorative ones.",
      severity: "medium",
      impact: "Image SEO and accessibility both suffer.",
      effort: "20 minutes"
    });
  }

  const issues = (aiResponse?.issues ?? fallbackIssues).map((issue) => ({
    ...issue,
    category: "seo" as const
  }));
  const score = scoreFromIssueDensity(issues.length, 12, 6, 3, issues);

  return {
    category: "seo",
    score,
    grade: getGrade(score),
    summary:
      aiResponse?.summary ??
      "SEO audit completed from structural page signals and on-page metadata checks.",
    issues,
    passedChecks: [
      canonical ? "Canonical tag detected" : "",
      h1Tags.length === 1 ? "Single H1 tag present" : "",
      hasTwitterCard ? "Twitter card metadata present" : "",
      openGraphFields.every(Boolean) ? "Open Graph metadata complete" : "",
      schemaBlocks.length > 0 ? "Structured data detected" : ""
    ].filter(Boolean),
    data: {
      title,
      metaDescription,
      h1Count: h1Tags.length,
      headingOutline: headings.map((heading) => heading.tagName),
      imagesWithoutAlt,
      canonical,
      hasTwitterCard,
      openGraphComplete: openGraphFields.every(Boolean),
      schemaTypes: schemaBlocks.map((block) => block.textContent.slice(0, 60)),
      internalLinks,
      externalLinks,
      wordCount,
      keywords,
      hreflangCount,
      noIndex
    }
  };
}
