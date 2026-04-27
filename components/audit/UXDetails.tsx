export function UXDetails({ data }: { data: Record<string, unknown> | null }) {
  if (typeof data?.error === "string") {
    return <p className="text-sm text-danger">{data.error}</p>;
  }
  const screenshotUrl = typeof data?.screenshotUrl === "string" ? data.screenshotUrl : "";
  if (!screenshotUrl) {
    return <p className="text-sm text-foreground/60">Screenshot analysis unavailable for this audit.</p>;
  }

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-black/10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={screenshotUrl}
        alt="Captured website screenshot for UX analysis"
        width={1400}
        height={900}
        className="h-auto w-full"
      />
    </div>
  );
}
