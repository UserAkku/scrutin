import type { SecurityModuleResult } from "./types";
import { safeFetchWithTimeout } from "./types";

interface PathEntry {
  path: string;
  severity: "critical" | "medium" | "low";
  label: string;
}

const SENSITIVE_PATHS: PathEntry[] = [
  // Critical
  { path: "/.env",               severity: "critical", label: "Environment variables file" },
  { path: "/.env.local",        severity: "critical", label: "Local environment variables" },
  { path: "/.env.production",   severity: "critical", label: "Production environment variables" },
  { path: "/.env.development",  severity: "critical", label: "Development environment variables" },
  { path: "/.git/config",       severity: "critical", label: "Git repository config" },
  { path: "/.git/HEAD",         severity: "critical", label: "Git HEAD reference" },
  { path: "/wp-config.php",     severity: "critical", label: "WordPress configuration" },
  { path: "/wp-config.php.bak", severity: "critical", label: "WordPress config backup" },
  { path: "/config.php",        severity: "critical", label: "PHP configuration file" },
  { path: "/api/swagger",       severity: "critical", label: "Swagger API docs" },
  { path: "/api/swagger.json",  severity: "critical", label: "Swagger JSON spec" },
  { path: "/swagger.json",      severity: "critical", label: "Swagger JSON spec" },
  { path: "/openapi.json",      severity: "critical", label: "OpenAPI spec" },
  { path: "/graphql",           severity: "critical", label: "GraphQL endpoint" },
  { path: "/api/graphql",       severity: "critical", label: "GraphQL API endpoint" },
  { path: "/phpinfo.php",       severity: "critical", label: "PHP info page" },
  // Medium / High
  { path: "/.DS_Store",         severity: "medium",   label: "macOS metadata file" },
  { path: "/backup.zip",        severity: "medium",   label: "Backup archive" },
  { path: "/backup.tar.gz",     severity: "medium",   label: "Backup archive" },
  { path: "/db.sql",            severity: "critical", label: "Database dump" },
  { path: "/database.sql",      severity: "critical", label: "Database dump" },
  { path: "/dump.sql",          severity: "critical", label: "Database dump" },
  { path: "/server-status",     severity: "medium",   label: "Apache server status" },
  { path: "/package.json",      severity: "medium",   label: "Node.js package manifest" },
  { path: "/composer.json",     severity: "medium",   label: "PHP Composer manifest" },
  { path: "/.htaccess",         severity: "medium",   label: "Apache configuration" },
  { path: "/web.config",        severity: "medium",   label: "IIS configuration" },
  { path: "/.gitignore",        severity: "low",      label: "Git ignore rules" },
  // Admin panels
  { path: "/admin",             severity: "medium",   label: "Admin panel" },
  { path: "/wp-admin",          severity: "medium",   label: "WordPress admin" },
  { path: "/administrator",     severity: "medium",   label: "Admin panel" },
  { path: "/__debug__",         severity: "medium",   label: "Debug panel" },
  { path: "/debug",             severity: "medium",   label: "Debug endpoint" },
  { path: "/console",           severity: "medium",   label: "Console endpoint" },
  { path: "/_profiler",         severity: "medium",   label: "Profiler (Symfony)" },
  { path: "/actuator",          severity: "medium",   label: "Spring Boot actuator" },
  { path: "/actuator/env",      severity: "critical", label: "Actuator env endpoint" },
  { path: "/actuator/health",   severity: "low",      label: "Health check endpoint" },
  // Info
  { path: "/.well-known/security.txt", severity: "low", label: "Security disclosure" },
  { path: "/crossdomain.xml",   severity: "low",      label: "Flash cross-domain policy" },
];

const DIRECTORY_LISTING_PATHS = ["/images/", "/uploads/", "/assets/", "/files/", "/static/"];

