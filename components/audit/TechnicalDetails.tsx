export function TechnicalDetails({ data }: { data: Record<string, unknown> | null }) {
  if (typeof data?.error === "string") {
    return <p className="text-sm text-danger">{data.error}</p>;
  }
  const items: Array<[string, string]> = [
    ["robots.txt", data?.robotsTxtExists ? "Present" : "Missing"],
    ["sitemap.xml", data?.sitemapExists ? "Present" : "Missing"],
    ["favicon", data?.faviconExists ? "Present" : "Missing"],
    ["Response time", `${String(data?.responseTimeMs ?? 0)} ms`],
    ["Page size", `${String(data?.pageSize ?? 0)} bytes`],
    ["Compression", String(data?.compression ?? "Unknown")]
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="border border-black/10 p-4 text-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">{label}</p>
          <p className="mt-3 font-display text-2xl">{value}</p>
        </div>
      ))}
    </div>
  );
}
