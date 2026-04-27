export function AccessibilityDetails({ data }: { data: Record<string, unknown> | null }) {
  if (typeof data?.error === "string") {
    return <p className="text-sm text-danger">{data.error}</p>;
  }
  const items: Array<[string, unknown]> = [
    ["Images without alt", data?.imagesWithoutAlt],
    ["Unlabeled inputs", data?.unlabeledInputs],
    ["Generic links", data?.genericLinks],
    ["Has lang attribute", data?.hasLang ? "Yes" : "No"],
    ["Has skip link", data?.skipLink ? "Yes" : "No"],
    ["Landmarks", data?.landmarks]
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="border border-border p-4 text-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">{label}</p>
          <p className="mt-2 font-display text-2xl">{String(value ?? "N/A")}</p>
        </div>
      ))}
    </div>
  );
}
