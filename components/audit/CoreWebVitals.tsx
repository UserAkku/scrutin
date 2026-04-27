export function CoreWebVitals({ metrics }: { metrics: Array<{ label: string; displayValue: string; rating: string }> }) {
  if (metrics.length === 0) {
    return <p className="text-sm text-foreground/60">Core Web Vitals data not available for this run.</p>;
  }
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {metrics.map((metric) => (
        <div key={metric.label} className="border border-black/10 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">{metric.label}</p>
          <p className="mt-2 font-display text-2xl">{metric.displayValue}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-foreground/55">{metric.rating}</p>
        </div>
      ))}
    </div>
  );
}
