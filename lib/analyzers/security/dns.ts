import type { SecurityModuleResult } from "./types";
import { safeFetchWithTimeout } from "./types";

interface DnsAnswer {
  type: number;
  data: string;
}

interface DnsResponse {
  Status?: number;
  Answer?: DnsAnswer[];
}

async function queryDns(name: string, type: string): Promise<string[]> {
  const res = await safeFetchWithTimeout(
    `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
    undefined,
    10000
  );
  if (!res || !res.ok) return [];
  try {
    const body = (await res.json()) as DnsResponse;
    return (body.Answer ?? []).map((a) => a.data?.replace(/^"|"$/g, "") ?? "");
  } catch {
    return [];
  }
}

export async function runDnsModule(hostname: string): Promise<SecurityModuleResult> {
  const issues: SecurityModuleResult["issues"] = [];
  const passedChecks: string[] = [];
  const data: Record<string, unknown> = {};

  // Run DNS queries in parallel
  const [txtRecords, dmarcRecords, caaRecords, mxRecords, dkimDefault, dkimGoogle] = await Promise.all([
    queryDns(hostname, "TXT"),
    queryDns(`_dmarc.${hostname}`, "TXT"),
    queryDns(hostname, "CAA"),
    queryDns(hostname, "MX"),
    queryDns(`default._domainkey.${hostname}`, "TXT"),
    queryDns(`google._domainkey.${hostname}`, "TXT"),
  ]);

  const hasMx = mxRecords.length > 0;

  // SPF check
  const spfRecord = txtRecords.find((r) => r.startsWith("v=spf1"));
  if (!spfRecord) {
    issues.push({
      title: "SPF record missing",
      description: "No SPF TXT record found. Anyone can send emails pretending to be your domain.",
      fixSuggestion: "Add a TXT record like: v=spf1 include:_spf.google.com ~all",
      severity: hasMx ? "critical" : "medium",
      impact: "Email spoofing and phishing attacks are possible.",
      effort: "15 minutes"
    });
  } else if (spfRecord.includes("+all")) {
    issues.push({
      title: "SPF policy is completely open (+all)",
      description: "The SPF record allows any server to send email for your domain.",
      fixSuggestion: "Change +all to -all or ~all to restrict who can send email.",
      severity: "critical",
      impact: "Email spoofing is trivially easy.",
      effort: "10 minutes"
    });
  } else if (spfRecord.includes("~all")) {
    issues.push({
      title: "SPF uses soft-fail (~all)",
      description: "SPF soft-fail means unauthenticated email may still be delivered.",
      fixSuggestion: "Consider changing ~all to -all for strict SPF enforcement.",
      severity: "medium",
      impact: "Some spoofed emails may reach inboxes.",
      effort: "10 minutes"
    });
    passedChecks.push("SPF record present (soft-fail)");
  } else {
    passedChecks.push("SPF record configured");
  }
  data.spf = spfRecord ?? null;

  // DMARC check
  const dmarcRecord = dmarcRecords.find((r) => r.startsWith("v=DMARC1"));
  if (!dmarcRecord) {
    issues.push({
      title: "DMARC record missing",
      description: "No DMARC policy found. Email receivers cannot enforce authentication on your domain.",
      fixSuggestion: "Add a TXT record on _dmarc.yourdomain.com: v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com",
      severity: hasMx ? "critical" : "medium",
      impact: "Phishing emails from your domain will not be blocked.",
      effort: "15 minutes"
    });
  } else if (dmarcRecord.includes("p=none")) {
    issues.push({
      title: "DMARC policy set to none",
      description: "DMARC is in monitoring-only mode and does not enforce email authentication.",
      fixSuggestion: "Upgrade to p=quarantine or p=reject once you've verified legitimate senders.",
      severity: "medium",
      impact: "Spoofed emails are reported but not blocked.",
      effort: "15 minutes"
    });
    passedChecks.push("DMARC record present (monitoring only)");
  } else {
    passedChecks.push("DMARC policy enforced");
  }
  data.dmarc = dmarcRecord ?? null;

  // DKIM check
  const hasDkim = dkimDefault.length > 0 || dkimGoogle.length > 0;
  if (!hasDkim) {
    issues.push({
      title: "DKIM records not found (common selectors)",
      description: "No DKIM records found on default._domainkey or google._domainkey selectors. Note: DKIM may exist on other selectors not checked.",
      fixSuggestion: "Verify DKIM is configured with your email provider. Common selectors vary by provider.",
      severity: "low",
      impact: "Without DKIM, email authentication is incomplete.",
      effort: "30 minutes"
    });
  } else {
    passedChecks.push("DKIM record found");
  }
  data.dkim = hasDkim;

  // CAA check
  if (caaRecords.length === 0) {
    issues.push({
      title: "No CAA records configured",
      description: "Without CAA records, any Certificate Authority can issue an SSL certificate for your domain.",
      fixSuggestion: "Add CAA DNS records specifying which CAs are authorized to issue certificates for your domain.",
      severity: "low",
      impact: "Unauthorized certificates could be issued for your domain.",
      effort: "10 minutes"
    });
  } else {
    passedChecks.push("CAA records configured");
  }
  data.caa = caaRecords.length > 0;

  data.mxRecords = mxRecords.length;

  let score = 100;
  for (const i of issues) {
    if (i.severity === "critical") score -= 20;
    else if (i.severity === "medium") score -= 10;
    else score -= 5;
  }
  score = Math.max(0, Math.min(100, score));

  return { moduleName: "dns", issues, passedChecks, score, data };
}
