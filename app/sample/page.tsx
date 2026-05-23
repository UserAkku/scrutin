"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/shared/button";
import { IssueList } from "@/components/audit/IssueList";

const dummyIssues = {
  performance: [
    { id: "p1", title: "Eliminate render-blocking resources", severity: "critical" as const, description: "Resources are blocking the first paint of your page. 3 scripts and 2 stylesheets are delaying the initial render.", fixSuggestion: "Inline critical JS/CSS and defer non-critical scripts. Consider using async/defer attributes for third-party tags.", impact: "Improves First Contentful Paint by up to 1.2s.", effort: "2-4 hours" },
    { id: "p2", title: "Serve images in next-gen formats", severity: "medium" as const, description: "Image formats like WebP or AVIF provide better compression than PNG or JPEG. Found 12 images that could be optimized.", fixSuggestion: "Convert JPEGs and PNGs to WebP formats using an image CDN or modern bundler plugins.", impact: "Reduces page weight by ~800KB.", effort: "1 hour" },
    { id: "p3", title: "Reduce unused JavaScript", severity: "medium" as const, description: "A significant portion of the loaded JavaScript is never executed during page load.", fixSuggestion: "Implement code splitting, remove dead code, and lazy-load components that are not visible above the fold.", impact: "Speeds up main thread execution time.", effort: "3-5 hours" },
    { id: "p4", title: "Does not use HTTP/2 for all resources", severity: "low" as const, description: "Some resources are being served over HTTP/1.1, preventing multiplexing.", fixSuggestion: "Ensure your CDN and origin server are configured to serve all assets over HTTP/2 or HTTP/3.", impact: "Reduces network latency overhead.", effort: "1 hour" },
    { id: "p5", title: "Properly size images", severity: "medium" as const, description: "Images are being served significantly larger than the size they are rendered on screen.", fixSuggestion: "Use responsive images via <picture> or srcset to deliver appropriately sized images for different devices.", impact: "Reduces unnecessary data transfer and memory usage.", effort: "2 hours" },
    { id: "p6", title: "Minify CSS and JavaScript", severity: "low" as const, description: "CSS and JavaScript files contain unnecessary whitespace, comments, and redundant code.", fixSuggestion: "Enable minification in your build pipeline (e.g., Terser for JS, CSSNano for CSS).", impact: "Slight reduction in file sizes.", effort: "30 minutes" },
    { id: "p7", title: "Enable text compression", severity: "high" as const, description: "Text-based resources are served without compression.", fixSuggestion: "Configure your server to enable Gzip or Brotli compression for HTML, CSS, and JS files.", impact: "Can reduce total transfer size by up to 70%.", effort: "15 minutes" },
    { id: "p8", title: "Avoid enormous network payloads", severity: "medium" as const, description: "Total page weight exceeds 4MB, heavily impacting users on slow connections.", fixSuggestion: "Audit network requests, remove unnecessary libraries, and optimize media content.", impact: "Improves overall load times and reduces bounce rates.", effort: "4-8 hours" },
    { id: "p9", title: "Minimize main-thread work", severity: "critical" as const, description: "The main thread is busy for too long (>4s), causing the page to be unresponsive.", fixSuggestion: "Offload heavy computations to Web Workers, reduce DOM size, and optimize JavaScript execution.", impact: "Greatly improves Time to Interactive (TTI).", effort: "6-10 hours" },
    { id: "p10", title: "Avoid chaining critical requests", severity: "medium" as const, description: "Found 3 chains of critical requests that must be loaded sequentially.", fixSuggestion: "Preload key resources, flatten request chains, and move critical CSS into the <head>.", impact: "Improves initial rendering speed.", effort: "2-3 hours" }
  ],
  seo: [
    { id: "s1", title: "Missing meta description", severity: "critical" as const, description: "Meta descriptions are important for CTR from search results. 4 core pages are missing this tag.", fixSuggestion: "Add a concise, compelling <meta name=\"description\"> tag of 150-160 characters to all indexable pages.", impact: "Directly improves organic click-through rates.", effort: "1 hour" },
    { id: "s2", title: "Images missing alt attributes", severity: "medium" as const, description: "Search engines use alt attributes to understand image context. Found 8 decorative and 2 content images without alt text.", fixSuggestion: "Add descriptive alt attributes to content images. Use empty alt=\"\" for purely decorative images.", impact: "Improves image search ranking and accessibility.", effort: "1-2 hours" },
    { id: "s3", title: "Links do not have descriptive text", severity: "low" as const, description: "Generic link text like 'Click Here' or 'Learn More' provides no context to search engines.", fixSuggestion: "Update anchor text to describe the destination page (e.g., 'Learn more about our pricing').", impact: "Helps distribute topical authority internally.", effort: "1 hour" },
    { id: "s4", title: "Missing XML Sitemap", severity: "high" as const, description: "No sitemap.xml file was detected, making it harder for search engines to crawl all pages.", fixSuggestion: "Generate and submit an XML sitemap to Google Search Console and Bing Webmaster Tools.", impact: "Improves crawlability and indexation of deep pages.", effort: "1-2 hours" },
    { id: "s5", title: "Multiple H1 tags found", severity: "medium" as const, description: "The homepage contains 3 different H1 tags, diluting the main topic signal.", fixSuggestion: "Ensure each page has exactly one H1 tag that accurately describes its main content.", impact: "Clarifies page topic for search algorithms.", effort: "30 minutes" },
    { id: "s6", title: "Canonical tags are missing", severity: "medium" as const, description: "Pages lack rel=\"canonical\" tags, which could lead to duplicate content issues.", fixSuggestion: "Add self-referencing canonical tags to all unique pages to consolidate ranking signals.", impact: "Prevents duplicate content penalties.", effort: "1-2 hours" },
    { id: "s7", title: "Robots.txt is blocking important resources", severity: "critical" as const, description: "Your robots.txt file is disallowing crawling of important CSS and JS files.", fixSuggestion: "Remove the 'Disallow' rules for /assets/ and /static/ directories in robots.txt.", impact: "Allows search engines to render and understand the page correctly.", effort: "10 minutes" },
    { id: "s8", title: "Structured data errors", severity: "low" as const, description: "Schema.org markup contains warnings for missing recommended fields (e.g., priceValidUntil).", fixSuggestion: "Review and update JSON-LD structured data to include all recommended properties.", impact: "Ensures eligibility for rich snippets in search results.", effort: "2 hours" },
  ],
  security: [
    { id: "sec1", title: "Missing Content-Security-Policy", severity: "critical" as const, description: "CSP prevents Cross-Site Scripting (XSS) and data injection attacks by restricting resource origins.", fixSuggestion: "Implement a strict CSP header on your origin server. Start with a report-only policy to monitor breakages.", impact: "Significantly reduces the risk of XSS attacks.", effort: "4-8 hours" },
    { id: "sec2", title: "Cookies missing Secure flag", severity: "medium" as const, description: "Session cookies can be intercepted over unencrypted connections if the Secure flag is missing.", fixSuggestion: "Add the 'Secure' attribute to all sensitive cookies to ensure they are only sent over HTTPS.", impact: "Prevents session hijacking via MITM attacks.", effort: "30 minutes" },
    { id: "sec3", title: "X-Content-Type-Options header missing", severity: "low" as const, description: "Without this header, browsers might perform MIME-type sniffing, leading to execution of untrusted code.", fixSuggestion: "Set the X-Content-Type-Options: nosniff HTTP header on all server responses.", impact: "Prevents MIME-sniffing vulnerabilities.", effort: "15 minutes" },
    { id: "sec4", title: "Server software version exposed", severity: "low" as const, description: "The 'X-Powered-By' or 'Server' headers reveal the exact software version running on the server.", fixSuggestion: "Configure your web server (Nginx, Express, etc.) to hide version signatures in HTTP headers.", impact: "Reduces information disclosure to potential attackers.", effort: "15 minutes" },
    { id: "sec5", title: "Strict-Transport-Security (HSTS) not enforced", severity: "high" as const, description: "The site allows users to access it via HTTP before redirecting to HTTPS.", fixSuggestion: "Implement the Strict-Transport-Security header with an appropriate max-age and includeSubDomains directive.", impact: "Forces secure connections, mitigating downgrade attacks.", effort: "30 minutes" },
    { id: "sec6", title: "Referrer-Policy is too permissive", severity: "low" as const, description: "The default referrer policy might leak sensitive URLs or tokens to third-party sites.", fixSuggestion: "Set the Referrer-Policy header to 'strict-origin-when-cross-origin'.", impact: "Protects user privacy and sensitive URL parameters.", effort: "15 minutes" },
    { id: "sec7", title: "Clickjacking protection missing", severity: "high" as const, description: "The X-Frame-Options or CSP frame-ancestors directive is missing.", fixSuggestion: "Add X-Frame-Options: DENY or SAMEORIGIN to prevent the site from being framed by malicious actors.", impact: "Completely mitigates clickjacking attacks.", effort: "15 minutes" },
    { id: "sec8", title: "Vulnerable JavaScript libraries detected", severity: "critical" as const, description: "jQuery version 1.12.4 is running, which has known XSS vulnerabilities.", fixSuggestion: "Upgrade jQuery to the latest stable version or migrate away from vulnerable legacy libraries.", impact: "Removes known, exploitable security flaws from the frontend.", effort: "2-4 hours" }
  ],
  ux: [
    { id: "ux1", title: "Tap targets are too small", severity: "critical" as const, description: "Interactive elements are too close together, making it difficult for mobile users to tap accurately.", fixSuggestion: "Increase padding on buttons to at least 48x48px and add appropriate margin between clickable elements.", impact: "Reduces user frustration on touch devices.", effort: "2 hours" },
    { id: "ux2", title: "Low contrast text", severity: "medium" as const, description: "Some text elements do not have sufficient contrast against their background (ratio < 4.5:1).", fixSuggestion: "Darken text colors or lighten backgrounds. Use a contrast checker tool to ensure compliance.", impact: "Improves readability for users with visual impairments.", effort: "1-2 hours" },
    { id: "ux3", title: "Missing focus indicators", severity: "medium" as const, description: "Keyboard users cannot see which element is currently focused because outline styles are removed.", fixSuggestion: "Add visible :focus or :focus-visible states to all interactive elements (buttons, links, inputs).", impact: "Crucial for keyboard navigation and accessibility.", effort: "2 hours" },
    { id: "ux4", title: "Form inputs lack autocomplete attributes", severity: "low" as const, description: "Checkout or contact forms require manual typing instead of letting browsers auto-fill information.", fixSuggestion: "Add appropriate autocomplete attributes (e.g., autocomplete=\"email\") to standard input fields.", impact: "Speeds up form completion and reduces drop-offs.", effort: "1 hour" },
    { id: "ux5", title: "Excessive layout shifts (CLS)", severity: "critical" as const, description: "Images and ads load without predefined dimensions, causing the content to jump.", fixSuggestion: "Set explicit width and height attributes on all media elements and reserve space for dynamic content.", impact: "Prevents accidental clicks and improves visual stability.", effort: "2-3 hours" },
    { id: "ux6", title: "No clear Call-to-Action above the fold", severity: "high" as const, description: "Users landing on the page have no obvious primary action to take.", fixSuggestion: "Design a prominent hero section with a clear value proposition and a contrasting CTA button.", impact: "Dramatically increases primary conversion rates.", effort: "4 hours" },
    { id: "ux7", title: "Intrusive interstitials on mobile", severity: "medium" as const, description: "A large newsletter popup covers the main content immediately on page load.", fixSuggestion: "Delay popups, make them smaller (e.g., a banner), or trigger them on exit intent instead of load.", impact: "Improves mobile experience and avoids Google penalties.", effort: "1-2 hours" },
    { id: "ux8", title: "Unclear error messages on forms", severity: "medium" as const, description: "Validation errors say 'Invalid input' without explaining what went wrong.", fixSuggestion: "Provide specific, actionable inline validation messages (e.g., 'Password must contain at least 8 characters').", impact: "Reduces form abandonment.", effort: "2-3 hours" }
  ],
  accessibility: [
    { id: "a1", title: "ARIA roles lack required attributes", severity: "critical" as const, description: "Custom UI components using ARIA roles are missing the states and properties required by screen readers.", fixSuggestion: "Review WAI-ARIA authoring practices. Ensure elements like tabs, modals, and accordions have correct aria-expanded/aria-hidden states.", impact: "Ensures custom widgets are usable by screen readers.", effort: "3-5 hours" },
    { id: "a2", title: "Heading elements are not in sequential order", severity: "medium" as const, description: "The page skips heading levels (e.g., jumping from H1 to H3), confusing screen reader navigation.", fixSuggestion: "Restructure headings to follow a logical, sequential hierarchy without skipping levels.", impact: "Improves logical document outline for assistive tech.", effort: "1 hour" },
    { id: "a3", title: "Document does not have a lang attribute", severity: "medium" as const, description: "The <html> element is missing a lang attribute, preventing screen readers from choosing the right voice.", fixSuggestion: "Add <html lang=\"en\"> (or the appropriate language code) to the root element.", impact: "Fixes pronunciation issues in screen readers.", effort: "10 minutes" },
    { id: "a4", title: "Form controls do not have associated labels", severity: "high" as const, description: "Input fields are using placeholders instead of explicit <label> elements.", fixSuggestion: "Wrap inputs in <label> tags or use the 'for' attribute to connect labels to inputs via their ID.", impact: "Essential for screen readers to announce form fields correctly.", effort: "1-2 hours" },
    { id: "a5", title: "Non-descriptive iframe titles", severity: "low" as const, description: "Embedded YouTube videos and maps lack descriptive title attributes on their iframes.", fixSuggestion: "Add title=\"Description of iframe content\" to all <iframe> tags.", impact: "Helps screen reader users understand embedded content.", effort: "15 minutes" },
    { id: "a6", title: "Links are not distinguishable without color", severity: "medium" as const, description: "In-text links rely solely on color to be distinguished from regular text.", fixSuggestion: "Add an underline or another non-color visual indicator to links within body paragraphs.", impact: "Ensures links are identifiable by color-blind users.", effort: "15 minutes" },
    { id: "a7", title: "No skip-to-content link provided", severity: "medium" as const, description: "Keyboard users must tab through the entire navigation menu on every page to reach the main content.", fixSuggestion: "Add a visually hidden 'Skip to main content' link at the top of the DOM that becomes visible on focus.", impact: "Significantly improves keyboard navigation speed.", effort: "1 hour" },
    { id: "a8", title: "Autoplaying media without controls", severity: "high" as const, description: "A background video plays automatically and cannot be paused.", fixSuggestion: "Provide a visible pause/stop button for any media that plays automatically for more than 5 seconds.", impact: "Prevents severe distraction for users with cognitive disabilities.", effort: "2 hours" }
  ],
  technical: [
    { id: "t1", title: "JavaScript execution errors", severity: "critical" as const, description: "Found 2 uncaught JavaScript errors in the browser console during page load.", fixSuggestion: "Debug the failing scripts. Ensure third-party integrations are wrapped in try/catch blocks.", impact: "Prevents critical UI components from breaking.", effort: "2-4 hours" },
    { id: "t2", title: "Deprecated APIs in use", severity: "medium" as const, description: "The site uses Web APIs that are scheduled for deprecation in modern browsers.", fixSuggestion: "Update legacy code to use modern standard APIs (e.g., replacing document.execCommand with the Clipboard API).", impact: "Future-proofs the application against browser updates.", effort: "2-3 hours" },
    { id: "t3", title: "Console contains mixed content warnings", severity: "low" as const, description: "The page is loaded over HTTPS, but requests some assets over insecure HTTP.", fixSuggestion: "Update all hardcoded 'http://' URLs in your source code or database to use 'https://'.", impact: "Prevents browsers from blocking insecure assets.", effort: "1 hour" },
    { id: "t4", title: "Unoptimized web fonts", severity: "medium" as const, description: "Custom fonts are blocking the text render, causing the 'Flash of Invisible Text' (FOIT).", fixSuggestion: "Add font-display: swap to your @font-face declarations.", impact: "Ensures text remains visible during font loading.", effort: "10 minutes" },
    { id: "t5", title: "Excessive DOM size", severity: "high" as const, description: "The document contains over 2,500 elements, which slows down styling and layout calculations.", fixSuggestion: "Refactor complex UI components, use virtualization for long lists, and remove hidden/unused elements.", impact: "Improves overall rendering and interaction performance.", effort: "4-8 hours" },
    { id: "t6", title: "Missing apple-touch-icon", severity: "low" as const, description: "No specific icon is defined for iOS users saving the website to their home screen.", fixSuggestion: "Add a 180x180 PNG apple-touch-icon.png to your root directory and link it in the <head>.", impact: "Improves branding on iOS devices.", effort: "15 minutes" },
    { id: "t7", title: "Slow server response time (TTFB)", severity: "critical" as const, description: "The initial HTML document took over 800ms to be returned by the server.", fixSuggestion: "Optimize database queries, implement server-side caching (Redis), or upgrade server infrastructure.", impact: "Directly improves all subsequent loading metrics.", effort: "1-2 days" },
    { id: "t8", title: "Third-party cookies being set without SameSite attribute", severity: "low" as const, description: "Some third-party analytics trackers are setting cookies without explicit SameSite declarations.", fixSuggestion: "Ensure third-party tags are updated. If setting your own cross-origin cookies, use SameSite=None; Secure.", impact: "Prevents cookies from being blocked by modern browser privacy features.", effort: "1 hour" }
  ]
};

