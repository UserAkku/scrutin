import type { SecurityModuleResult } from "./types";
import { safeFetchWithTimeout } from "./types";

interface SslLabsEndpoint {
  grade?: string;
  hasWarnings?: boolean;
  details?: {
    protocols?: Array<{ name: string; version: string }>;
    cert?: {
      subject?: string;
      issuerLabel?: string;
      notAfter?: number;
      issues?: number;
    };
  };
}

interface SslLabsResponse {
  status?: string;
  endpoints?: SslLabsEndpoint[];
}

async function pollSslLabs(hostname: string): Promise<SslLabsResponse | null> {
  const baseUrl = `https://api.ssllabs.com/api/v3/analyze?host=${encodeURIComponent(hostname)}&publish=off&all=done`;

  // Start new scan or pick up cached result
  const startRes = await safeFetchWithTimeout(`${baseUrl}&startNew=on`, undefined, 15000);
  if (!startRes || !startRes.ok) return null;

  const deadline = Date.now() + 65000;
  let delay = 5000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 15000);

    const pollRes = await safeFetchWithTimeout(baseUrl, undefined, 15000);
    if (!pollRes || !pollRes.ok) continue;

    try {
      const body = (await pollRes.json()) as SslLabsResponse;
      if (body.status === "READY" || body.status === "ERROR") return body;
    } catch {
      continue;
    }
  }
  return null;
}

