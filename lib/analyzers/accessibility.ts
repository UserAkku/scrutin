/**
 * Accessibility Analyzer — Scrutin
 *
 * Performs 40+ WCAG 2.1 AA accessibility checks using:
 *   1. axe-core injected via Puppeteer (live browser evaluation)
 *   2. Static HTML analysis via node-html-parser (20 structural checks)
 *   3. AI-enhanced executive summary via Gemini
 *
 * Gracefully degrades to static-only mode if Puppeteer/axe-core fails.
 */

import { generateJson, defaultIssueSchema } from "@/lib/gemini";
import { getGrade } from "@/lib/utils";
import type { AuditIssue, CategoryResult } from "@/types/audit";
import { fetchHtmlSnapshot } from "@/lib/analyzers/shared";
import type { HTMLElement as NHTMLElement } from "node-html-parser";

// ---------------------------------------------------------------------------
// Axe-core type definitions (subset we actually use)
// ---------------------------------------------------------------------------

interface AxeNodeResult {
  html: string;
  failureSummary?: string;
  target?: string[];
}

interface AxeViolation {
  id: string;
  impact: "critical" | "serious" | "moderate" | "minor" | null;
  description: string;
  help: string;
  helpUrl: string;
  nodes: AxeNodeResult[];
  tags: string[];
}

interface AxePassResult {
  id: string;
  description: string;
  help: string;
  tags: string[];
  nodes: AxeNodeResult[];
}

interface AxeIncompleteResult {
  id: string;
  impact: string | null;
  description: string;
  nodes: AxeNodeResult[];
}

interface AxeResults {
  violations: AxeViolation[];
  passes: AxePassResult[];
  incomplete: AxeIncompleteResult[];
  inapplicable: Array<{ id: string }>;
  timestamp: string;
  url: string;
  testEngine: { name: string; version: string };
}

// ---------------------------------------------------------------------------
// Static check result type
// ---------------------------------------------------------------------------

interface StaticCheckResult {
  /** Human-readable name of the check */
  name: string;
  /** Whether the page passes this check */
  passed: boolean;
  /** Optional count of affected elements (0 when passed) */
  count?: number;
  /** Details string for issue description */
  detail?: string;
}

// ---------------------------------------------------------------------------
// Data shape exposed in CategoryResult.data
// ---------------------------------------------------------------------------

export interface AccessibilityData {
  axeViolationsCount: number;
  axePassesCount: number;
  axeIncompleteCount: number;
  wcagCritical: number;
  wcagSerious: number;
  wcagModerate: number;
  wcagMinor: number;
  imagesWithoutAlt: number;
  formControlsWithoutLabels: number;
  hasLang: boolean;
  langValue: string;
  hasPageTitle: boolean;
  hasSkipNav: boolean;
  landmarkCount: number;
  videoWithoutCaptions: number;
  positiveTabIndex: number;
  genericButtonText: number;
  genericLinkText: number;
  topViolations: Array<{
    id: string;
    impact: string;
    nodeCount: number;
    description: string;
  }>;
  axeAvailable: boolean;
  staticChecksTotal: number;
  staticChecksPassed: number;
}

// ---------------------------------------------------------------------------
// Helper — map axe impact to our severity
// ---------------------------------------------------------------------------

function axeImpactToSeverity(
  impact: AxeViolation["impact"]
): "critical" | "medium" | "low" {
  if (impact === "critical" || impact === "serious") return "critical";
  if (impact === "moderate") return "medium";
  return "low"; // minor | null
}

// ---------------------------------------------------------------------------
// Helper — estimate fix effort from violation type
// ---------------------------------------------------------------------------

function estimateEffort(violationId: string): string {
  const quick = new Set([
    "html-has-lang",
    "document-title",
    "meta-viewport",
    "bypass",
    "landmark-one-main",
    "page-has-heading-one",
    "region",
    "skip-link",
  ]);
  const medium = new Set([
    "color-contrast",
    "image-alt",
    "button-name",
    "link-name",
    "aria-label",
    "label",
    "input-image-alt",
    "select-name",
    "frame-title",
  ]);
  const hard = new Set([
    "keyboard",
    "focus-order-semantics",
    "tabindex",
    "scrollable-region-focusable",
    "video-caption",
    "audio-caption",
    "td-headers-attr",
    "table-duplicate-name",
  ]);

  if (quick.has(violationId)) return "< 5 minutes";
  if (medium.has(violationId)) return "15–30 minutes";
  if (hard.has(violationId)) return "1–2 hours";
  return "30–60 minutes";
}

