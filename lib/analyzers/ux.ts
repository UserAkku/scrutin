/**
 * lib/analyzers/ux.ts
 *
 * Comprehensive UX/UI + Conversion Rate Optimisation (CRO) Analyzer.
 *
 * Strategy:
 *  1. Capture dual Puppeteer screenshots (desktop 1280×800, mobile 390×844).
 *     Falls back gracefully to HTML-only analysis if Puppeteer is unavailable.
 *  2. Parse the HTML snapshot with 20+ static heuristic checks covering CTAs,
 *     navigation, trust signals, social proof, forms, and more.
 *  3. Run two focused Gemini passes:
 *       Pass 1 – General UX/UI on the desktop screenshot + HTML context.
 *       Pass 2 – Mobile UX on the mobile screenshot.
 *     Each pass is independently guarded; failures do not abort the run.
 *  4. Merge all issues and compute a scored, graded CategoryResult.
 */

import { SchemaType, type Schema } from "@google/generative-ai";
import { generateJson, defaultIssueSchema } from "@/lib/gemini";
import { getGrade } from "@/lib/utils";
import type { AuditIssue, CategoryResult } from "@/types/audit";
import { fetchHtmlSnapshot } from "@/lib/analyzers/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw issue shape returned from Gemini before we tag the category. */
interface GeminiIssue {
  title: string;
  description: string;
  fixSuggestion: string;
  severity: "critical" | "medium" | "low";
  impact: string;
  effort: string;
}

/** Shape of the first Gemini pass (desktop UX/UI). */
interface DesktopUxResponse {
  summary: string;
  issues: GeminiIssue[];
  wins: string[];
}

/** Shape of the second Gemini pass (mobile UX). */
interface MobileUxResponse {
  summary: string;
  mobileIssues: GeminiIssue[];
  mobileWins: string[];
}

/** Schema for the mobile-specific Gemini response. */

const mobileUxSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: { type: SchemaType.STRING },
    mobileIssues: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
          fixSuggestion: { type: SchemaType.STRING },
          severity: {
            type: SchemaType.STRING,
            enum: ["critical", "medium", "low"]
          },
          impact: { type: SchemaType.STRING },
          effort: { type: SchemaType.STRING }
        },
        required: [
          "title",
          "description",
          "fixSuggestion",
          "severity",
          "impact",
          "effort"
        ]
      }
    },
    mobileWins: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING }
    }
  },
  required: ["summary", "mobileIssues", "mobileWins"]
};

/** Structured data payload surfaced in the CategoryResult. */
export interface UxData {
  desktopScreenshotBase64: string;
  mobileScreenshotBase64: string;
  ctaCount: number;
  ctaTexts: string[];
  hasHeroSection: boolean;
  hasNavigation: boolean;
  navLinkCount: number;
  hasFooter: boolean;
  hasChatWidget: boolean;
  hasCookieBanner: boolean;
  hasNewsletterSignup: boolean;
  hasSocialProof: boolean;
  trustSignals: string[];
  formCount: number;
  avgFormFieldCount: number;
  hasVideo: boolean;
  hasSearch: boolean;
  hasBreadcrumbs: boolean;
  hasPricingSection: boolean;
  hasFaqSection: boolean;
  hasContactInfo: boolean;
  socialLinks: string[];
  lazyImgCount: number;
  htmlLength: number;
}

// ---------------------------------------------------------------------------
// 1. Dual screenshot capture via Puppeteer
// ---------------------------------------------------------------------------

interface Screenshots {
  desktop: string;
  mobile: string;
}

/**
 * Launches two Puppeteer pages – one at desktop dimensions and one simulating
 * a mobile device – and returns both screenshots as base64 PNG strings.
 * The browser is guaranteed to be closed even if an error is thrown.
 */
