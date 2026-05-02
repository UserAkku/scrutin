import type { SecurityModuleResult } from "./types";

const KNOWN_TRACKERS = new Set([
  "google-analytics.com", "googletagmanager.com", "facebook.net",
  "hotjar.com", "mixpanel.com", "segment.io", "amplitude.com",
  "clarity.ms", "mouseflow.com", "fullstory.com", "heap.io",
  "intercom.io", "hubspot.com", "salesforce.com",
  "doubleclick.net", "googlesyndication.com", "fbcdn.net",
  "connect.facebook.net", "analytics.google.com",
]);

const CONSENT_SIGNALS = [
  "cookie-consent", "cookie-banner", "gdpr", "ccpa",
  "cookiebot", "onetrust", "cookiehub", "cookie-notice",
  "cookie-policy", "consent-manager", "privacy-consent",
];

const FINGERPRINT_PATTERNS = [
  { pattern: /canvas\.toDataURL/g,                   name: "Canvas fingerprinting" },
  { pattern: /AudioContext/g,                        name: "Audio fingerprinting" },
  { pattern: /screen\.width[\s\S]{0,30}screen\.height/g, name: "Screen fingerprinting" },
  { pattern: /navigator\.plugins/g,                  name: "Plugin enumeration" },
];

export async function runPrivacyModule(
  html: string,
  root: ReturnType<typeof import("node-html-parser").parse>,
  baseUrl: string
): Promise<SecurityModuleResult> {
  const issues: SecurityModuleResult["issues"] = [];
  const passedChecks: string[] = [];
  const data: Record<string, unknown> = {};

  const origin = new URL(baseUrl).origin;

  // --- Third-party tracker detection ---
  const trackers: string[] = [];
  const scriptEls = root.querySelectorAll("script[src]");
  for (const el of scriptEls) {
    const src = el.getAttribute("src") ?? "";
    try {
      const host = new URL(src, origin).hostname;
      for (const tracker of KNOWN_TRACKERS) {
        if (host === tracker || host.endsWith(`.${tracker}`)) {
          if (!trackers.includes(tracker)) trackers.push(tracker);
          break;
        }
      }
    } catch {
      // skip
    }
  }

  // Also check inline scripts for tracker domains
  const inlineScripts = root.querySelectorAll("script:not([src])").map((el) => el.text).join("\n");
  for (const tracker of KNOWN_TRACKERS) {
    if (inlineScripts.includes(tracker) && !trackers.includes(tracker)) {
      trackers.push(tracker);
    }
  }

  data.trackers = trackers;

  // --- Cookie consent detection ---
  const htmlLower = html.toLowerCase();
  const hasConsent = CONSENT_SIGNALS.some(
    (sig) =>
      htmlLower.includes(`class="${sig}`) ||
      htmlLower.includes(`id="${sig}`) ||
      htmlLower.includes(`class='${sig}`) ||
      htmlLower.includes(`id='${sig}`) ||
      htmlLower.includes(sig)
  );
  data.hasConsent = hasConsent;

  if (trackers.length > 0 && !hasConsent) {
    issues.push({
      title: `${trackers.length} tracker(s) found without cookie consent`,
      description: `Third-party trackers detected: ${trackers.slice(0, 5).join(", ")}. No cookie consent mechanism was found on the page.`,
      fixSuggestion: "Implement a GDPR/CCPA-compliant cookie consent banner. Use a CMP like Cookiebot, OneTrust, or a custom solution.",
      severity: "medium",
      impact: "Non-compliance with GDPR/CCPA can result in fines and legal action.",
      effort: "2 hours"
    });
  } else if (trackers.length > 0 && hasConsent) {
    passedChecks.push(`Cookie consent present (${trackers.length} trackers)`);
  } else if (trackers.length === 0) {
    passedChecks.push("No third-party trackers detected");
  }

  if (trackers.length > 5) {
    issues.push({
      title: `Excessive tracking: ${trackers.length} third-party trackers`,
      description: `A large number of third-party tracking scripts are loaded: ${trackers.join(", ")}`,
      fixSuggestion: "Audit and reduce the number of third-party trackers. Each one is a potential privacy and performance concern.",
      severity: "low",
      impact: "Excessive tracking raises privacy concerns and slows page load.",
      effort: "1 hour"
    });
  }

  // --- Browser fingerprinting detection ---
  const allJs = inlineScripts;
  const fingerprintingMethods: string[] = [];
  for (const fp of FINGERPRINT_PATTERNS) {
    fp.pattern.lastIndex = 0;
    if (fp.pattern.test(allJs)) {
      fingerprintingMethods.push(fp.name);
    }
  }

  if (fingerprintingMethods.length > 0 && !hasConsent) {
    issues.push({
      title: "Browser fingerprinting without consent",
      description: `Fingerprinting techniques detected: ${fingerprintingMethods.join(", ")}. No consent mechanism found.`,
      fixSuggestion: "Ensure fingerprinting is disclosed in your privacy policy and requires user consent.",
      severity: "medium",
      impact: "Browser fingerprinting without consent may violate GDPR.",
      effort: "1 hour"
    });
  }
  data.fingerprinting = fingerprintingMethods;

  // --- Privacy policy link ---
  const links = root.querySelectorAll("a");
  const hasPrivacyPolicy = links.some((a) => {
    const text = (a.text ?? "").toLowerCase();
    const href = (a.getAttribute("href") ?? "").toLowerCase();
    return (
      text.includes("privacy") ||
      text.includes("data policy") ||
      href.includes("privacy") ||
      href.includes("datapolicy")
    );
  });

  if (hasPrivacyPolicy) {
    passedChecks.push("Privacy policy link present");
  } else {
    issues.push({
      title: "No privacy policy link found",
      description: "The page does not contain a link to a privacy policy.",
      fixSuggestion: "Add a clearly visible link to your privacy policy, typically in the footer.",
      severity: "low",
      impact: "Required by GDPR, CCPA, and most app stores.",
      effort: "15 minutes"
    });
  }
  data.hasPrivacyPolicy = hasPrivacyPolicy;

  let score = 100;
  for (const i of issues) {
    if (i.severity === "critical") score -= 20;
    else if (i.severity === "medium") score -= 10;
    else score -= 5;
  }
  score = Math.max(0, Math.min(100, score));

  return { moduleName: "privacy", issues, passedChecks, score, data };
}
