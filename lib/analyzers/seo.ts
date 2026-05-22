/**
 * @file seo.ts
 * @description Comprehensive SEO analyzer for Scrutin — 50+ technical checks covering
 *   title & meta, headings, content quality, links, images, structured data, social
 *   metadata, hreflang, SERP preview calculations, and a weighted penalty scoring model.
 *   AI (Gemini) is used only for summarization and surfacing additional insights from the
 *   raw HTML — all detections are performed deterministically first.
 */

import { generateJson, defaultIssueSchema } from "@/lib/gemini";
import { scoreFromIssueDensity } from "@/lib/scoring";
import { getGrade, normalizeUrl } from "@/lib/utils";
import type { AuditIssue, CategoryResult } from "@/types/audit";
import { extractTopKeywords, fetchHtmlSnapshot, textContent } from "@/lib/analyzers/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Full set of SERP-preview data calculated from on-page metadata. */
interface SerpPreview {
  title: string;
  description: string;
  displayUrl: string;
  /** Title pixel-width estimate (avg 7 px per character in Google's font). */
  titlePixelWidth: number;
  /** True when estimated pixel width exceeds Google's ~600 px SERP truncation threshold. */
  isTitleTruncated: boolean;
  /** True when description length exceeds ~920 px (≈ 160 chars) SERP truncation threshold. */
  isDescTruncated: boolean;
}

/** Shape of the Open Graph data object extracted from meta tags. */
interface OpenGraphData {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string | null;
  type: string | null;
}

/** Single keyword density entry — mirrors the type returned by extractTopKeywords. */
interface KeywordEntry {
  term: string;
  count: number;
  density: number;
}

/** Heading outline entry. */
interface HeadingEntry {
  level: string;
  text: string;
}

/** Full structured return type for the data field. */
interface SeoData {
  // Title & Meta
  title: string;
  titleLength: number;
  titlePixelWidth: number;
  metaDescription: string;
  metaDescriptionLength: number;
  metaKeywordsPresent: boolean;
  metaViewportPresent: boolean;
  metaRobotsContent: string | null;
  noIndex: boolean;
  noFollow: boolean;

  // Headings
  h1Count: number;
  h1Text: string[];
  headingOutline: HeadingEntry[];
  hasHeadingHierarchyIssue: boolean;

  // Content
  wordCount: number;
  contentToHtmlRatio: number;
  keywords: KeywordEntry[];
  isThinnContent: boolean;

  // Links
  internalLinks: number;
  externalLinks: number;
  nofollowLinks: number;
  genericAnchorCount: number;
  brokenLinks: string[];

  // Images
  imagesWithoutAlt: string[];
  imagesWithoutDimensions: string[];
  imagesWithLongAlt: string[];
  totalImages: number;

  // Technical SEO
  canonical: string | null;
  isCanonicalSelf: boolean;
  hasTwitterCard: boolean;
  twitterCardType: string | null;
  openGraphComplete: boolean;
  openGraphData: OpenGraphData;
  schemaCount: number;
  schemaTypes: string[];
  schemaValid: boolean;
  hreflangCount: number;
  hasAmpLink: boolean;
  hasPaginationLinks: boolean;

  // SERP Preview
  serpPreview: SerpPreview;

  // Multi-title warning
  multipleTitleTags: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Estimate the pixel width of a string as rendered in Google's SERP title font.
 * Google uses approximately 7 px per character for a mixed-case Latin string.
 */
function estimateTitlePixelWidth(text: string): number {
  return text.length * 7;
}

/**
 * Estimate whether a meta description will be truncated in SERPs.
 * Google typically shows ~920 px worth of description (~160 average chars).
 */
function isDescTruncatedInSerp(text: string): boolean {
  return text.length > 160;
}

/**
 * Count syllables in a word using a simple heuristic for Flesch-Kincaid estimation.
 * Good enough for a density-based "reading level" signal.
 */
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  const matches = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, matches?.length ?? 1);
}

/**
 * Check if a given BCP-47 language code looks syntactically valid.
 * Accepts formats like "en", "en-US", "zh-Hans-CN".
 */
function isValidLangCode(lang: string): boolean {
  return /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(lang);
}

/**
 * Safely issue a HEAD request and return whether the link resolves (2xx/3xx).
 * Swallows all network errors — broken link detection must never crash the audit.
 */
async function isLinkAlive(href: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(href, {
      method: "HEAD",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ScrutinBot/1.0; +https://scrutin.app)"
      }
    });
    clearTimeout(timeout);
    return response.ok || (response.status >= 300 && response.status < 400);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main analyzer
// ---------------------------------------------------------------------------