export async function runTlsModule(url: string, hostname: string, html: string, root: ReturnType<typeof import("node-html-parser").parse>): Promise<SecurityModuleResult> {
  const issues: SecurityModuleResult["issues"] = [];
  const passedChecks: string[] = [];
  const data: Record<string, unknown> = {};

  const isHttps = url.startsWith("https://");
  if (!isHttps) {
    issues.push({
      title: "Site not served over HTTPS",
      description: "The page is served over plain HTTP, exposing all traffic to interception.",
      fixSuggestion: "Obtain a TLS certificate and redirect all HTTP traffic to HTTPS.",
      severity: "critical",
      impact: "All data is transmitted in plaintext.",
      effort: "30 minutes"
    });
  }

  // HTTP→HTTPS redirect check
  try {
    const httpRes = await safeFetchWithTimeout(`http://${hostname}`, { redirect: "manual" }, 10000);
    if (httpRes) {
      const location = httpRes.headers.get("location") ?? "";
      const isRedirect = (httpRes.status === 301 || httpRes.status === 302) && location.startsWith("https://");
      if (isRedirect) {
        passedChecks.push("HTTP→HTTPS redirect");
        data.httpsRedirect = true;
      } else {
        issues.push({
          title: "No HTTP to HTTPS redirect",
          description: "Visiting the HTTP version does not redirect to HTTPS.",
          fixSuggestion: "Configure a 301 redirect from HTTP to HTTPS on your web server or CDN.",
          severity: "medium",
          impact: "Users may unknowingly browse over insecure connections.",
          effort: "15 minutes"
        });
        data.httpsRedirect = false;
      }
    }
  } catch {
    // skip
  }

  // Mixed content detection
  const mixedContent = root
    .querySelectorAll("script[src], link[href], img[src], iframe[src]")
    .filter((el) => {
      const src = el.getAttribute("src") ?? el.getAttribute("href") ?? "";
      return src.startsWith("http://");
    }).length;

  if (mixedContent > 0) {
    issues.push({
      title: "Mixed content detected",
      description: `${mixedContent} resource(s) are loaded over HTTP on an HTTPS page.`,
      fixSuggestion: "Update all resource URLs to use HTTPS or protocol-relative URLs.",
      severity: "medium",
      impact: "Browsers may block insecure resources, breaking page functionality.",
      effort: "15 minutes"
    });
  } else if (isHttps) {
    passedChecks.push("No mixed content");
  }
  data.mixedContent = mixedContent;

  // SSL Labs deep scan
  let sslGrade = "unknown";
  const labsResult = await pollSslLabs(hostname);
  if (labsResult && labsResult.status === "READY" && labsResult.endpoints?.length) {
    const ep = labsResult.endpoints[0];
    sslGrade = ep.grade ?? "unknown";
    data.sslGrade = sslGrade;

    if (sslGrade === "A+" || sslGrade === "A") {
      passedChecks.push(`SSL Labs grade: ${sslGrade}`);
    } else if (sslGrade === "B") {
      issues.push({
        title: `SSL Labs grade: ${sslGrade}`,
        description: "The TLS configuration has minor weaknesses.",
        fixSuggestion: "Disable older cipher suites and enable forward secrecy for all connections.",
        severity: "medium",
        impact: "Some client/server combinations may negotiate weaker encryption.",
        effort: "1 hour"
      });
    } else if (sslGrade) {
      issues.push({
        title: `Poor SSL Labs grade: ${sslGrade}`,
        description: "The TLS configuration is significantly weak.",
        fixSuggestion: "Urgently review your TLS configuration. Disable SSLv3, TLS 1.0, and TLS 1.1. Use strong ciphers only.",
        severity: "critical",
        impact: "Connections are vulnerable to downgrade and decryption attacks.",
        effort: "2 hours"
      });
    }

    // Legacy TLS check
    const protocols = ep.details?.protocols ?? [];
    const legacyTls = protocols.filter(
      (p) => p.name === "TLS" && (p.version === "1.0" || p.version === "1.1")
    );
    if (legacyTls.length > 0) {
      issues.push({
        title: "Legacy TLS versions supported",
        description: `TLS ${legacyTls.map((p) => p.version).join(", ")} still enabled. These are deprecated.`,
        fixSuggestion: "Disable TLS 1.0 and 1.1 on your server, keeping only TLS 1.2 and 1.3.",
        severity: "critical",
        impact: "Legacy protocols have known vulnerabilities (BEAST, POODLE).",
        effort: "30 minutes"
      });
    } else if (protocols.length > 0) {
      passedChecks.push("No legacy TLS versions");
    }
    data.tlsVersions = protocols.map((p) => `${p.name} ${p.version}`);

    // Certificate checks
    const cert = ep.details?.cert;
    if (cert) {
      // Self-signed check
      if (cert.subject && cert.issuerLabel && cert.subject === cert.issuerLabel) {
        issues.push({
          title: "Self-signed certificate detected",
          description: "The TLS certificate is self-signed and will not be trusted by browsers.",
          fixSuggestion: "Obtain a certificate from a trusted CA such as Let's Encrypt (free) or a commercial provider.",
          severity: "critical",
          impact: "Browsers show security warnings, destroying user trust.",
          effort: "30 minutes"
        });
      }

      // Expiry check
      if (cert.notAfter) {
        const daysLeft = Math.round((cert.notAfter - Date.now()) / 86400000);
        data.certExpiry = daysLeft;
        if (daysLeft < 0) {
          issues.push({
            title: "SSL certificate has expired",
            description: `The certificate expired ${Math.abs(daysLeft)} days ago.`,
            fixSuggestion: "Renew your SSL certificate immediately.",
            severity: "critical",
            impact: "Browsers will block access to the site entirely.",
            effort: "30 minutes"
          });
        } else if (daysLeft < 30) {
          issues.push({
            title: "SSL certificate expiring soon",
            description: `The certificate expires in ${daysLeft} days.`,
            fixSuggestion: "Renew your SSL certificate before it expires. Consider enabling auto-renewal.",
            severity: "critical",
            impact: "If not renewed, the site will become inaccessible.",
            effort: "15 minutes"
          });
        } else if (daysLeft < 90) {
          issues.push({
            title: "SSL certificate expiry approaching",
            description: `The certificate expires in ${daysLeft} days.`,
            fixSuggestion: "Schedule SSL certificate renewal. Enable auto-renewal if possible.",
            severity: "medium",
            impact: "Risk of unexpected downtime if renewal is forgotten.",
            effort: "15 minutes"
          });
        } else {
          passedChecks.push("Certificate validity OK");
        }
      }

      if (cert.issues && cert.issues > 0) {
        issues.push({
          title: "Certificate chain issues detected",
          description: `SSL Labs reports ${cert.issues} issue(s) with the certificate chain.`,
          fixSuggestion: "Review the certificate chain and ensure all intermediate certificates are correctly installed.",
          severity: "medium",
          impact: "Some clients may fail to validate the certificate.",
          effort: "30 minutes"
        });
      }
    }

    if (ep.hasWarnings) {
      data.sslWarnings = true;
    }
  } else {
    // Timeout or error
    issues.push({
      title: "SSL deep scan unavailable",
      description: "SSL Labs scan timed out or could not be completed.",
      fixSuggestion: "Check your TLS configuration manually at https://www.ssllabs.com/ssltest/",
      severity: "low",
      impact: "Deep TLS analysis was skipped.",
      effort: "5 minutes"
    });
    data.sslGrade = "unknown";
  }

  // Calculate score
  let score = 100;
  if (!isHttps) score -= 40;
  if (mixedContent > 0) score -= 15;
  if (sslGrade === "B") score -= 10;
  if (sslGrade === "C" || sslGrade === "D" || sslGrade === "F") score -= 30;
  for (const i of issues) {
    if (i.severity === "critical") score -= 10;
    else if (i.severity === "medium") score -= 5;
  }
  score = Math.max(0, Math.min(100, score));

  return { moduleName: "tls", issues, passedChecks, score, data };
}