async function captureScreenshots(targetUrl: string): Promise<Screenshots> {
  const puppeteer = (await import("puppeteer")).default;
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    // ── Desktop ─────────────────────────────────────────────────────────────
    const desktopPage = await browser.newPage();
    await desktopPage.setViewport({ width: 1280, height: 800 });
    await desktopPage.goto(targetUrl, {
      waitUntil: "networkidle2",
      timeout: 20000
    });
    const desktopShot = (await desktopPage.screenshot({
      encoding: "base64",
      fullPage: false
    })) as string;
    await desktopPage.close();

    // ── Mobile ──────────────────────────────────────────────────────────────
    const mobilePage = await browser.newPage();
    await mobilePage.setViewport({
      width: 390,
      height: 844,
      isMobile: true,
      hasTouch: true
    });
    await mobilePage.goto(targetUrl, {
      waitUntil: "networkidle2",
      timeout: 20000
    });
    const mobileShot = (await mobilePage.screenshot({
      encoding: "base64",
      fullPage: false
    })) as string;
    await mobilePage.close();

    return { desktop: desktopShot, mobile: mobileShot };
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// 2. Static HTML heuristic extraction
// ---------------------------------------------------------------------------

/**
 * Comprehensive static HTML analysis – runs entirely from the parsed DOM so
 * it works even when Puppeteer / Gemini are unavailable.
 */
function extractStaticUxSignals(
  root: ReturnType<typeof import("node-html-parser").parse>,
  html: string
): Omit<UxData, "desktopScreenshotBase64" | "mobileScreenshotBase64"> {
  const lowerHtml = html.toLowerCase();

  // ── CTAs ──────────────────────────────────────────────────────────────────
  // Match <button>, elements with class "btn"/"button", and links whose
  // visible text matches common conversion verbs.
  const ctaKeywords =
    /buy|sign[\s-]?up|get started|try|start|subscribe|register|join|book|schedule|request|download|claim|shop|order|contact/i;

  const ctaElements = [
    ...root.querySelectorAll("button"),
    ...root.querySelectorAll('[class*="btn"]'),
    ...root.querySelectorAll('[class*="button"]'),
    ...root.querySelectorAll("a").filter((el) => ctaKeywords.test(el.text))
  ];

  // Deduplicate by text content so we don't double-count styled variants.
  const ctaTextSet = new Set<string>();
  for (const el of ctaElements) {
    const t = el.text.trim().slice(0, 80);
    if (t) ctaTextSet.add(t);
  }
  const ctaTexts = [...ctaTextSet].slice(0, 20);

  // ── Hero section ──────────────────────────────────────────────────────────
  // Heuristic: page has an h1 AND at least one visible CTA near the top.
  const hasH1 = Boolean(root.querySelector("h1"));
  const hasHeroSection =
    hasH1 &&
    (Boolean(root.querySelector("header")) ||
      Boolean(root.querySelector('[class*="hero"]')) ||
      Boolean(root.querySelector('[id*="hero"]')) ||
      ctaTexts.length > 0);

  // ── Navigation ────────────────────────────────────────────────────────────
  const navEl = root.querySelector("nav");
  const hasNavigation = Boolean(navEl);
  const navLinkCount = navEl
    ? navEl.querySelectorAll("a").length
    : root.querySelectorAll("header a").length;

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerEl = root.querySelector("footer");
  const hasFooter = Boolean(footerEl);

  // Social links detected in footer or anywhere in the page
  const socialPlatforms = [
    "twitter.com",
    "x.com",
    "facebook.com",
    "instagram.com",
    "linkedin.com",
    "youtube.com",
    "tiktok.com",
    "pinterest.com",
    "github.com"
  ];
  const allLinks = root
    .querySelectorAll("a[href]")
    .map((el) => el.getAttribute("href") ?? "");
  const socialLinks = [
    ...new Set(
      allLinks.filter((href) =>
        socialPlatforms.some((p) => href.toLowerCase().includes(p))
      )
    )
  ];

  // ── Social proof ──────────────────────────────────────────────────────────
  const socialProofKeywords =
    /(testimonial|review|rating|star|customer|client|trusted by|people love|what.*say)/i;
  const hasSocialProof =
    socialProofKeywords.test(lowerHtml) ||
    Boolean(root.querySelector('[class*="testimonial"]')) ||
    Boolean(root.querySelector('[class*="review"]')) ||
    Boolean(root.querySelector('[class*="rating"]')) ||
    Boolean(root.querySelector('[itemprop="review"]')) ||
    Boolean(root.querySelector('[itemprop="aggregateRating"]'));

  // ── Trust signals ─────────────────────────────────────────────────────────
  const trustSignals: string[] = [];
  if (/ssl|secure|https|padlock/i.test(lowerHtml))
    trustSignals.push("SSL/secure mention");
  if (/money.back|guarantee|refund/i.test(lowerHtml))
    trustSignals.push("Money-back / guarantee");
  if (/privacy.policy/i.test(lowerHtml)) trustSignals.push("Privacy policy");
  if (/terms.*service|terms.*use|tos/i.test(lowerHtml))
    trustSignals.push("Terms of service");
  if (socialLinks.length > 0) trustSignals.push("Social media presence");
  if (/award|certified|accredited|iso\s*\d/i.test(lowerHtml))
    trustSignals.push("Awards / certifications");
  if (/trusted by|used by|loved by|[0-9,]+ (customers|users|clients)/i.test(lowerHtml))
    trustSignals.push("Social validation copy");

  // ── Forms ─────────────────────────────────────────────────────────────────
  const forms = root.querySelectorAll("form");
  const formCount = forms.length;
  const fieldCounts = forms.map(
    (f) => f.querySelectorAll("input, textarea, select").length
  );
  const avgFormFieldCount =
    formCount > 0
      ? Math.round(
          fieldCounts.reduce((a, b) => a + b, 0) / formCount
        )
      : 0;

  // ── Embedded media ────────────────────────────────────────────────────────
  const hasVideo =
    Boolean(root.querySelector("video")) ||
    Boolean(root.querySelector("iframe[src*='youtube']")) ||
    Boolean(root.querySelector("iframe[src*='vimeo']")) ||
    /youtube\.com|vimeo\.com/i.test(lowerHtml);

  // ── Widgets & UX helpers ─────────────────────────────────────────────────
  const hasChatWidget =
    /intercom|drift|crisp|tawk|zendesk|freshchat|livechat|tidio/i.test(
      lowerHtml
    ) ||
    Boolean(root.querySelector('[id*="chat"]')) ||
    Boolean(root.querySelector('[class*="chat-widget"]'));

  const hasCookieBanner =
    /cookie.*(consent|banner|notice|policy|accept)|gdpr|ccpa/i.test(
      lowerHtml
    ) ||
    Boolean(root.querySelector('[id*="cookie"]')) ||
    Boolean(root.querySelector('[class*="cookie"]'));

  const hasNewsletterSignup =
    /newsletter|subscribe.*email|email.*subscribe/i.test(lowerHtml) ||
    Boolean(
      root
        .querySelectorAll('input[type="email"]')
        .find((el) => el.getAttribute("placeholder")?.toLowerCase().includes("email"))
    );

  const hasSearch =
    Boolean(root.querySelector('input[type="search"]')) ||
    Boolean(root.querySelector('[role="search"]')) ||
    Boolean(root.querySelector('[class*="search"]')) ||
    Boolean(root.querySelector("form[action*='search']"));

  const hasBreadcrumbs =
    Boolean(root.querySelector('[aria-label="breadcrumb"]')) ||
    Boolean(root.querySelector('[class*="breadcrumb"]')) ||
    Boolean(root.querySelector('[itemtype*="BreadcrumbList"]'));

  const hasPricingSection =
    /pricing|plans?|subscriptions?|per month|per year|\$\d|\€\d/i.test(
      lowerHtml
    ) ||
    Boolean(root.querySelector('[id*="pricing"]')) ||
    Boolean(root.querySelector('[class*="pricing"]'));

  const hasFaqSection =
    /frequently asked|faq|common questions/i.test(lowerHtml) ||
    Boolean(root.querySelector('[id*="faq"]')) ||
    Boolean(root.querySelector('[class*="faq"]'));

  const hasContactInfo =
    /contact us|get in touch|email.*@|@.*\.(com|net|org)|phone|tel:|call us/i.test(
      lowerHtml
    ) ||
    Boolean(root.querySelector('a[href^="mailto:"]')) ||
    Boolean(root.querySelector('a[href^="tel:"]'));

  // ── Lazy-loaded images ────────────────────────────────────────────────────
  const lazyImgCount = root
    .querySelectorAll("img")
    .filter(
      (img) =>
        img.getAttribute("loading") === "lazy" ||
        img.hasAttribute("data-src") ||
        img.hasAttribute("data-lazy")
    ).length;

  return {
    ctaCount: ctaTexts.length,
    ctaTexts,
    hasHeroSection,
    hasNavigation,
    navLinkCount,
    hasFooter,
    hasChatWidget,
    hasCookieBanner,
    hasNewsletterSignup,
    hasSocialProof,
    trustSignals,
    formCount,
    avgFormFieldCount,
    hasVideo,
    hasSearch,
    hasBreadcrumbs,
    hasPricingSection,
    hasFaqSection,
    hasContactInfo,
    socialLinks,
    lazyImgCount,
    htmlLength: html.length
  };
}

// ---------------------------------------------------------------------------
// 3. Static fallback issues (used when Gemini is unavailable)
// ---------------------------------------------------------------------------

/**
 * Generates concrete, actionable UX issues purely from static HTML signals.
 * Used as the fallback when Gemini is unavailable, and also merged as a
 * supplemental layer when Gemini is available to catch clear structural gaps.
 */
function buildStaticFallbackIssues(
  signals: Omit<UxData, "desktopScreenshotBase64" | "mobileScreenshotBase64">
): Omit<AuditIssue, "category">[] {
  const issues: Omit<AuditIssue, "category">[] = [];

  if (signals.ctaCount === 0) {
    issues.push({
      title: "No clear call-to-action detected",
      description:
        "The page appears to lack prominent CTA buttons or links with action-oriented text (e.g. 'Get Started', 'Buy Now'). This is a critical conversion blocker.",
      fixSuggestion:
        "Add at least one above-the-fold CTA button with contrasting colour and action-oriented copy. Consider placing additional CTAs at the end of key content sections.",
      severity: "critical",
      impact: "Visitors have no clear next step, directly harming conversions.",
      effort: "1–2 hours"
    });
  }

  if (!signals.hasHeroSection) {
    issues.push({
      title: "No hero / above-the-fold section detected",
      description:
        "A strong hero section with a headline, subheadline and CTA is essential for communicating value within the first 3 seconds.",
      fixSuggestion:
        "Design a clear hero block: H1 headline → concise value proposition subheadline → primary CTA → optional supporting image or video.",
      severity: "critical",
      impact: "High bounce rate as visitors cannot instantly grasp the value offer.",
      effort: "4–8 hours"
    });
  }

  if (!signals.hasNavigation) {
    issues.push({
      title: "No navigation element found",
      description:
        "A <nav> landmark is missing. Users and search engines rely on clear navigation to understand site structure.",
      fixSuggestion:
        "Add a semantic <nav> element with descriptive link labels. Include a mobile-responsive hamburger menu.",
      severity: "critical",
      impact: "Poor wayfinding and accessibility, increasing exit rates.",
      effort: "2–4 hours"
    });
  }

  if (!signals.hasSocialProof) {
    issues.push({
      title: "No social proof elements detected",
      description:
        "Testimonials, star ratings, customer logos, or review counts are absent. Social proof is a primary driver of trust and purchase confidence.",
      fixSuggestion:
        "Add a testimonials section, star ratings (using schema markup), or a logo wall of notable clients/customers.",
      severity: "medium",
      impact: "Reduced visitor trust lowers conversion rate.",
      effort: "2–4 hours"
    });
  }

  if (signals.trustSignals.length < 2) {
    issues.push({
      title: "Insufficient trust signals",
      description: `Only ${signals.trustSignals.length} trust signal(s) were detected. Visitors need multiple reassurances (security, guarantees, policies) before committing.`,
      fixSuggestion:
        "Add a money-back guarantee badge, SSL trust indicator, privacy policy link, and/or third-party security seals near purchase CTAs.",
      severity: "medium",
      impact: "Lower perceived credibility reduces conversions and return visits.",
      effort: "1–3 hours"
    });
  }

  if (!signals.hasFooter) {
    issues.push({
      title: "Footer is missing",
      description:
        "A complete footer with contact info, legal links, and social media profiles signals credibility and helps users navigate.",
      fixSuggestion:
        "Add a footer with: company name, contact/email, privacy policy, terms of service, copyright notice, and social links.",
      severity: "medium",
      impact: "Reduced trust; users struggle to find legal/contact information.",
      effort: "1–2 hours"
    });
  }

  if (signals.formCount > 0 && signals.avgFormFieldCount > 6) {
    issues.push({
      title: "Forms may be too long",
      description: `Forms average ${signals.avgFormFieldCount} fields. Long forms significantly reduce completion rates.`,
      fixSuggestion:
        "Audit each form: eliminate optional fields, use progressive disclosure (multi-step forms), and add inline validation to reduce friction.",
      severity: "medium",
      impact: "High form abandonment directly reduces lead and sales conversions.",
      effort: "2–4 hours"
    });
  }

  if (!signals.hasContactInfo) {
    issues.push({
      title: "Contact information not found",
      description:
        "Visible contact details (email, phone, or contact form) build trust and give visitors a clear support path.",
      fixSuggestion:
        "Add a contact section or at minimum a mailto link and/or phone number in the footer or header.",
      severity: "low",
      impact: "Reduced visitor confidence and potential customer service gaps.",
      effort: "30 minutes"
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
// 4. Scoring
// ---------------------------------------------------------------------------

/**
 * Computes a UX score with a generous base (UX is subjective) and applies
 * severity-weighted penalties. Bonus points are awarded for positive signals.
 *
 * Base: 75
 * Penalties: critical −12, medium −6, low −2
 * Bonuses: up to +15 from positive static signals
 * Range: 0–100
 */
function computeUxScore(
  issues: Omit<AuditIssue, "category">[],
  signals: Omit<UxData, "desktopScreenshotBase64" | "mobileScreenshotBase64">
): number {
  const BASE = 75;

  // Severity-weighted penalty
  const penalty = issues.reduce((sum, issue) => {
    if (issue.severity === "critical") return sum + 12;
    if (issue.severity === "medium") return sum + 6;
    return sum + 2;
  }, 0);

  // Positive signal bonuses (each worth 1–3 points, cap at 15)
  let bonus = 0;
  if (signals.ctaCount >= 1) bonus += 3;
  if (signals.hasSocialProof) bonus += 3;
  if (signals.trustSignals.length >= 3) bonus += 3;
  else if (signals.trustSignals.length >= 1) bonus += 1;
  if (signals.hasHeroSection) bonus += 2;
  if (signals.hasNavigation) bonus += 1;
  if (signals.hasFooter) bonus += 1;
  if (signals.hasVideo) bonus += 1;
  if (signals.hasFaqSection) bonus += 1;
  bonus = Math.min(bonus, 15);

  return Math.max(0, Math.min(100, BASE - penalty + bonus));
}

// ---------------------------------------------------------------------------
// 5. Passed checks builder
// ---------------------------------------------------------------------------

function buildPassedChecks(
  signals: Omit<UxData, "desktopScreenshotBase64" | "mobileScreenshotBase64">,
  geminiWins: string[]
): string[] {
  const checks: string[] = [];

  if (signals.ctaCount > 0)
    checks.push(`${signals.ctaCount} CTA button(s) detected`);
  if (signals.hasHeroSection) checks.push("Hero / above-the-fold section present");
  if (signals.hasNavigation)
    checks.push(
      `Navigation found (${signals.navLinkCount} link${signals.navLinkCount !== 1 ? "s" : ""})`
    );
  if (signals.hasFooter) checks.push("Footer present");
  if (signals.hasSocialProof) checks.push("Social proof elements detected");
  if (signals.trustSignals.length > 0)
    checks.push(`Trust signals: ${signals.trustSignals.join(", ")}`);
  if (signals.hasCookieBanner) checks.push("Cookie consent banner present");
  if (signals.hasNewsletterSignup) checks.push("Newsletter / email capture present");
  if (signals.hasSearch) checks.push("Site search functionality detected");
  if (signals.hasBreadcrumbs) checks.push("Breadcrumb navigation present");
  if (signals.hasFaqSection) checks.push("FAQ section detected");
  if (signals.hasPricingSection) checks.push("Pricing section detected");
  if (signals.hasContactInfo) checks.push("Contact information visible");
  if (signals.hasVideo) checks.push("Video content present");
  if (signals.socialLinks.length > 0)
    checks.push(`${signals.socialLinks.length} social media link(s)`);
  if (signals.lazyImgCount > 0)
    checks.push(`${signals.lazyImgCount} lazily-loaded image(s) for faster paint`);

  // Merge unique wins surfaced by Gemini
  for (const win of geminiWins) {
    if (!checks.includes(win)) checks.push(win);
  }

  return checks;
}

// ---------------------------------------------------------------------------
// 6. Main exported function
// ---------------------------------------------------------------------------

/**
 * Runs a full UX/CRO audit for the given URL.
 *
 * Execution order (each step is independently fault-tolerant):
 *  a. fetchHtmlSnapshot    – always runs
 *  b. extractStaticUxSignals – always runs (pure HTML)
 *  c. captureScreenshots   – Puppeteer; graceful fallback to empty strings
 *  d. Gemini Pass 1 (desktop UX) – guards with try/catch
 *  e. Gemini Pass 2 (mobile UX)  – guards with try/catch
 *  f. buildStaticFallbackIssues  – merged when Gemini fails entirely
 *  g. computeUxScore + assemble CategoryResult
 */
export async function analyzeUx(targetUrl: string): Promise<CategoryResult> {
  // ── a. HTML snapshot ────────────────────────────────────────────────────
  const snapshot = await fetchHtmlSnapshot(targetUrl);
  const { html, root } = snapshot;

  // ── b. Static HTML signals ──────────────────────────────────────────────
  const signals = extractStaticUxSignals(root, html);

  // ── c. Dual screenshots ─────────────────────────────────────────────────
  let desktopShot = "";
  let mobileShot = "";

  try {
    const shots = await captureScreenshots(targetUrl);
    desktopShot = shots.desktop;
    mobileShot = shots.mobile;
  } catch {
    // Puppeteer is unavailable in some deployment environments; continue
    // with HTML-only analysis. A note is added to the summary.
  }

  // Helper: build a Gemini inline image part from a base64 PNG string.
  function toImagePart(base64: string) {
    return {
      inlineData: {
        data: base64,
        mimeType: "image/png" as const
      }
    };
  }

  // ── d. Gemini Pass 1: Desktop UX/UI ─────────────────────────────────────
  let desktopResponse: DesktopUxResponse | null = null;

  if (desktopShot) {
    try {
      desktopResponse = await generateJson<DesktopUxResponse>(
        `You are a senior UX designer and CRO specialist performing a professional website audit.
Analyze the provided desktop screenshot (1280×800 viewport) combined with the HTML context below.

Return JSON with exactly these keys:
- "summary"  : Executive summary of overall UX quality (2–4 sentences, actionable tone).
- "issues"   : Specific UX/UI problems found (3–8 issues; severity: "critical" | "medium" | "low").
- "wins"     : What the site does well visually (2–5 bullet strings).

Focus areas:
  • Visual hierarchy and information architecture
  • Typography legibility, contrast ratios, spacing and whitespace
  • CTA prominence, button affordance and placement
  • Trust-building elements (social proof, guarantees, credentials)
  • Value proposition clarity above the fold
  • Colour consistency and brand cohesion
  • Navigation clarity and cognitive load

HTML excerpt for structural context (first 10 000 chars):
${html.slice(0, 10000)}`,
        [toImagePart(desktopShot)],
        defaultIssueSchema
      );
    } catch {
      desktopResponse = null;
    }
  }

  // ── e. Gemini Pass 2: Mobile UX ─────────────────────────────────────────
  let mobileResponse: MobileUxResponse | null = null;

  if (mobileShot) {
    try {
      mobileResponse = await generateJson<MobileUxResponse>(
        `You are a mobile UX expert performing a professional mobile experience audit.
Analyze the provided mobile screenshot (390×844 viewport, iPhone-class device).

Return JSON with exactly these keys:
- "summary"      : Brief summary of mobile UX quality (1–2 sentences).
- "mobileIssues" : Mobile-specific UX problems (2–5 issues; severity: "critical" | "medium" | "low").
- "mobileWins"   : What works well on mobile (1–3 bullet strings).

Focus areas:
  • Tap target sizes (minimum 44×44 px per Apple HIG / Google guidelines)
  • Text readability without pinch-to-zoom (minimum 16 px body text)
  • Navigation usability on small screens (hamburger menu, sticky nav, etc.)
  • Content priority and information hierarchy on mobile
  • Form usability and input types on touch devices
  • Horizontal scrolling or clipped content
  • Load-time proxies visible in the screenshot (skeleton screens, spinners)`,
        [toImagePart(mobileShot)],
        mobileUxSchema
      );
    } catch {
      mobileResponse = null;
    }
  }

  // ── f. Merge issues ──────────────────────────────────────────────────────
  const geminiDesktopIssues: Omit<AuditIssue, "category">[] =
    desktopResponse?.issues ?? [];
  const geminiMobileIssues: Omit<AuditIssue, "category">[] =
    mobileResponse?.mobileIssues ?? [];

  // If both Gemini passes failed, fall back to static issues so the report is
  // always populated with actionable content.
  const usingGeminiFallback =
    geminiDesktopIssues.length === 0 && geminiMobileIssues.length === 0;

  const staticIssues = buildStaticFallbackIssues(signals);

  // Strategy: always include static issues that flag ABSENT critical signals
  // (they are objective facts). Merge with Gemini issues to avoid duplication
  // in terms of high-level topic.
  const geminiTitles = new Set(
    [...geminiDesktopIssues, ...geminiMobileIssues].map((i) =>
      i.title.toLowerCase()
    )
  );

  const filteredStaticIssues = usingGeminiFallback
    ? staticIssues
    : staticIssues.filter((issue) => {
        // Keep static issues that are objective/structural and not already
        // covered by Gemini (rough title deduplication).
        const key = issue.title.toLowerCase();
        return !geminiTitles.has(key);
      });

  const allRawIssues: Omit<AuditIssue, "category">[] = [
    ...geminiDesktopIssues,
    ...geminiMobileIssues,
    ...filteredStaticIssues
  ];

  // Tag all issues with the ux category.
  const issues: AuditIssue[] = allRawIssues.map((issue) => ({
    ...issue,
    category: "ux" as const
  }));

  // ── g. Score & assemble result ───────────────────────────────────────────
  const score = computeUxScore(allRawIssues, signals);

  // Build a human-readable summary.
  let summary =
    desktopResponse?.summary ??
    mobileResponse?.summary ??
    "UX audit completed using structural HTML analysis";

  if (!desktopShot && !mobileShot) {
    summary +=
      " (visual screenshot capture was unavailable; scores are based on HTML structure and heuristics)";
  } else if (!desktopShot) {
    summary += " (desktop screenshot unavailable; desktop score estimated from HTML)";
  } else if (!mobileShot) {
    summary += " (mobile screenshot unavailable; mobile score estimated from HTML)";
  }

  const geminiWins = [
    ...(desktopResponse?.wins ?? []),
    ...(mobileResponse?.mobileWins ?? [])
  ];
  const passedChecks = buildPassedChecks(signals, geminiWins);

  const data: UxData = {
    desktopScreenshotBase64: desktopShot,
    mobileScreenshotBase64: mobileShot,
    ...signals
  };

  return {
    category: "ux",
    score,
    grade: getGrade(score),
    summary,
    issues,
    passedChecks,
    data
  };
}
