export function UXDetails({ data }: { data: Record<string, unknown> | null }) {
  if (typeof data?.error === "string") {
    return <p className="font-body font-bold text-red-600">{data.error}</p>;
  }
  
  const desktopBase64 = typeof data?.desktopScreenshotBase64 === "string" && data.desktopScreenshotBase64 ? data.desktopScreenshotBase64 : "";
  const mobileBase64 = typeof data?.mobileScreenshotBase64 === "string" && data.mobileScreenshotBase64 ? data.mobileScreenshotBase64 : "";
  
  if (!desktopBase64 && !mobileBase64) {
    return (
      <div className="brutal-card bg-[var(--pastel-yellow)] p-6 flex items-start gap-4">
        <span className="text-2xl mt-1">⚠️</span>
        <div>
          <h4 className="font-display text-xl uppercase text-brutal-black mb-1">Visual Analysis Unavailable</h4>
          <p className="font-body font-bold text-sm text-brutal-black/80">
            We couldn't capture screenshots for this URL. This usually happens if the site blocks bots (like Cloudflare or free hosting providers) or takes too long to load visually.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-8">
      {desktopBase64 && (
        <div className="brutal-card p-4 bg-white">
          <h3 className="font-display text-xl uppercase mb-4 text-brutal-black border-b-[3px] border-brutal-black pb-2">Desktop View</h3>
          <div className="border-[3px] border-brutal-black overflow-hidden bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${desktopBase64}`}
              alt="Desktop UX Screenshot"
              className="w-full h-auto"
            />
          </div>
        </div>
      )}
      {mobileBase64 && (
        <div className="brutal-card p-4 bg-white">
          <h3 className="font-display text-xl uppercase mb-4 text-brutal-black border-b-[3px] border-brutal-black pb-2">Mobile View</h3>
          <div className="border-[3px] border-brutal-black overflow-hidden bg-gray-100 max-w-[300px] mx-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${mobileBase64}`}
              alt="Mobile UX Screenshot"
              className="w-full h-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}
