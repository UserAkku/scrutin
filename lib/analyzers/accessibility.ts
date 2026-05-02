import { generateJson, defaultIssueSchema } from "@/lib/gemini";
import { scoreFromIssueDensity } from "@/lib/scoring";
import { getGrade } from "@/lib/utils";
import type { AuditIssue, CategoryResult } from "@/types/audit";
import { fetchHtmlSnapshot } from "@/lib/analyzers/shared";

export async function analyzeAccessibility(targetUrl: string): Promise<CategoryResult> {
  const snapshot = await fetchHtmlSnapshot(targetUrl);
  const { root, html } = snapshot;
  const imagesWithoutAlt = root.querySelectorAll("img").filter((node) => !node.getAttribute("alt")).length;
  const unlabeledInputs = root
    .querySelectorAll("input, textarea, select")
    .filter((node) => {
      const id = node.getAttribute("id");
      return !node.getAttribute("aria-label") && !(id && root.querySelector(`label[for="${id}"]`));
    }).length;
  const genericLinks = root
    .querySelectorAll("a")
    .filter((node) => /^(click here|read more|learn more)$/i.test(node.text.trim())).length;
  const hasLang = Boolean(root.querySelector("html")?.getAttribute("lang"));
  const skipLink = Boolean(root.querySelector('a[href^="#"]'));
  const landmarks = root.querySelectorAll("main, nav, header, footer, aside").length;

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
        passedChecks: string[];
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
      passedChecks: string[];
    }>(
      `You are a WCAG 2.1 AA accessibility auditor. Return JSON with "summary", "issues", and "passedChecks".
Images without alt: ${imagesWithoutAlt}
Unlabeled form controls: ${unlabeledInputs}
Generic links: ${genericLinks}
Has html lang: ${hasLang}
Has skip link: ${skipLink}
Landmarks count: ${landmarks}
HTML excerpt: ${html.slice(0, 12000)}`,
      [],
      defaultIssueSchema
    );
  } catch {
    aiResponse = null;
  }

  const fallbackIssues: Omit<AuditIssue, "category">[] = [];
  if (imagesWithoutAlt > 0) {
    fallbackIssues.push({
      title: "Images missing alternative text",
      description: `${imagesWithoutAlt} image(s) are missing alt text.`,
      fixSuggestion: "Add descriptive alt text for informative images and empty alt text for decorative assets.",
      severity: "medium",
      impact: "Screen reader and image accessibility suffers.",
      effort: "15 minutes"
    });
  }
  if (unlabeledInputs > 0) {
    fallbackIssues.push({
      title: "Form controls missing labels",
      description: `${unlabeledInputs} form control(s) do not have an accessible label.`,
      fixSuggestion: "Associate visible labels or aria-label values with every form field.",
      severity: "critical",
      impact: "Keyboard and assistive-tech users may be blocked.",
      effort: "20 minutes"
    });
  }

  const issues = (aiResponse?.issues ?? fallbackIssues).map((issue) => ({
    ...issue,
    category: "accessibility" as const
  }));
  const score = scoreFromIssueDensity(issues.length, 15, 7, 3, issues);

  return {
    category: "accessibility",
    score,
    grade: getGrade(score),
    summary:
      aiResponse?.summary ??
      "Accessibility audit completed from semantic HTML, form labeling, and content-structure checks.",
    issues,
    passedChecks:
      aiResponse?.passedChecks ??
      [
        hasLang ? "HTML lang attribute present" : "",
        skipLink ? "Skip link detected" : "",
        landmarks > 0 ? "Landmarks detected" : ""
      ].filter(Boolean),
    data: {
      imagesWithoutAlt,
      unlabeledInputs,
      genericLinks,
      hasLang,
      skipLink,
      landmarks
    }
  };
}