export async function runExposureModule(origin: string): Promise<SecurityModuleResult> {
  const issues: SecurityModuleResult["issues"] = [];
  const passedChecks: string[] = [];
  const data: Record<string, unknown> = {};

  const exposedPaths: string[] = [];
  const blockedPaths: string[] = [];

  // Batch paths in groups of 10 for parallel requests
  const batches: PathEntry[][] = [];
  for (let i = 0; i < SENSITIVE_PATHS.length; i += 10) {
    batches.push(SENSITIVE_PATHS.slice(i, i + 10));
  }

  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map(async (entry) => {
        const res = await safeFetchWithTimeout(`${origin}${entry.path}`, { method: "HEAD" }, 5000);
        return { entry, status: res?.status ?? 0, res };
      })
    );

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const { entry, status } = result.value;

      if (status === 200) {
        exposedPaths.push(entry.path);
        issues.push({
          title: `Sensitive file exposed: ${entry.path}`,
          description: `${entry.label} is publicly accessible at ${entry.path}.`,
          fixSuggestion: `Block access to ${entry.path} in your web server configuration. Use deny rules or remove the file from production.`,
          severity: entry.severity,
          impact: `Attackers can access ${entry.label.toLowerCase()} which may contain sensitive data.`,
          effort: "10 minutes"
        });
      } else if (status === 403) {
        blockedPaths.push(entry.path);
        // File exists but blocked — good, but note it
      }
    }
  }

  // Git config deep check
  if (exposedPaths.includes("/.git/config")) {
    try {
      const gitRes = await safeFetchWithTimeout(`${origin}/.git/config`, undefined, 5000);
      if (gitRes && gitRes.ok) {
        const gitText = await gitRes.text();
        const urlMatch = gitText.match(/url\s*=\s*(.+)/);
        if (urlMatch) {
          issues.push({
            title: "Git repository URL exposed",
            description: `The .git/config exposes the remote repository URL: ${urlMatch[1].trim()}`,
            fixSuggestion: "Immediately block access to the .git directory and consider the repository compromised.",
            severity: "critical",
            impact: "Attackers can clone your entire source code repository.",
            effort: "15 minutes"
          });
        }
      }
    } catch {
      // skip
    }
  }

  // OpenAPI/Swagger endpoint analysis
  const swaggerPaths = ["/api/swagger.json", "/swagger.json", "/openapi.json"];
  for (const sp of swaggerPaths) {
    if (exposedPaths.includes(sp)) {
      try {
        const swagRes = await safeFetchWithTimeout(`${origin}${sp}`, undefined, 5000);
        if (swagRes && swagRes.ok) {
          const swagText = await swagRes.text();
          try {
            const spec = JSON.parse(swagText) as { paths?: Record<string, unknown> };
            const endpointCount = spec.paths ? Object.keys(spec.paths).length : 0;
            if (endpointCount > 0) {
              data.swaggerEndpoints = endpointCount;
            }
          } catch {
            // not valid JSON
          }
        }
      } catch {
        // skip
      }
      break;
    }
  }

  // Directory listing detection
  for (const dirPath of DIRECTORY_LISTING_PATHS) {
    try {
      const dirRes = await safeFetchWithTimeout(`${origin}${dirPath}`, undefined, 5000);
      if (dirRes && dirRes.ok) {
        const body = (await dirRes.text()).slice(0, 2000);
        if (body.includes("Index of /") || body.includes("<title>Directory listing") || body.includes("Directory Listing")) {
          issues.push({
            title: `Directory listing enabled: ${dirPath}`,
            description: `The directory ${dirPath} exposes a file listing to anyone on the internet.`,
            fixSuggestion: "Disable directory listing in your web server configuration (e.g., 'Options -Indexes' in Apache).",
            severity: "critical",
            impact: "Attackers can enumerate all files in the directory.",
            effort: "10 minutes"
          });
          break; // one directory listing issue is enough
        }
      }
    } catch {
      // skip
    }
  }

  data.exposedPaths = exposedPaths;
  data.blockedPaths = blockedPaths;

  if (exposedPaths.length === 0) {
    passedChecks.push("No sensitive files exposed");
  }

  let score = 100;
  for (const i of issues) {
    if (i.severity === "critical") score -= 15;
    else if (i.severity === "medium") score -= 8;
    else score -= 3;
  }
  score = Math.max(0, Math.min(100, score));

  return { moduleName: "exposure", issues, passedChecks, score, data };
}
