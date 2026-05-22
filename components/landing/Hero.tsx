import { AuditInputForm } from "./AuditInputForm";

function NeoBrutalistCard() {
  return (
    <div className="relative w-full max-w-[520px] mx-auto xl:ml-auto xl:mr-0 z-10 font-display">
      <div className="bg-[var(--pastel-blue)] brutal-card p-6 md:p-8 relative mb-6 hover:-translate-y-1 transition-transform">
        <div className="brutal-badge -top-4 -right-4 bg-white text-xl">★</div>
        <p className="font-body text-xl text-brutal-black font-bold mb-4 pr-12">
          Overall Structural Score
        </p>
        <h2 className="text-8xl lg:text-[9rem] leading-none text-brutal-black tracking-tighter">
          98%
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-[var(--pastel-pink)] brutal-card p-6 relative hover:-translate-y-1 transition-transform">
          <div className="brutal-badge -top-4 -right-4 bg-white text-sm">✓</div>
          <p className="font-body text-lg font-bold text-brutal-black mb-2 uppercase">Performance</p>
          <h2 className="text-5xl lg:text-6xl text-brutal-black tracking-tighter font-display">92</h2>
        </div>
        
        <div className="bg-[var(--pastel-green)] brutal-card p-6 relative hover:-translate-y-1 transition-transform">
          <div className="brutal-badge -top-4 -right-4 bg-white text-sm">✓</div>
          <p className="font-body text-lg font-bold text-brutal-black mb-2 uppercase">SEO Score</p>
          <h2 className="text-5xl lg:text-6xl text-brutal-black tracking-tighter font-display">96</h2>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-2">
        <h3 className="text-3xl text-brutal-black whitespace-nowrap">Recent Audits</h3>
        <div className="flex-1 h-[4px] bg-brutal-black"></div>
        <div className="w-14 h-14 flex-shrink-0 bg-brutal-black rounded-full shadow-brutal flex items-center justify-center text-4xl text-white font-body cursor-pointer hover:-translate-y-1 hover:shadow-brutal-lg transition-transform">
          +
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[var(--bg)]">
      <div className="mx-auto flex flex-col justify-center max-w-7xl px-4 py-12 md:px-8 md:py-20 lg:min-h-[85vh]">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-12">
          
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border-[3px] border-brutal-black bg-white px-4 py-1.5 font-display text-sm tracking-wider uppercase mb-8 shadow-[2px_2px_0px_0px_#2D2323]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              Professional Website Audit Tool
            </div>
            
            <div className="space-y-6 mb-10">
              <h1 className="text-5xl sm:text-6xl lg:text-[5.5rem] leading-[0.95] text-brutal-black font-display uppercase tracking-tight">
                Destroy Your Website's <br className="hidden sm:block" />
                Hidden Bugs.
              </h1>
            </div>
            
            <AuditInputForm />
          </div>

          <div className="hidden md:block">
            <NeoBrutalistCard />
          </div>
          
        </div>
      </div>
    </section>
  );
}