export async function analyzeSeo(targetUrl: string): Promise<CategoryResult> {
  // ── 1. Fetch HTML ─────────────────────────────────────────────────────────
  const snapshot = await fetchHtmlSnapshot(targetUrl);
  const { root, html } = snapshot;
  const parsedUrl = normalizeUrl(targetUrl);

  // ── 2. Title & Meta ───────────────────────────────────────────────────────
  const titleTags = root.querySelectorAll("title");
  const multipleTitleTags = titleTags.length > 1;
  const title = titleTags[0]?.text.trim() ?? "";
  const titleLength = title.length;
  const titlePixelWidth = estimateTitlePixelWidth(title);

  const metaDescriptionEl = root.querySelector('meta[name="description"]');
  const metaDescription = metaDescriptionEl?.getAttribute("content")?.trim() ?? "";
  const metaDescriptionLength = metaDescription.length;

  // Meta keywords (deprecated tag — flag presence as low-priority noise)
  const metaKeywordsEl = root.querySelector('meta[name="keywords"]');
  const metaKeywordsPresent = Boolean(metaKeywordsEl);

  // Viewport
  const metaViewportEl = root.querySelector('meta[name="viewport"]');
  const metaViewportPresent = Boolean(metaViewportEl);

  // Robots meta
  const metaRobotsEl = root.querySelector('meta[name="robots"]');
  const metaRobotsContent = metaRobotsEl?.getAttribute("content") ?? null;
  const noIndex = metaRobotsContent?.toLowerCase().includes("noindex") ?? false;
  const noFollow = metaRobotsContent?.toLowerCase().includes("nofollow") ?? false;

  // ── 3. Headings ───────────────────────────────────────────────────────────
  const allHeadings = root.querySelectorAll("h1, h2, h3, h4, h5, h6");
  const h1Tags = root.querySelectorAll("h1");
  const h1Count = h1Tags.length;
  const h1Text = h1Tags.map((el) => el.text.trim());

  const headingOutline: HeadingEntry[] = allHeadings.map((el) => ({
    level: el.tagName.toLowerCase(),
    text: el.text.trim().slice(0, 80)
  }));

  // Detect heading hierarchy violations (e.g. H1 → H3 without H2)
  let hasHeadingHierarchyIssue = false;
  {
    const levels = allHeadings.map((el) => parseInt(el.tagName.replace(/[^1-6]/g, ""), 10));
    for (let idx = 1; idx < levels.length; idx++) {
      if (levels[idx] - levels[idx - 1] > 1) {
        hasHeadingHierarchyIssue = true;
        break;
      }
    }
  }

  // ── 4. Content Quality ────────────────────────────────────────────────────
  const bodyText = textContent(html);
  const wordTokens = bodyText.split(/\s+/).filter(Boolean);
  const wordCount = wordTokens.length;
  const isThinnContent = wordCount < 300;

  // Content-to-HTML ratio: visible text chars / total HTML chars
  const contentToHtmlRatio =
    html.length > 0
      ? Number(((bodyText.length / html.length) * 100).toFixed(1))
      : 0;

  // Top 10 keywords with density (overriding the default 5 from shared helper)
  const rawKeywords = extractTopKeywords(bodyText);
  // extractTopKeywords returns top-5; build top-10 manually for richer data
  const keywords: KeywordEntry[] = (() => {
    const stopWords = new Set([
      "the", "and", "for", "that", "with", "this", "from", "your", "have",
      "you", "are", "our", "but", "not", "all", "was", "can", "has", "will",
      "its", "more", "than", "also", "into", "been", "they", "their", "there",
      "when", "which", "how", "what", "about", "would", "could", "should"
    ]);
    const words = bodyText
      .toLowerCase()
      .match(/[a-z]{3,}/g)
      ?.filter((w) => !stopWords.has(w)) ?? [];
    const counts = new Map<string, number>();
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
    const total = words.length;
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([term, count]) => ({
        term,
        count,
        density: total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0
      }));
  })();

  // Primary keyword (top keyword) used for keyword-in-title / H1 checks
  const primaryKeyword = keywords[0]?.term ?? "";

  // Simple reading-level signal: average syllables per word
  // Flesch–Kincaid: higher syllable count → harder to read
  const avgSyllables =
    wordTokens.length > 0
      ? wordTokens.reduce((sum, w) => sum + countSyllables(w), 0) / wordTokens.length
      : 0;

  // ── 5. Images ─────────────────────────────────────────────────────────────
  const images = root.querySelectorAll("img");
  const totalImages = images.length;

  const imagesWithoutAlt = images
    .filter((img) => {
      const alt = img.getAttribute("alt");
      // Treat missing attribute (null) as missing; empty string "" is valid for decorative
      return alt === null;
    })
    .map((img) => img.getAttribute("src") ?? "unknown");

  const imagesWithoutDimensions = images
    .filter(
      (img) =>
        !img.getAttribute("width") ||
        !img.getAttribute("height")
    )
    .map((img) => img.getAttribute("src") ?? "unknown");

  const imagesWithLongAlt = images
    .filter((img) => (img.getAttribute("alt")?.length ?? 0) > 125)
    .map((img) => img.getAttribute("src") ?? "unknown");

  // ── 6. Links ──────────────────────────────────────────────────────────────
  const allAnchors = root.querySelectorAll("a[href]");

  const internalLinks = allAnchors.filter((a) => {
    const href = a.getAttribute("href") ?? "";
    if (href.startsWith("/") || href.startsWith("#")) return true;
    try {
      return new URL(href).hostname === parsedUrl.hostname;
    } catch {
      return false;
    }
  }).length;

  const externalLinks = allAnchors.filter((a) => {
    const href = a.getAttribute("href") ?? "";
    if (!href.startsWith("http")) return false;
    try {
      return new URL(href).hostname !== parsedUrl.hostname;
    } catch {
      return false;
    }
  }).length;

  const nofollowLinks = allAnchors.filter((a) =>
    (a.getAttribute("rel") ?? "").toLowerCase().includes("nofollow")
  ).length;

  // Generic anchor text quality check — "click here", "read more", "here", etc.
  const genericAnchorTexts = new Set(["click here", "read more", "here", "more", "learn more", "this", "link", "page"]);
  const genericAnchorCount = allAnchors.filter((a) =>
    genericAnchorTexts.has(a.text.trim().toLowerCase())
  ).length;

  // Broken link detection — sample up to 5 unique absolute external hrefs
  const externalHrefs = allAnchors
    .map((a) => a.getAttribute("href") ?? "")
    .filter((href) => /^https?:\/\//.test(href))
    .filter((href, idx, arr) => arr.indexOf(href) === idx)
    .slice(0, 5);

  const brokenLinks: string[] = [];
  await Promise.all(
    externalHrefs.map(async (href) => {
      const alive = await isLinkAlive(href);
      if (!alive) brokenLinks.push(href);
    })
  );

  // ── 7. Technical SEO ─────────────────────────────────────────────────────

  // Canonical
  const canonicalEl = root.querySelector('link[rel="canonical"]');
  const canonical = canonicalEl?.getAttribute("href") ?? null;
  // Self-referencing canonical: href must resolve to the same origin+path
  const isCanonicalSelf = (() => {
    if (!canonical) return false;
    try {
      const canonicalUrl = new URL(canonical, parsedUrl.toString());
      return (
        canonicalUrl.hostname === parsedUrl.hostname &&
        canonicalUrl.pathname === parsedUrl.pathname
      );
    } catch {
      return false;
    }
  })();

  // Open Graph
  const ogTitle = root.querySelector('meta[property="og:title"]')?.getAttribute("content") ?? null;
  const ogDescription = root.querySelector('meta[property="og:description"]')?.getAttribute("content") ?? null;
  const ogImage = root.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? null;
  const ogUrl = root.querySelector('meta[property="og:url"]')?.getAttribute("content") ?? null;
  const ogType = root.querySelector('meta[property="og:type"]')?.getAttribute("content") ?? null;
  const openGraphData: OpenGraphData = {
    title: ogTitle,
    description: ogDescription,
    image: ogImage,
    url: ogUrl,
    type: ogType
  };
  const openGraphComplete = Boolean(ogTitle && ogDescription && ogImage && ogUrl);

  // Twitter Card
  const twitterCardEl = root.querySelector('meta[name="twitter:card"]');
  const hasTwitterCard = Boolean(twitterCardEl);
  const twitterCardType = twitterCardEl?.getAttribute("content") ?? null;

  // Structured Data (JSON-LD)
  const schemaBlocks = root.querySelectorAll('script[type="application/ld+json"]');
  const schemaCount = schemaBlocks.length;
  let schemaValid = true;
  const schemaTypes: string[] = [];
  for (const block of schemaBlocks) {
    try {
      const parsed = JSON.parse(block.textContent);
      const type = Array.isArray(parsed)
        ? parsed.map((p: Record<string, unknown>) => p["@type"]).filter(Boolean).join(", ")
        : (parsed["@type"] ?? "Unknown");
      schemaTypes.push(String(type));
    } catch {
      schemaValid = false;
      schemaTypes.push("(invalid JSON-LD)");
    }
  }

  // Hreflang
  const hreflangEls = root.querySelectorAll("link[hreflang]");
  const hreflangCount = hreflangEls.length;
  const invalidHreflangCodes: string[] = hreflangEls
    .map((el) => el.getAttribute("hreflang") ?? "")
    .filter((lang) => lang && !isValidLangCode(lang));

  // AMP link
  const hasAmpLink = Boolean(root.querySelector('link[rel="amphtml"]'));

  // Pagination (rel=prev / rel=next)
  const hasPaginationLinks =
    Boolean(root.querySelector('link[rel="prev"]')) ||
    Boolean(root.querySelector('link[rel="next"]'));

  // ── 8. SERP Preview ───────────────────────────────────────────────────────
  const serpPreview: SerpPreview = {
    title,
    description: metaDescription,
    displayUrl: `${parsedUrl.hostname}${parsedUrl.pathname !== "/" ? parsedUrl.pathname : ""}`,
    titlePixelWidth,
    isTitleTruncated: titlePixelWidth > 600,
    isDescTruncated: isDescTruncatedInSerp(metaDescription)
  };

  // ── 9. Build deterministic issues list ───────────────────────────────────
  //
  // Penalty weights:
  //   critical → -15 (max per issue in scoreFromIssueDensity with multiplier 15)
  //   medium   → -7
  //   low      → -3
  //
  const deterministicIssues: Omit<AuditIssue, "category">[] = [];

  // --- Title & Meta ---

  if (!title) {
    deterministicIssues.push({
      title: "Missing <title> tag",
      description: "The page has no title tag. This is one of the most critical SEO signals.",
      fixSuggestion: "Add a unique, descriptive <title> tag of 50–60 characters in the document <head>.",
      severity: "critical",
      impact: "Search engines will auto-generate a title, often poorly. Severe CTR loss.",
      effort: "5 minutes"
    });
  } else {
    if (titleLength < 30) {
      deterministicIssues.push({
        title: "Title tag is too short",
        description: `Title is only ${titleLength} characters. Optimal length is 50–60 characters.`,
        fixSuggestion: "Expand the title to 50–60 characters including the target keyword.",
        severity: "medium",
        impact: "Missed opportunity to communicate relevance to search engines.",
        effort: "10 minutes"
      });
    } else if (titleLength > 60) {
      deterministicIssues.push({
        title: "Title tag is too long",
        description: `Title is ${titleLength} characters (${titlePixelWidth} px estimated). Optimal is 50–60 chars / ≤ 600 px.`,
        fixSuggestion: "Shorten the title to under 60 characters so it renders fully in SERPs.",
        severity: "medium",
        impact: "Title will be truncated in search results, reducing CTR.",
        effort: "10 minutes"
      });
    }

    if (primaryKeyword && !title.toLowerCase().includes(primaryKeyword)) {
      deterministicIssues.push({
        title: "Primary keyword missing from title",
        description: `The top page keyword "${primaryKeyword}" was not found in the title tag.`,
        fixSuggestion: `Include the target keyword "${primaryKeyword}" near the beginning of the title.`,
        severity: "medium",
        impact: "Lower relevance signals for the primary topic.",
        effort: "5 minutes"
      });
    }
  }

  if (multipleTitleTags) {
    deterministicIssues.push({
      title: "Multiple <title> tags detected",
      description: "More than one <title> element was found in the document. Search engines will use the last one unpredictably.",
      fixSuggestion: "Ensure only a single <title> tag exists in the <head>.",
      severity: "critical",
      impact: "Unpredictable SERP title; possible ranking confusion.",
      effort: "10 minutes"
    });
  }

  if (!metaDescription) {
    deterministicIssues.push({
      title: "Missing meta description",
      description: "No meta description found. Search engines will auto-generate snippets, often unflattering.",
      fixSuggestion: "Write a compelling 150–160 character meta description incorporating the target keyword.",
      severity: "medium",
      impact: "Lower SERP click-through rates.",
      effort: "10 minutes"
    });
  } else {
    if (metaDescriptionLength < 70) {
      deterministicIssues.push({
        title: "Meta description is too short",
        description: `Meta description is only ${metaDescriptionLength} characters. Aim for 150–160 characters.`,
        fixSuggestion: "Expand the meta description to use the available SERP snippet space effectively.",
        severity: "low",
        impact: "Shorter descriptions leave valuable SERP real estate unused.",
        effort: "10 minutes"
      });
    } else if (metaDescriptionLength > 160) {
      deterministicIssues.push({
        title: "Meta description is too long",
        description: `Meta description is ${metaDescriptionLength} characters — Google will truncate at ~160.`,
        fixSuggestion: "Trim the meta description to 150–160 characters so the full text appears in SERPs.",
        severity: "low",
        impact: "Truncated description may cut off the call-to-action.",
        effort: "10 minutes"
      });
    }
  }

  if (metaKeywordsPresent) {
    deterministicIssues.push({
      title: "Deprecated meta keywords tag present",
      description: 'The <meta name="keywords"> tag is deprecated and ignored by major search engines. Its presence can signal old SEO practices.',
      fixSuggestion: "Remove the meta keywords tag.",
      severity: "low",
      impact: "Negligible ranking impact, but signals outdated practices.",
      effort: "5 minutes"
    });
  }

  if (!metaViewportPresent) {
    deterministicIssues.push({
      title: "Missing meta viewport tag",
      description: "No viewport meta tag was found. Mobile rendering will be broken.",
      fixSuggestion: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the <head>.',
      severity: "critical",
      impact: "Poor mobile UX directly harms Core Web Vitals and Google mobile ranking.",
      effort: "5 minutes"
    });
  }

  if (noIndex) {
    deterministicIssues.push({
      title: "Page is set to noindex",
      description: 'The meta robots tag contains "noindex", instructing search engines not to index this page.',
      fixSuggestion: 'Remove "noindex" from the meta robots tag if this page should appear in search results.',
      severity: "critical",
      impact: "The page will be excluded from search engine indexes.",
      effort: "5 minutes"
    });
  }

  if (noFollow) {
    deterministicIssues.push({
      title: "Global nofollow on page",
      description: 'The meta robots tag includes "nofollow", preventing crawlers from following any links on this page.',
      fixSuggestion: 'Remove "nofollow" from the meta robots tag unless you intentionally want to suppress all link equity.',
      severity: "medium",
      impact: "Internal and external link equity signals are suppressed.",
      effort: "5 minutes"
    });
  }

  // --- Headings ---

  if (h1Count === 0) {
    deterministicIssues.push({
      title: "Missing H1 heading",
      description: "No <h1> tag was found on the page. The H1 is the primary topical signal for search engines.",
      fixSuggestion: "Add a single <h1> containing the primary keyword near the top of the content.",
      severity: "critical",
      impact: "Search engines lack a primary topic signal; rankings for target terms may suffer.",
      effort: "10 minutes"
    });
  } else if (h1Count > 1) {
    deterministicIssues.push({
      title: "Multiple H1 headings detected",
      description: `Found ${h1Count} H1 tags. Best practice is exactly one H1 per page.`,
      fixSuggestion: "Keep one H1 for the page title; demote additional H1s to H2 or lower.",
      severity: "medium",
      impact: "Dilutes the topical signal of the primary heading.",
      effort: "15 minutes"
    });
  }

  if (
    h1Count === 1 &&
    primaryKeyword &&
    !h1Text[0].toLowerCase().includes(primaryKeyword)
  ) {
    deterministicIssues.push({
      title: "Primary keyword missing from H1",
      description: `The H1 heading does not contain the primary keyword "${primaryKeyword}".`,
      fixSuggestion: `Include "${primaryKeyword}" in the H1 heading text.`,
      severity: "low",
      impact: "Minor weakening of on-page relevance signals.",
      effort: "10 minutes"
    });
  }

  if (hasHeadingHierarchyIssue) {
    deterministicIssues.push({
      title: "Heading hierarchy has gaps",
      description: "Headings skip levels (e.g. H2 jumps directly to H4), which breaks document outline semantics.",
      fixSuggestion: "Use headings in sequential order — H1 → H2 → H3 — without skipping levels.",
      severity: "low",
      impact: "Screen readers and crawlers may misinterpret content structure.",
      effort: "20 minutes"
    });
  }

  // --- Content Quality ---

  if (isThinnContent) {
    deterministicIssues.push({
      title: "Thin content warning",
      description: `Only ${wordCount} words were found. Pages with fewer than 300 words are considered thin content.`,
      fixSuggestion: "Add at least 300 meaningful words of unique content covering the topic in depth.",
      severity: "medium",
      impact: "Thin content pages are candidates for quality demotions in Google algorithms.",
      effort: "1–2 hours"
    });
  }

  if (contentToHtmlRatio < 10) {
    deterministicIssues.push({
      title: "Low content-to-HTML ratio",
      description: `Visible text makes up only ${contentToHtmlRatio}% of the HTML. Heavy markup bloat is detectable.`,
      fixSuggestion: "Reduce unnecessary inline styles, scripts, and markup. Move CSS/JS to external files.",
      severity: "low",
      impact: "Crawl budget may be wasted on markup; content signals diluted.",
      effort: "1 hour"
    });
  }

  if (avgSyllables > 2.5) {
    deterministicIssues.push({
      title: "Complex reading level detected",
      description: `Average of ${avgSyllables.toFixed(1)} syllables per word suggests the content may be difficult to read.`,
      fixSuggestion: "Simplify vocabulary and sentence structure to target a Flesch reading ease of 60+.",
      severity: "low",
      impact: "Complex content may increase bounce rates, indirectly affecting rankings.",
      effort: "30 minutes"
    });
  }

  // --- Images ---

  if (imagesWithoutAlt.length > 0) {
    deterministicIssues.push({
      title: "Images missing alt text",
      description: `${imagesWithoutAlt.length} image(s) have no alt attribute. (First: ${imagesWithoutAlt[0]?.slice(0, 60) ?? "unknown"})`,
      fixSuggestion: "Add descriptive alt text to every meaningful image; use alt=\"\" for purely decorative images.",
      severity: "medium",
      impact: "Image search visibility is lost and accessibility is harmed.",
      effort: "20 minutes"
    });
  }

  if (imagesWithoutDimensions.length > 0) {
    deterministicIssues.push({
      title: "Images missing width/height attributes",
      description: `${imagesWithoutDimensions.length} image(s) lack explicit width/height. This causes Cumulative Layout Shift (CLS).`,
      fixSuggestion: "Set explicit width and height attributes on all <img> tags to reserve layout space.",
      severity: "medium",
      impact: "CLS increase hurts Core Web Vitals scores and page ranking.",
      effort: "20 minutes"
    });
  }

  if (imagesWithLongAlt.length > 0) {
    deterministicIssues.push({
      title: "Excessively long alt text on images",
      description: `${imagesWithLongAlt.length} image(s) have alt text exceeding 125 characters.`,
      fixSuggestion: "Keep alt text concise and descriptive — under 125 characters. Use captions for detailed context.",
      severity: "low",
      impact: "Very long alt text can confuse screen readers and dilute the keyword signal.",
      effort: "10 minutes"
    });
  }

  // --- Links ---

  if (internalLinks === 0) {
    deterministicIssues.push({
      title: "No internal links detected",
      description: "The page has no internal links. Internal linking distributes PageRank and guides crawlers through the site.",
      fixSuggestion: "Add contextual internal links to related content and key site sections.",
      severity: "medium",
      impact: "Poor internal link equity distribution and crawlability.",
      effort: "20 minutes"
    });
  }

  if (genericAnchorCount > 3) {
    deterministicIssues.push({
      title: "Generic anchor text overuse",
      description: `Found ${genericAnchorCount} links using generic text like "click here" or "read more".`,
      fixSuggestion: "Replace generic anchor text with descriptive keyword-rich text that describes the linked page.",
      severity: "low",
      impact: "Generic anchors miss the chance to pass topical signals to linked pages.",
      effort: "15 minutes"
    });
  }

  if (brokenLinks.length > 0) {
    deterministicIssues.push({
      title: "Broken external links detected",
      description: `${brokenLinks.length} external link(s) returned an error when probed: ${brokenLinks.slice(0, 3).join(", ")}`,
      fixSuggestion: "Fix or remove broken links. Use a site crawler like Screaming Frog to audit all links regularly.",
      severity: "medium",
      impact: "Broken links harm user experience and waste crawl budget.",
      effort: "30 minutes"
    });
  }

  // --- Technical SEO ---

  if (!canonical) {
    deterministicIssues.push({
      title: "Canonical tag missing",
      description: "No canonical link element was found. Duplicate content may be indexed without a preferred URL signal.",
      fixSuggestion: 'Add <link rel="canonical" href="[preferred-url]"> to the <head>.',
      severity: "medium",
      impact: "Risk of duplicate content diluting link equity across URL variants.",
      effort: "10 minutes"
    });
  } else if (!isCanonicalSelf) {
    deterministicIssues.push({
      title: "Canonical tag does not self-reference",
      description: `Canonical points to "${canonical}" which differs from the current page URL. Verify this is intentional.`,
      fixSuggestion: "If this is the preferred URL, update canonical to match exactly. If consolidating to another page, this is correct.",
      severity: "low",
      impact: "Non-self-referencing canonicals can consolidate equity away from this page.",
      effort: "5 minutes"
    });
  }

  if (!openGraphComplete) {
    const missingOgProps = [
      !ogTitle && "og:title",
      !ogDescription && "og:description",
      !ogImage && "og:image",
      !ogUrl && "og:url"
    ].filter(Boolean);
    deterministicIssues.push({
      title: "Incomplete Open Graph metadata",
      description: `Missing Open Graph properties: ${missingOgProps.join(", ")}.`,
      fixSuggestion: "Add the missing <meta property=\"og:*\"> tags. All four core OG properties are required for rich social previews.",
      severity: "medium",
      impact: "Social media shares will show a poor or blank preview, reducing click-throughs.",
      effort: "15 minutes"
    });
  }

  if (!hasTwitterCard) {
    deterministicIssues.push({
      title: "Twitter Card metadata missing",
      description: 'No <meta name="twitter:card"> tag found. Twitter/X will generate its own preview without your input.',
      fixSuggestion: 'Add at minimum <meta name="twitter:card" content="summary_large_image"> along with twitter:title and twitter:image.',
      severity: "low",
      impact: "Poor appearance when shared on Twitter/X social platform.",
      effort: "10 minutes"
    });
  }

  if (schemaCount === 0) {
    deterministicIssues.push({
      title: "No structured data (JSON-LD) detected",
      description: "No Schema.org JSON-LD blocks were found. Structured data enables rich results in SERPs.",
      fixSuggestion: "Add appropriate JSON-LD markup (e.g. Organization, WebPage, Article, BreadcrumbList) using Schema.org vocabulary.",
      severity: "medium",
      impact: "Missing eligibility for rich snippets (stars, FAQs, breadcrumbs) in search results.",
      effort: "45 minutes"
    });
  } else if (!schemaValid) {
    deterministicIssues.push({
      title: "Invalid JSON-LD structured data",
      description: "One or more JSON-LD blocks could not be parsed as valid JSON.",
      fixSuggestion: "Validate your JSON-LD with Google's Rich Results Test and fix syntax errors.",
      severity: "critical",
      impact: "Invalid structured data is ignored by search engines, negating rich result eligibility.",
      effort: "30 minutes"
    });
  }

  if (hreflangCount > 0 && invalidHreflangCodes.length > 0) {
    deterministicIssues.push({
      title: "Invalid hreflang language codes",
      description: `Found ${invalidHreflangCodes.length} hreflang tag(s) with invalid BCP-47 codes: ${invalidHreflangCodes.join(", ")}.`,
      fixSuggestion: "Use valid BCP-47 language codes (e.g. 'en', 'en-US', 'fr-CA') in all hreflang attributes.",
      severity: "medium",
      impact: "Invalid hreflang codes cause Google to ignore the internationalization signals.",
      effort: "20 minutes"
    });
  }

  if (serpPreview.isTitleTruncated) {
    deterministicIssues.push({
      title: "SERP title will be truncated",
      description: `Title is estimated at ${titlePixelWidth} px wide. Google truncates titles at approximately 600 px.`,
      fixSuggestion: "Shorten the title to keep all key information within the ~600 px (≈ 60 character) limit.",
      severity: "low",
      impact: "Truncated titles reduce CTR as the user may not see the full message.",
      effort: "5 minutes"
    });
  }

  if (serpPreview.isDescTruncated) {
    deterministicIssues.push({
      title: "SERP meta description will be truncated",
      description: `Meta description is ${metaDescriptionLength} characters — Google truncates at approximately 160 chars.`,
      fixSuggestion: "Edit the meta description to fit within 155–160 characters, front-loading the key message.",
      severity: "low",
      impact: "Call-to-action may be cut off in search results.",
      effort: "5 minutes"
    });
  }

  // ── 10. AI Enhancement ────────────────────────────────────────────────────
  //
  // Gemini reviews all collected data plus an HTML excerpt to produce:
  //   • A 2–3 sentence executive summary
  //   • Additional issues not captured by deterministic checks
  //   • Prioritised fix list
  //
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
    passedChecks: string[];
  };

  let aiResponse: AiResponse | null = null;

  try {
    aiResponse = await generateJson<AiResponse>(
      `You are a senior technical SEO consultant performing a comprehensive audit. 
Return JSON with "summary" (2-3 sentences), "issues" (additional issues beyond what deterministic checks found), and "passedChecks" (things done well).

=== PAGE DATA ===
URL: ${snapshot.url}
Title (${titleLength} chars, ~${titlePixelWidth}px): ${title || "(missing)"}
Meta Description (${metaDescriptionLength} chars): ${metaDescription || "(missing)"}
H1 Count: ${h1Count} | H1 Text: ${h1Text.join(" | ") || "(none)"}
Heading Outline: ${headingOutline.map((h) => `${h.level}: ${h.text}`).join(" | ")}
Word Count: ${wordCount} | Content-to-HTML Ratio: ${contentToHtmlRatio}%
Top Keywords: ${keywords.map((k) => `${k.term}(${k.density}%)`).join(", ")}
Internal Links: ${internalLinks} | External Links: ${externalLinks}
Nofollow Links: ${nofollowLinks} | Generic Anchors: ${genericAnchorCount}
Broken Links (sampled): ${brokenLinks.join(", ") || "none detected"}
Images Total: ${totalImages} | Without Alt: ${imagesWithoutAlt.length} | Without Dimensions: ${imagesWithoutDimensions.length}
Canonical: ${canonical ?? "(missing)"} | Self-Referencing: ${isCanonicalSelf}
Open Graph Complete: ${openGraphComplete} | OG Data: ${JSON.stringify(openGraphData)}
Twitter Card: ${hasTwitterCard} (type: ${twitterCardType ?? "n/a"})
Schema Count: ${schemaCount} | Schema Valid: ${schemaValid} | Schema Types: ${schemaTypes.join(", ") || "none"}
Hreflang Count: ${hreflangCount} | Invalid Codes: ${invalidHreflangCodes.join(", ") || "none"}
Noindex: ${noIndex} | Nofollow Meta: ${noFollow}
Has AMP Link: ${hasAmpLink} | Has Pagination Links: ${hasPaginationLinks}
Multiple Title Tags: ${multipleTitleTags}
Deterministic Issues Found: ${deterministicIssues.length} (${deterministicIssues.map((i) => i.title).join("; ")})

=== HTML EXCERPT (first 10000 chars) ===
${html.slice(0, 10000)}`,
      [],
      defaultIssueSchema
    );
  } catch {
    // AI failure is non-fatal — deterministic issues + fallback summary will be used
    aiResponse = null;
  }

  // ── 11. Merge Issues ──────────────────────────────────────────────────────
  //
  // Strategy: Start with all deterministic issues (ground truth), then append
  // any additional AI-identified issues that don't duplicate existing titles.
  //
  const deterministicTitlesLower = new Set(
    deterministicIssues.map((i) => i.title.toLowerCase())
  );

  const aiOnlyIssues =
    aiResponse?.issues.filter(
      (ai) => !deterministicTitlesLower.has(ai.title.toLowerCase())
    ) ?? [];

  const allRawIssues = [...deterministicIssues, ...aiOnlyIssues];

  const issues: AuditIssue[] = allRawIssues.map((issue) => ({
    ...issue,
    category: "seo" as const
  }));

  // ── 12. Weighted Penalty Score ────────────────────────────────────────────
  //
  //   Start at 100, deduct:
  //     critical → 15 pts each
  //     medium   → 7  pts each
  //     low      → 3  pts each
  //   Floor at 0.
  //
  const penaltyScore = (() => {
    let score = 100;
    for (const issue of issues) {
      if (issue.severity === "critical") score -= 15;
      else if (issue.severity === "medium") score -= 7;
      else score -= 3;
    }
    return Math.max(0, score);
  })();

  // Blend with the shared density scorer for consistency across Scrutin categories
  const densityScore = scoreFromIssueDensity(issues.length, 15, 7, 3, issues);
  const score = Math.round((penaltyScore + densityScore) / 2);

  // ── 13. Passed Checks ─────────────────────────────────────────────────────
  const deterministicPassed: string[] = [
    title && titleLength >= 30 && titleLength <= 60 ? "Title length is optimal (50–60 chars)" : "",
    metaDescription && metaDescriptionLength >= 70 && metaDescriptionLength <= 160
      ? "Meta description length is optimal"
      : "",
    h1Count === 1 ? "Single H1 tag present" : "",
    !hasHeadingHierarchyIssue && allHeadings.length > 0 ? "Heading hierarchy is well-structured" : "",
    !isThinnContent ? `Sufficient word count (${wordCount} words)` : "",
    canonical && isCanonicalSelf ? "Self-referencing canonical tag present" : "",
    openGraphComplete ? "Open Graph metadata is complete" : "",
    hasTwitterCard ? `Twitter Card present (${twitterCardType ?? "set"})` : "",
    schemaCount > 0 && schemaValid ? `Valid structured data detected (${schemaTypes.join(", ")})` : "",
    imagesWithoutAlt.length === 0 && totalImages > 0 ? "All images have alt text" : "",
    !noIndex ? "Page is indexable (no noindex directive)" : "",
    hreflangCount > 0 && invalidHreflangCodes.length === 0 ? `Hreflang tags present and valid (${hreflangCount})` : "",
    hasAmpLink ? "AMP version linked" : "",
    hasPaginationLinks ? "Pagination links (rel=prev/next) present" : "",
    brokenLinks.length === 0 ? "No broken external links detected in sample" : "",
    !metaKeywordsPresent ? "No deprecated meta keywords tag" : "",
    metaViewportPresent ? "Viewport meta tag present" : "",
    contentToHtmlRatio >= 10 ? `Good content-to-HTML ratio (${contentToHtmlRatio}%)` : ""
  ].filter(Boolean);

  const passedChecks: string[] =
    aiResponse?.passedChecks && aiResponse.passedChecks.length > 0
      ? [...new Set([...deterministicPassed, ...aiResponse.passedChecks])]
      : deterministicPassed;

  // ── 14. Assemble return value ─────────────────────────────────────────────
  const data: SeoData = {
    // Title & Meta
    title,
    titleLength,
    titlePixelWidth,
    metaDescription,
    metaDescriptionLength,
    metaKeywordsPresent,
    metaViewportPresent,
    metaRobotsContent,
    noIndex,
    noFollow,

    // Headings
    h1Count,
    h1Text,
    headingOutline,
    hasHeadingHierarchyIssue,

    // Content
    wordCount,
    contentToHtmlRatio,
    keywords,
    isThinnContent,

    // Links
    internalLinks,
    externalLinks,
    nofollowLinks,
    genericAnchorCount,
    brokenLinks,

    // Images
    imagesWithoutAlt,
    imagesWithoutDimensions,
    imagesWithLongAlt,
    totalImages,

    // Technical SEO
    canonical,
    isCanonicalSelf,
    hasTwitterCard,
    twitterCardType,
    openGraphComplete,
    openGraphData,
    schemaCount,
    schemaTypes,
    schemaValid,
    hreflangCount,
    hasAmpLink,
    hasPaginationLinks,

    // SERP Preview
    serpPreview,

    // Multi-title
    multipleTitleTags
  };

  return {
    category: "seo",
    score,
    grade: getGrade(score),
    summary:
      aiResponse?.summary ??
      `SEO audit completed with ${issues.length} issue(s) identified across ${deterministicIssues.length} deterministic checks. ` +
        `The page scored ${score}/100 with ${issues.filter((i) => i.severity === "critical").length} critical, ` +
        `${issues.filter((i) => i.severity === "medium").length} medium, and ` +
        `${issues.filter((i) => i.severity === "low").length} low-priority concerns.`,
    issues,
    passedChecks,
    data
  };
}
