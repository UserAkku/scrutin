export function HowItWorks() {
  return (
    <section className="bg-[var(--bg)] text-brutal-black py-20 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 md:px-8 relative z-10">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.22em] text-brutal-black/70 font-body font-bold">Process</p>
          <h2 className="mt-3 font-display text-4xl uppercase leading-tight sm:text-5xl md:text-6xl text-brutal-black">How It Works</h2>
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {[
            ["01", "Enter URL", "Paste any live website URL. Guest mode runs a partial audit instantly.", "bg-[var(--pastel-blue)]"],
            ["02", "We Analyze", "All analyzers run in parallel with streamed progress and saved results.", "bg-[var(--pastel-pink)]"],
            ["03", "Get Report", "Review grades, quick wins, technical findings, and export a client-ready PDF.", "bg-[var(--pastel-green)]"]
          ].map(([index, title, body, color]) => (
            <div key={index} className={`brutal-card text-brutal-black p-8 relative ${color}`}>
              <div className={`absolute -top-5 -left-5 w-14 h-14 rounded-full border-2 border-brutal-black bg-white flex items-center justify-center font-display text-2xl z-10`}>
                {index}
              </div>
              <h3 className="mt-4 font-display text-3xl uppercase">{title}</h3>
              <p className="mt-3 font-body text-base font-bold leading-7 text-brutal-black/80">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
