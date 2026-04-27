export function HowItWorks() {
  return (
    <section className="border-y border-black/10 bg-black text-background">
      <div className="mx-auto max-w-7xl px-4 py-20 md:px-8">
        <p className="text-xs uppercase tracking-[0.22em] text-background/55">How it works</p>
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {[
            ["01", "Enter URL", "Paste any live website URL. Guest mode runs a partial audit instantly."],
            ["02", "We Analyze", "All analyzers run in parallel with streamed progress and saved results."],
            ["03", "Get Report", "Review grades, quick wins, technical findings, and export a client-ready PDF."]
          ].map(([index, title, body]) => (
            <div key={index} className="border border-white/20 p-6">
              <p className="font-display text-5xl">{index}</p>
              <h3 className="mt-8 font-display text-2xl uppercase">{title}</h3>
              <p className="mt-3 max-w-sm text-sm leading-7 text-background/75">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
