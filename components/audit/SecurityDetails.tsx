export function SecurityDetails({ data }: { data: Record<string, unknown> | null }) {
  if (typeof data?.error === "string") {
    return <p className="text-sm text-danger">{data.error}</p>;
  }

  const tests = data?.tests as Record<string, { pass?: boolean; value?: string | null }> | undefined;
  const https = data?.https as boolean | undefined;
  const mixedContent = data?.mixedContent as number | undefined;
  const secureCookies = data?.secureCookies as boolean | undefined;
  const httpOnlyCookies = data?.httpOnlyCookies as boolean | undefined;

  return (
    <div className="space-y-5">
      {/* Protocol & Cookie summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="border border-black/10 p-4 text-sm">
          <p className="text-xs uppercase tracking-[0.14em] text-foreground/55">Protocol</p>
          <p className="mt-1 font-semibold uppercase">{https ? "HTTPS" : "HTTP"}</p>
        </div>
        <div className="border border-black/10 p-4 text-sm">
          <p className="text-xs uppercase tracking-[0.14em] text-foreground/55">Secure Cookies</p>
          <p className="mt-1 font-semibold uppercase">{secureCookies ? "Yes" : "No"}</p>
        </div>
        <div className="border border-black/10 p-4 text-sm">
          <p className="text-xs uppercase tracking-[0.14em] text-foreground/55">Mixed Content</p>
          <p className="mt-1 font-semibold uppercase">{mixedContent === 0 ? "None" : `${mixedContent} resource(s)`}</p>
        </div>
      </div>

      {/* Header checks grid */}
      <div className="grid gap-3 md:grid-cols-2">
        {Object.entries(tests ?? {}).map(([name, result]) => (
          <div key={name} className="border border-black/10 p-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span>{name}</span>
              <span
                className={`uppercase tracking-[0.14em] ${result.pass ? "text-emerald-600" : "text-red-500"}`}
              >
                {result.pass ? "Pass" : "Fail"}
              </span>
            </div>
            {result.value ? (
              <p className="mt-2 truncate text-xs text-foreground/50" title={result.value}>
                {result.value}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
