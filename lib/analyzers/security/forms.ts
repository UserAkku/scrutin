import type { SecurityModuleResult } from "./types";

export async function runFormsModule(
  root: ReturnType<typeof import("node-html-parser").parse>,
  headers: Headers
): Promise<SecurityModuleResult> {
  const issues: SecurityModuleResult["issues"] = [];
  const passedChecks: string[] = [];
  const data: Record<string, unknown> = {};

  const forms = root.querySelectorAll("form");
  data.formsAnalyzed = forms.length;

  if (forms.length === 0) {
    passedChecks.push("No forms to analyze");
    return { moduleName: "forms", issues, passedChecks, score: 100, data };
  }

  let missingCSRF = 0;
  let httpActions = 0;
  let unsafeAutocomplete = 0;
  let sensitiveHidden = 0;
  let hasLoginForm = false;

  const SENSITIVE_HIDDEN_NAMES = new Set([
    "user_id", "userid", "account_id", "accountid", "role", "admin",
    "price", "amount", "is_admin", "isadmin",
  ]);

  for (const form of forms) {
    const method = (form.getAttribute("method") ?? "get").toLowerCase();
    const action = form.getAttribute("action") ?? "";

    // CSRF token check
    if (method === "post") {
      const hasCSRF = form.querySelector(
        'input[name*="csrf"], input[name*="token"], input[name*="_token"], input[name*="nonce"]'
      );
      if (!hasCSRF) {
        missingCSRF++;
      }
    }

    // Form action over HTTP
    if (action.startsWith("http://")) {
      httpActions++;
    }

    // Password field autocomplete
    const pwdFields = form.querySelectorAll('input[type="password"]');
    if (pwdFields.length > 0) {
      hasLoginForm = true;
      for (const f of pwdFields) {
        const ac = f.getAttribute("autocomplete");
        if (ac !== "off" && ac !== "new-password" && ac !== "current-password") {
          unsafeAutocomplete++;
        }
      }
    }

    // Hidden fields with sensitive names
    const hiddenFields = form.querySelectorAll('input[type="hidden"]');
    for (const hf of hiddenFields) {
      const name = (hf.getAttribute("name") ?? "").toLowerCase();
      if (SENSITIVE_HIDDEN_NAMES.has(name)) {
        sensitiveHidden++;
      }
    }
  }

  if (missingCSRF > 0) {
    issues.push({
      title: `CSRF token missing on ${missingCSRF} POST form(s)`,
      description: `${missingCSRF} form(s) using POST do not contain a visible CSRF token field.`,
      fixSuggestion: "Add a hidden CSRF token input to all POST forms and validate it server-side.",
      severity: "medium",
      impact: "Cross-Site Request Forgery attacks can trick users into performing unintended actions.",
      effort: "30 minutes"
    });
    data.missingCSRF = missingCSRF;
  } else {
    passedChecks.push("CSRF tokens present on POST forms");
  }

  if (httpActions > 0) {
    issues.push({
      title: `${httpActions} form(s) submit over HTTP`,
      description: "Form data is sent over unencrypted HTTP, exposing sensitive data like passwords.",
      fixSuggestion: "Change all form action URLs to use HTTPS.",
      severity: "critical",
      impact: "Form data including credentials can be intercepted.",
      effort: "10 minutes"
    });
  }

  if (unsafeAutocomplete > 0) {
    issues.push({
      title: "Password field autocomplete not restricted",
      description: `${unsafeAutocomplete} password field(s) allow browser autocomplete.`,
      fixSuggestion: 'Set autocomplete="new-password" or autocomplete="off" on password fields.',
      severity: "low",
      impact: "Stored passwords could be auto-filled on shared computers.",
      effort: "5 minutes"
    });
  }

  if (sensitiveHidden > 0) {
    issues.push({
      title: `${sensitiveHidden} hidden field(s) with sensitive names`,
      description: "Hidden form fields contain values like user_id, role, price, or is_admin that could be tampered with.",
      fixSuggestion: "Never trust hidden field values on the server. Validate and authorize all inputs server-side.",
      severity: "medium",
      impact: "Attackers can modify hidden field values to escalate privileges or change prices.",
      effort: "30 minutes"
    });
  }

  // SameSite cookie check
  const setCookie = headers.get("set-cookie") ?? "";
  if (setCookie) {
    const lower = setCookie.toLowerCase();
    if (!lower.includes("samesite=strict") && !lower.includes("samesite=lax")) {
      if (lower.includes("samesite=none") && !lower.includes("secure")) {
        issues.push({
          title: "SameSite=None cookie without Secure flag",
          description: "A cookie has SameSite=None but lacks the Secure attribute, which browsers will reject.",
          fixSuggestion: "Always pair SameSite=None with the Secure flag.",
          severity: "critical",
          impact: "Cookie will be rejected by modern browsers.",
          effort: "10 minutes"
        });
      } else if (!lower.includes("samesite")) {
        issues.push({
          title: "Cookies missing SameSite attribute",
          description: "Set-Cookie headers do not specify a SameSite attribute.",
          fixSuggestion: "Add SameSite=Lax or SameSite=Strict to all cookies.",
          severity: "medium",
          impact: "Cookies are sent with cross-site requests, enabling CSRF attacks.",
          effort: "15 minutes"
        });
      }
    } else {
      passedChecks.push("SameSite cookie attribute present");
    }

    // Secure and HttpOnly checks
    if (!lower.includes("secure")) {
      issues.push({
        title: "Cookie missing Secure flag",
        description: "Cookies are not marked as Secure, so they may be sent over unencrypted HTTP.",
        fixSuggestion: "Add the Secure flag to all cookies.",
        severity: "medium",
        impact: "Cookies can be intercepted on insecure connections.",
        effort: "10 minutes"
      });
    } else {
      passedChecks.push("Cookies have Secure flag");
    }

    if (!lower.includes("httponly")) {
      issues.push({
        title: "Cookie missing HttpOnly flag",
        description: "Cookies are accessible via JavaScript, making them vulnerable to XSS theft.",
        fixSuggestion: "Add the HttpOnly flag to session cookies.",
        severity: "medium",
        impact: "XSS attacks can steal session cookies.",
        effort: "10 minutes"
      });
    } else {
      passedChecks.push("Cookies have HttpOnly flag");
    }
  }

  // Cache-Control on login pages
  if (hasLoginForm) {
    const cacheControl = headers.get("cache-control") ?? "";
    if (!cacheControl.includes("no-store")) {
      issues.push({
        title: "Login page may be cached",
        description: "The page contains a login form but Cache-Control does not include no-store.",
        fixSuggestion: "Add 'Cache-Control: no-store' to pages with authentication forms.",
        severity: "medium",
        impact: "Sensitive page content may be stored in browser or CDN caches.",
        effort: "10 minutes"
      });
    } else {
      passedChecks.push("Login page has no-store cache policy");
    }
  }

  let score = 100;
  for (const i of issues) {
    if (i.severity === "critical") score -= 20;
    else if (i.severity === "medium") score -= 8;
    else score -= 3;
  }
  score = Math.max(0, Math.min(100, score));

  return { moduleName: "forms", issues, passedChecks, score, data };
}