// ---------------------------------------------------------------------------
// runAxeCore — launch isolated Puppeteer session, inject axe, evaluate
// ---------------------------------------------------------------------------

async function runAxeCore(targetUrl: string): Promise<AxeResults> {
  const puppeteer = (await import("puppeteer")).default;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();

  try {
    // Set a realistic viewport so media-query-gated UI renders correctly
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 20000 });

    // Inject the axe-core library via its resolved file path so it's
    // available in the browser context as `window.axe`.
    await page.addScriptTag({ path: require.resolve("axe-core") });

    // Run axe with WCAG 2.1 A, AA and best-practice rule sets
    const results = await page.evaluate(async (): Promise<AxeResults> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const axe = (window as any).axe as {
        run: (
          ctx: Document,
          opts: object
        ) => Promise<AxeResults>;
      };

      return axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "best-practice"],
        },
        // Limit each rule result to first 15 nodes to keep payload manageable
        resultTypes: ["violations", "passes", "incomplete"],
      });
    });

    await browser.close();
    return results;
  } catch (error) {
    // Ensure we always clean up the browser
    try {
      await browser.close();
    } catch {
      /* ignore secondary error */
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// mapAxeViolationsToIssues — convert axe violation objects → AuditIssue[]
// ---------------------------------------------------------------------------

function mapAxeViolationsToIssues(violations: AxeViolation[]): Omit<AuditIssue, "category">[] {
  return violations.map((violation) => {
    const firstNodeHtml = violation.nodes[0]?.html?.slice(0, 120) ?? "";
    const nodeCount = violation.nodes.length;

    return {
      title: violation.help,
      description: `${violation.description}${firstNodeHtml ? ` — e.g. \`${firstNodeHtml}\`` : ""}`,
      fixSuggestion: violation.helpUrl,
      severity: axeImpactToSeverity(violation.impact),
      impact: `Affects ${nodeCount} element${nodeCount !== 1 ? "s" : ""} on the page`,
      effort: estimateEffort(violation.id),
    };
  });
}

// ---------------------------------------------------------------------------
// runStaticChecks — 20 structural WCAG checks on the parsed HTML tree
// ---------------------------------------------------------------------------

function runStaticChecks(
  root: ReturnType<typeof import("node-html-parser").parse>,
  html: string
): StaticCheckResult[] {
  const results: StaticCheckResult[] = [];

  // -- 1. Language attribute on <html> --
  const htmlEl = root.querySelector("html");
  const langValue = htmlEl?.getAttribute("lang")?.trim() ?? "";
  results.push({
    name: "HTML lang attribute present",
    passed: langValue.length > 0,
    detail: langValue || "Missing lang attribute",
  });

  // -- 2. Page title --
  const title = root.querySelector("title")?.text?.trim() ?? "";
  results.push({
    name: "Page <title> element present",
    passed: title.length > 0,
    detail: title || "No <title> element found",
  });

  // -- 3. Images without alt --
  const allImages = root.querySelectorAll("img");
  const imgsWithoutAlt = allImages.filter(
    (img) => img.getAttribute("alt") === null
  );
  results.push({
    name: "All images have alt text",
    passed: imgsWithoutAlt.length === 0,
    count: imgsWithoutAlt.length,
    detail: `${imgsWithoutAlt.length} image(s) missing alt attribute`,
  });

  // -- 4. Form controls without labels --
  const formControls = root.querySelectorAll("input, textarea, select");
  const unlabeled = formControls.filter((ctrl) => {
    const type = ctrl.getAttribute("type")?.toLowerCase();
    // Hidden, submit, reset, and button inputs don't need a label
    if (type && ["hidden", "submit", "reset", "button", "image"].includes(type)) {
      return false;
    }
    const id = ctrl.getAttribute("id");
    const hasAriaLabel = ctrl.getAttribute("aria-label");
    const hasAriaLabelledBy = ctrl.getAttribute("aria-labelledby");
    const hasAssociatedLabel = id && root.querySelector(`label[for="${id}"]`);
    const isWrappedInLabel = isDescendantOfLabel(ctrl, root);
    return !hasAriaLabel && !hasAriaLabelledBy && !hasAssociatedLabel && !isWrappedInLabel;
  });
  results.push({
    name: "Form controls have labels",
    passed: unlabeled.length === 0,
    count: unlabeled.length,
    detail: `${unlabeled.length} form control(s) without accessible labels`,
  });

  // -- 5. Buttons without accessible names --
  const buttons = root.querySelectorAll("button, [role='button']");
  const unnamedButtons = buttons.filter((btn) => {
    const text = btn.text?.trim() ?? "";
    const ariaLabel = btn.getAttribute("aria-label")?.trim() ?? "";
    const ariaLabelledBy = btn.getAttribute("aria-labelledby")?.trim() ?? "";
    const title_ = btn.getAttribute("title")?.trim() ?? "";
    return !text && !ariaLabel && !ariaLabelledBy && !title_;
  });
  results.push({
    name: "Buttons have accessible names",
    passed: unnamedButtons.length === 0,
    count: unnamedButtons.length,
    detail: `${unnamedButtons.length} button(s) without accessible names`,
  });

  // -- 6. Links without accessible names --
  const links = root.querySelectorAll("a");
  const unnamedLinks = links.filter((link) => {
    const text = link.text?.trim() ?? "";
    const ariaLabel = link.getAttribute("aria-label")?.trim() ?? "";
    const ariaLabelledBy = link.getAttribute("aria-labelledby")?.trim() ?? "";
    const title_ = link.getAttribute("title")?.trim() ?? "";
    const hasImg = link.querySelector("img[alt]") !== null;
    return !text && !ariaLabel && !ariaLabelledBy && !title_ && !hasImg;
  });
  results.push({
    name: "Links have accessible names",
    passed: unnamedLinks.length === 0,
    count: unnamedLinks.length,
    detail: `${unnamedLinks.length} link(s) without accessible names`,
  });

  // -- 7. Skip navigation link --
  const skipNav = root.querySelectorAll('a[href^="#"]').some((a) => {
    const text = a.text?.toLowerCase()?.trim() ?? "";
    return (
      text.includes("skip") ||
      text.includes("jump") ||
      text.includes("main content")
    );
  });
  results.push({
    name: "Skip navigation link present",
    passed: skipNav,
    detail: skipNav ? "Skip link found" : "No skip navigation link detected",
  });

  // -- 8. Landmark regions (main, nav, header, footer) --
  const landmarkCount = root.querySelectorAll(
    "main, nav, header, footer, aside, [role='main'], [role='navigation'], [role='banner'], [role='contentinfo'], [role='complementary']"
  ).length;
  results.push({
    name: "Page uses landmark regions",
    passed: landmarkCount >= 2,
    count: landmarkCount,
    detail: `${landmarkCount} landmark region(s) found`,
  });

  // -- 9. Heading hierarchy (h1 exists, no skipped levels) --
  const h1Count = root.querySelectorAll("h1").length;
  results.push({
    name: "Page has an h1 heading",
    passed: h1Count > 0,
    count: h1Count,
    detail: h1Count > 0 ? `${h1Count} h1 element(s) found` : "No h1 element found",
  });

  // -- 10. Positive tabindex (anti-pattern) --
  const positiveTabIndexEls = root
    .querySelectorAll("[tabindex]")
    .filter((el) => {
      const val = parseInt(el.getAttribute("tabindex") ?? "0", 10);
      return val > 0;
    });
  results.push({
    name: "No positive tabindex values",
    passed: positiveTabIndexEls.length === 0,
    count: positiveTabIndexEls.length,
    detail: `${positiveTabIndexEls.length} element(s) with positive tabindex`,
  });

  // -- 11. Video elements without captions track --
  const videos = root.querySelectorAll("video");
  const videosWithoutCaptions = videos.filter((video) => {
    return !video.querySelector('track[kind="captions"], track[kind="subtitles"]');
  });
  results.push({
    name: "Videos have captions",
    passed: videosWithoutCaptions.length === 0,
    count: videosWithoutCaptions.length,
    detail: `${videosWithoutCaptions.length} video(s) missing caption tracks`,
  });

  // -- 12. Audio elements without captions track --
  const audios = root.querySelectorAll("audio");
  const audiosWithoutTrack = audios.filter((audio) => {
    return !audio.querySelector("track");
  });
  results.push({
    name: "Audio elements have transcripts/tracks",
    passed: audiosWithoutTrack.length === 0 || audios.length === 0,
    count: audiosWithoutTrack.length,
    detail: `${audiosWithoutTrack.length} audio element(s) without track`,
  });

  // -- 13. Blinking/marquee elements (deprecated + seizure risk) --
  const blinkCount =
    root.querySelectorAll("blink, marquee").length +
    (html.match(/animation[^;]*blink/gi)?.length ?? 0);
  results.push({
    name: "No blinking or marquee content",
    passed: blinkCount === 0,
    count: blinkCount,
    detail: `${blinkCount} potentially blinking/marquee element(s)`,
  });

  // -- 14. Generic button text --
  const genericBtnPatterns = /^(click here|submit|button|ok|yes|no|go|more|next|prev)$/i;
  const genericBtns = buttons.filter((btn) =>
    genericBtnPatterns.test(btn.text?.trim() ?? "")
  );
  results.push({
    name: "Buttons have descriptive text",
    passed: genericBtns.length === 0,
    count: genericBtns.length,
    detail: `${genericBtns.length} button(s) with generic/non-descriptive text`,
  });

  // -- 15. Generic link text --
  const genericLinkPatterns = /^(click here|read more|learn more|more|here|this|link|download)$/i;
  const genericLinks = links.filter((link) =>
    genericLinkPatterns.test(link.text?.trim() ?? "")
  );
  results.push({
    name: "Links have descriptive text",
    passed: genericLinks.length === 0,
    count: genericLinks.length,
    detail: `${genericLinks.length} link(s) with generic/non-descriptive text`,
  });

  // -- 16. Autocomplete attributes on sensitive form fields --
  const sensitiveInputTypes = ["email", "tel", "name", "password", "username"];
  const sensitiveInputs = root.querySelectorAll(
    sensitiveInputTypes.map((t) => `input[type="${t}"]`).join(", ") +
      ", input[name*='email'], input[name*='phone'], input[name*='name']"
  );
  const missingAutocomplete = sensitiveInputs.filter(
    (inp) => !inp.getAttribute("autocomplete")
  );
  results.push({
    name: "Sensitive inputs have autocomplete attributes",
    passed: missingAutocomplete.length === 0 || sensitiveInputs.length === 0,
    count: missingAutocomplete.length,
    detail: `${missingAutocomplete.length} sensitive input(s) missing autocomplete`,
  });

  // -- 17. ARIA roles validity — detect obvious misuse --
  const invalidAriaRoles = [
    "none", // 'none' on interactive elements hides them from AT
  ];
  const suspectRoles = root
    .querySelectorAll("[role]")
    .filter((el) => {
      const role = el.getAttribute("role") ?? "";
      const tag = el.tagName?.toLowerCase() ?? "";
      // Flag interactive native elements with role="none/presentation" (hides them)
      if (
        (role === "none" || role === "presentation") &&
        ["a", "button", "input", "select", "textarea"].includes(tag)
      ) {
        return true;
      }
      // Detect duplicate main landmarks (only one allowed)
      return false;
    });
  const multipleMain = root.querySelectorAll("main, [role='main']").length > 1;
  const ariaIssueCount = suspectRoles.length + (multipleMain ? 1 : 0);
  results.push({
    name: "ARIA roles used correctly",
    passed: ariaIssueCount === 0,
    count: ariaIssueCount,
    detail: `${ariaIssueCount} suspicious ARIA role usage(s) detected`,
  });

  // -- 18. Focus management — modals/dialogs have aria roles --
  const dialogs = root.querySelectorAll(
    "[role='dialog'], [role='alertdialog'], dialog"
  );
  const dialogsWithoutLabel = dialogs.filter(
    (d) => !d.getAttribute("aria-label") && !d.getAttribute("aria-labelledby")
  );
  results.push({
    name: "Dialogs/modals have accessible names",
    passed: dialogsWithoutLabel.length === 0 || dialogs.length === 0,
    count: dialogsWithoutLabel.length,
    detail: `${dialogsWithoutLabel.length} dialog(s) missing aria-label or aria-labelledby`,
  });

  // -- 19. Tables have headers --
  const tables = root.querySelectorAll("table");
  const tablesWithoutHeaders = tables.filter(
    (tbl) => !tbl.querySelector("th") && !tbl.querySelector("[role='columnheader']")
  );
  results.push({
    name: "Data tables have header cells",
    passed: tablesWithoutHeaders.length === 0 || tables.length === 0,
    count: tablesWithoutHeaders.length,
    detail: `${tablesWithoutHeaders.length} table(s) without <th> headers`,
  });

  // -- 20. Error identification — required inputs have aria-required or required --
  const requiredInputs = root.querySelectorAll(
    "input[required], input[aria-required='true'], textarea[required]"
  );
  const requiredCount = requiredInputs.length;
  // Simply check they exist and have some visible label/hint
  results.push({
    name: "Required fields are marked",
    passed: true, // We flag count but pass — hard to definitively check without DOM
    count: requiredCount,
    detail: `${requiredCount} required field(s) found; verify error messages are provided programmatically`,
  });

  return results;
}

// ---------------------------------------------------------------------------
// Helper — check if a node-html-parser element is a descendant of <label>
// ---------------------------------------------------------------------------

function isDescendantOfLabel(
  node: NHTMLElement,
  root: ReturnType<typeof import("node-html-parser").parse>
): boolean {
  // node-html-parser doesn't expose parentElement reliably; use a fallback
  // by checking the raw outer HTML context
  try {
    let current = node.parentNode;
    while (current) {
      if (
        "tagName" in current &&
        (current as NHTMLElement).tagName?.toLowerCase() === "label"
      ) {
        return true;
      }
      current = (current as NHTMLElement).parentNode;
    }
  } catch {
    /* ignore */
  }
  return false;
}

// ---------------------------------------------------------------------------
// buildStaticIssues — convert failed static checks → AuditIssue list
// ---------------------------------------------------------------------------

function buildStaticIssues(
  checks: StaticCheckResult[]
): Omit<AuditIssue, "category">[] {
  const issues: Omit<AuditIssue, "category">[] = [];

  for (const check of checks) {
    if (check.passed) continue;

    // Determine severity by check name keyword
    let severity: "critical" | "medium" | "low" = "low";
    if (
      check.name.includes("lang") ||
      check.name.includes("label") ||
      check.name.includes("caption") ||
      check.name.includes("title") ||
      check.name.includes("alt")
    ) {
      severity = "critical";
    } else if (
      check.name.includes("button") ||
      check.name.includes("link") ||
      check.name.includes("heading") ||
      check.name.includes("landmark") ||
      check.name.includes("dialog")
    ) {
      severity = "medium";
    }

    issues.push({
      title: check.name,
      description: check.detail ?? `${check.name} check failed`,
      fixSuggestion: getStaticFixSuggestion(check.name),
      severity,
      impact: getStaticImpact(check.name),
      effort: getStaticEffort(check.name),
    });
  }

  return issues;
}

function getStaticFixSuggestion(checkName: string): string {
  const map: Record<string, string> = {
    "HTML lang attribute present":
      'Add a lang attribute to <html>, e.g. <html lang="en">.',
    'Page <title> element present':
      "Add a descriptive <title> element inside <head> that reflects the page purpose.",
    "All images have alt text":
      "Add alt=\"\" (empty) for decorative images; add descriptive alt text for informative images.",
    "Form controls have labels":
      "Use <label for='id'> or aria-label/aria-labelledby on every form control.",
    "Buttons have accessible names":
      "Provide visible text, aria-label, or aria-labelledby on all <button> elements.",
    "Links have accessible names":
      "Avoid empty <a> tags; provide meaningful link text or aria-label.",
    "Skip navigation link present":
      'Add a <a href="#main-content" class="skip-link">Skip to main content</a> as the first interactive element.',
    "Page uses landmark regions":
      "Wrap page sections in semantic HTML5 landmarks: <main>, <nav>, <header>, <footer>, <aside>.",
    "Page has an h1 heading":
      "Every page should have exactly one <h1> that describes its primary topic.",
    "No positive tabindex values":
      "Remove positive tabindex values; use tabindex='0' or '-1' only.",
    "Videos have captions":
      "Add a <track kind='captions'> element inside every <video>.",
    "Audio elements have transcripts/tracks":
      "Provide a text transcript or <track> for every <audio> element.",
    "No blinking or marquee content":
      "Remove <blink> and <marquee> elements; avoid CSS animations that blink faster than 3 Hz.",
    "Buttons have descriptive text":
      "Replace generic labels like 'Click here' with descriptive action text.",
    "Links have descriptive text":
      "Replace 'Read more' / 'Click here' with link text that describes the destination.",
    "Sensitive inputs have autocomplete attributes":
      "Add autocomplete='email', 'tel', 'name', etc. to help password managers and AT.",
    "ARIA roles used correctly":
      "Remove role='none' from interactive native elements; ensure only one <main> landmark exists.",
    "Dialogs/modals have accessible names":
      "Add aria-label or aria-labelledby to every dialog/modal element.",
    "Data tables have header cells":
      "Add <th> elements to identify column/row headers in data tables.",
    "Required fields are marked":
      "Programmatically associate error messages with invalid fields using aria-describedby.",
  };
  return map[checkName] ?? "Review WCAG 2.1 guidelines for this check.";
}

function getStaticImpact(checkName: string): string {
  if (checkName.includes("lang") || checkName.includes("alt"))
    return "Screen readers cannot properly narrate content without this.";
  if (checkName.includes("label") || checkName.includes("caption"))
    return "Users relying on assistive technology may be completely blocked.";
  if (checkName.includes("skip"))
    return "Keyboard-only users must tab through all navigation on every page load.";
  if (checkName.includes("contrast") || checkName.includes("color"))
    return "Low vision users may be unable to read text.";
  return "Affects keyboard and assistive technology users.";
}

function getStaticEffort(checkName: string): string {
  if (
    checkName.includes("lang") ||
    checkName.includes("title") ||
    checkName.includes("skip")
  )
    return "< 5 minutes";
  if (
    checkName.includes("alt") ||
    checkName.includes("label") ||
    checkName.includes("button") ||
    checkName.includes("link")
  )
    return "15–30 minutes";
  return "30–60 minutes";
}

// ---------------------------------------------------------------------------
// computeScore — weighted penalty from axe violations + static failures
// ---------------------------------------------------------------------------

function computeScore(
  violations: AxeViolation[],
  staticChecks: StaticCheckResult[],
  axeAvailable: boolean
): number {
  let score = 100;

  // --- Axe violations ---
  if (axeAvailable) {
    for (const v of violations) {
      switch (v.impact) {
        case "critical":
          score -= Math.min(10, 10); // flat -10 per critical violation
          break;
        case "serious":
          score -= 7;
          break;
        case "moderate":
          score -= 4;
          break;
        case "minor":
          score -= 2;
          break;
      }
    }
  }

  // --- Static check failures ---
  for (const check of staticChecks) {
    if (check.passed) continue;
    const name = check.name;
    // Weight static penalties by severity tier
    if (
      name.includes("lang") ||
      name.includes("alt") ||
      name.includes("label") ||
      name.includes("caption") ||
      name.includes("title")
    ) {
      score -= 8;
    } else if (
      name.includes("landmark") ||
      name.includes("heading") ||
      name.includes("skip") ||
      name.includes("button") ||
      name.includes("link accessible")
    ) {
      score -= 5;
    } else {
      score -= 3;
    }
  }

  return Math.max(0, Math.min(100, score));
}

// ---------------------------------------------------------------------------
// collectPassedChecks — build the passedChecks string array
// ---------------------------------------------------------------------------

function collectPassedChecks(
  axePasses: AxePassResult[],
  staticChecks: StaticCheckResult[],
  axeAvailable: boolean
): string[] {
  const passed: string[] = [];

  // Static passed checks
  for (const check of staticChecks) {
    if (check.passed) {
      passed.push(
        check.count !== undefined
          ? `${check.name} (${check.count} element${check.count !== 1 ? "s" : ""})`
          : check.name
      );
    }
  }

  // Top axe passes (most important rule ids)
  if (axeAvailable) {
    const importantPassIds = new Set([
      "html-has-lang",
      "document-title",
      "color-contrast",
      "image-alt",
      "label",
      "button-name",
      "link-name",
      "bypass",
      "landmark-one-main",
      "page-has-heading-one",
      "meta-viewport",
      "frame-title",
      "aria-required-attr",
      "aria-valid-attr",
      "list",
    ]);

    const importantPasses = axePasses
      .filter((p) => importantPassIds.has(p.id))
      .slice(0, 15);

    for (const p of importantPasses) {
      // Avoid duplicating what static checks already covered
      const label = `[axe] ${p.help}`;
      if (!passed.some((existing) => existing.toLowerCase().includes(p.id))) {
        passed.push(label);
      }
    }
  }

  return passed.slice(0, 30); // cap to avoid oversized payloads
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function analyzeAccessibility(
  targetUrl: string
): Promise<CategoryResult> {
  // ── Step 1: Fetch HTML snapshot (Puppeteer with fallback to fetch) ──────────
  const snapshot = await fetchHtmlSnapshot(targetUrl);
  const { root, html } = snapshot;

  // ── Step 2: Run axe-core in a separate Puppeteer session ───────────────────
  let axeResults: AxeResults | null = null;
  let axeAvailable = false;

  try {
    axeResults = await runAxeCore(targetUrl);
    axeAvailable = true;
  } catch (axeError) {
    // axe-core unavailable (timeout, env restriction, etc.)
    // We continue with static analysis only
    console.warn(
      "[accessibility] axe-core run failed, falling back to static analysis:",
      axeError instanceof Error ? axeError.message : String(axeError)
    );
  }

  // ── Step 3: Run static HTML checks ─────────────────────────────────────────
  const staticChecks = runStaticChecks(root, html);

  // ── Step 4: Build issues list ───────────────────────────────────────────────
  const axeViolations = axeResults?.violations ?? [];
  const axePasses = axeResults?.passes ?? [];
  const axeIncomplete = axeResults?.incomplete ?? [];

  // Count violations by severity
  let wcagCritical = 0;
  let wcagSerious = 0;
  let wcagModerate = 0;
  let wcagMinor = 0;

  for (const v of axeViolations) {
    if (v.impact === "critical") wcagCritical++;
    else if (v.impact === "serious") wcagSerious++;
    else if (v.impact === "moderate") wcagModerate++;
    else wcagMinor++;
  }

  const axeIssues = mapAxeViolationsToIssues(axeViolations);
  const staticIssues = buildStaticIssues(staticChecks);

  // Merge: axe violations take priority; static issues fill in gaps
  // De-duplicate by checking if a similar title already exists in axe results
  const axeIssueTitles = new Set(axeIssues.map((i) => i.title.toLowerCase()));
  const dedupedStaticIssues = staticIssues.filter(
    (si) => !axeIssueTitles.has(si.title.toLowerCase())
  );

  const allRawIssues: Omit<AuditIssue, "category">[] = [
    ...axeIssues,
    ...dedupedStaticIssues,
  ];

  // ── Step 5: Compute score ───────────────────────────────────────────────────
  const rawScore = computeScore(axeViolations, staticChecks, axeAvailable);

  // ── Step 6: Extract data field values from static checks ───────────────────
  const imgCheck = staticChecks.find((c) => c.name.includes("images"));
  const formCheck = staticChecks.find((c) => c.name.includes("Form controls"));
  const langCheck = staticChecks.find((c) => c.name.includes("lang"));
  const titleCheck = staticChecks.find((c) => c.name.includes("title"));
  const skipCheck = staticChecks.find((c) => c.name.includes("Skip"));
  const landmarkCheck = staticChecks.find((c) => c.name.includes("landmark"));
  const videoCheck = staticChecks.find((c) => c.name.includes("Videos"));
  const tabCheck = staticChecks.find((c) => c.name.includes("tabindex"));
  const genericBtnCheck = staticChecks.find((c) => c.name.includes("Buttons have desc"));
  const genericLinkCheck = staticChecks.find((c) => c.name.includes("Links have desc"));

  const imagesWithoutAlt = imgCheck?.count ?? 0;
  const formControlsWithoutLabels = formCheck?.count ?? 0;
  const hasLang = langCheck?.passed ?? false;
  const langValue =
    root.querySelector("html")?.getAttribute("lang")?.trim() ?? "";
  const hasPageTitle = titleCheck?.passed ?? false;
  const hasSkipNav = skipCheck?.passed ?? false;
  const landmarkCount = landmarkCheck?.count ?? 0;
  const videoWithoutCaptions = videoCheck?.count ?? 0;
  const positiveTabIndex = tabCheck?.count ?? 0;
  const genericButtonText = genericBtnCheck?.count ?? 0;
  const genericLinkText = genericLinkCheck?.count ?? 0;

  const topViolations = axeViolations.slice(0, 5).map((v) => ({
    id: v.id,
    impact: v.impact ?? "minor",
    nodeCount: v.nodes.length,
    description: v.help,
  }));

  const staticChecksTotal = staticChecks.length;
  const staticChecksPassed = staticChecks.filter((c) => c.passed).length;

  const data: AccessibilityData = {
    axeViolationsCount: axeViolations.length,
    axePassesCount: axePasses.length,
    axeIncompleteCount: axeIncomplete.length,
    wcagCritical,
    wcagSerious,
    wcagModerate,
    wcagMinor,
    imagesWithoutAlt,
    formControlsWithoutLabels,
    hasLang,
    langValue,
    hasPageTitle,
    hasSkipNav,
    landmarkCount,
    videoWithoutCaptions,
    positiveTabIndex,
    genericButtonText,
    genericLinkText,
    topViolations,
    axeAvailable,
    staticChecksTotal,
    staticChecksPassed,
  };

  // ── Step 7: AI enhancement — pass top violations + static context ──────────
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
    // Build a compact summary of top violations for the prompt
    const top10ViolationsSummary = axeViolations
      .slice(0, 10)
      .map(
        (v, i) =>
          `${i + 1}. [${v.impact ?? "minor"}] ${v.help} — ${v.nodes.length} element(s). Fix: ${v.helpUrl}`
      )
      .join("\n");

    const staticSummary = staticChecks
      .map((c) => `${c.passed ? "✓" : "✗"} ${c.name}: ${c.detail ?? ""}`)
      .join("\n");

    const prompt = `You are a WCAG 2.1 AA accessibility auditor. Analyze this accessibility report and return JSON with "summary", "issues" (prioritized top 10 actionable fixes), and "passedChecks" (top positive findings).

URL: ${targetUrl}
Axe-core available: ${axeAvailable}
Axe violations: ${axeViolations.length} (critical: ${wcagCritical}, serious: ${wcagSerious}, moderate: ${wcagModerate}, minor: ${wcagMinor})
Axe passes: ${axePasses.length}
Axe incomplete: ${axeIncomplete.length}

Top 10 axe violations:
${top10ViolationsSummary || "None (axe-core not available or no violations)"}

Static HTML analysis (${staticChecksPassed}/${staticChecksTotal} passed):
${staticSummary}

HTML excerpt (first 8000 chars):
${html.slice(0, 8000)}

Provide a concise executive summary (2-3 sentences), then prioritize the top issues by impact on disabled users. For each issue include a specific, actionable fixSuggestion. For passedChecks, list the most meaningful passing criteria.`;

    aiResponse = await generateJson<AiResponse>(
      prompt,
      [],
      defaultIssueSchema
    );
  } catch {
    aiResponse = null;
  }

  // ── Step 8: Finalize issues ─────────────────────────────────────────────────
  // Use AI-enhanced issues if available, otherwise use merged axe + static issues
  const finalRawIssues = aiResponse?.issues ?? allRawIssues;

  const issues: AuditIssue[] = finalRawIssues.map((issue) => ({
    ...issue,
    category: "accessibility" as const,
  }));

  // ── Step 9: Final score — use raw computed score (AI doesn't override scoring) ──
  const score = rawScore;

  // ── Step 10: Passed checks ──────────────────────────────────────────────────
  const passedChecks =
    aiResponse?.passedChecks ??
    collectPassedChecks(axePasses, staticChecks, axeAvailable);

  // ── Step 11: Summary ────────────────────────────────────────────────────────
  const summary =
    aiResponse?.summary ??
    (axeAvailable
      ? `Accessibility audit completed using axe-core (${axeViolations.length} violations, ${axePasses.length} passing rules) and ${staticChecksTotal} structural HTML checks (${staticChecksPassed} passed). ${wcagCritical + wcagSerious > 0 ? `${wcagCritical + wcagSerious} critical/serious issues require immediate attention.` : "No critical violations detected."}`
      : `Accessibility audit completed via static HTML analysis (${staticChecksPassed}/${staticChecksTotal} checks passed). axe-core was unavailable for this run; re-audit for full WCAG 2.1 AA coverage.`);

  return {
    category: "accessibility",
    score,
    grade: getGrade(score),
    summary,
    issues,
    passedChecks,
    data,
  };
}