type CategoryTab = "performance" | "seo" | "security" | "ux" | "accessibility" | "technical";

const TABS: { id: CategoryTab; label: string; score: number | string; color: string }[] = [
  { id: "performance", label: "Performance", score: 62, color: "var(--pastel-pink)" },
  { id: "seo", label: "SEO", score: 79, color: "var(--pastel-yellow)" },
  { id: "security", label: "Security", score: 45, color: "var(--pastel-green)" },
  { id: "accessibility", label: "A11Y", score: 68, color: "var(--pastel-blue)" },
  { id: "ux", label: "UX / UI", score: 58, color: "var(--pastel-purple)" },
  { id: "technical", label: "Technical", score: 83, color: "var(--pastel-orange)" },
];

export default function SamplePage() {
  const [activeTab, setActiveTab] = useState<CategoryTab>("performance");
  const overallScore = 65;
  const totalIssues = Object.values(dummyIssues).reduce((acc, issues) => acc + issues.length, 0);

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-20">
      <div className="border-b-[3px] border-brutal-black bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[var(--pastel-blue)] border-[3px] border-brutal-black rounded-full flex items-center justify-center font-display text-2xl text-brutal-black">
              S
            </div>
            <div>
              <h1 className="text-3xl font-display uppercase truncate max-w-[300px] sm:max-w-[500px] text-brutal-black">
                Sample Report
              </h1>
              <p className="font-body text-sm font-bold text-brutal-black/70">
                Reference Audit Snapshot
              </p>
            </div>
          </div>
          <div>
            <Link href="/signup">
              <Button>Run Your Own Audit</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-8 sm:mt-12 space-y-8 sm:space-y-12">
        {/* Hero Score Section */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6 sm:gap-8">
          <div className="brutal-card p-6 sm:p-8 bg-[var(--pastel-blue)] relative min-h-[250px] sm:min-h-[300px] flex flex-col justify-center">
            <div className="brutal-badge -top-4 -right-4 bg-white text-xl w-12 h-12">★</div>
            <p className="font-body text-lg sm:text-xl font-bold text-brutal-black mb-4">Overall Structural Score</p>
            <h2 className="text-[5rem] sm:text-[8rem] leading-none font-display text-brutal-black">{overallScore}%</h2>
            <p className="font-body font-bold text-brutal-black/70 mt-4">Based on {totalIssues} total issues found.</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {TABS.map((tab, i) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`brutal-card p-4 sm:p-6 relative flex flex-col items-start transition-all hover:-translate-y-2 focus:outline-none outline-none ${
                  activeTab === tab.id ? "-translate-y-1" : ""
                }`}
                style={{ backgroundColor: tab.color }}
              >
                <div className="brutal-badge -top-3 -right-3 bg-white w-6 h-6 sm:w-8 sm:h-8 text-xs sm:text-sm">0{i + 1}</div>
                <div className="flex w-full items-center justify-between mb-2 sm:mb-4">
                  <span className="font-body font-bold text-xs sm:text-sm uppercase tracking-wider text-brutal-black break-all sm:break-normal text-left">
                    {tab.label}
                  </span>
                </div>
                <h3 className="text-4xl sm:text-6xl font-display text-brutal-black">{tab.score}</h3>
                <p className="mt-2 sm:mt-4 font-sans font-bold text-[10px] sm:text-xs text-brutal-black/70 uppercase tracking-widest text-left">
                  {dummyIssues[tab.id]?.length || 0} issues
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Category Deep Dive */}
        <div id="details" className="brutal-card p-8 bg-white min-h-[500px] relative">
          
          {/* Tabs Navigation */}
          <div className="flex flex-wrap gap-4 mb-10 pb-6 border-b-[3px] border-brutal-black">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-2 border-[3px] border-brutal-black rounded-full font-display uppercase tracking-widest text-lg transition-transform ${
                  activeTab === tab.id
                    ? "bg-brutal-black text-white -translate-y-1"
                    : "bg-white text-brutal-black hover:-translate-y-1"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Active Tab Content */}
          <div className="relative">
            <div className="space-y-10 relative">
              {dummyIssues[activeTab] && dummyIssues[activeTab].length > 0 ? (
                <IssueList issues={dummyIssues[activeTab]} />
              ) : (
                <p className="font-body font-bold text-brutal-black/70">No issues for this category.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}