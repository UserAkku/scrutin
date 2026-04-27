export function SEODetails({ data }: { data: Record<string, unknown> | null }) {
  if (typeof data?.error === "string") {
    return <p className="text-sm text-danger">{data.error}</p>;
  }
  const keywords = (data?.keywords as Array<{ term: string; density: number }> | undefined) ?? [];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="border border-black/10 p-4 text-sm leading-7">
        <p>Title: {String(data?.title ?? "N/A")}</p>
        <p>Meta description length: {String((data?.metaDescription as string | undefined)?.length ?? 0)}</p>
        <p>Internal links: {String(data?.internalLinks ?? 0)}</p>
        <p>External links: {String(data?.externalLinks ?? 0)}</p>
        <p>Word count: {String(data?.wordCount ?? 0)}</p>
      </div>
      <div className="border border-black/10 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">Top keywords</p>
        <div className="mt-4 space-y-2 text-sm">
          {keywords.map((keyword) => (
            <div key={keyword.term} className="flex items-center justify-between">
              <span>{keyword.term}</span>
              <span>{keyword.density}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
