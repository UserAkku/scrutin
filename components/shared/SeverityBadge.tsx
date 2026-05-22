export function SeverityBadge({
  severity
}: {
  severity: string;
}) {
  const normalized =
    severity === "critical" || severity === "medium" || severity === "low"
      ? severity
      : "low";
  const styles = {
    critical: "bg-red-500 text-white border-[3px] border-brutal-black",
    medium: "bg-yellow-400 text-brutal-black border-[3px] border-brutal-black",
    low: "bg-white text-brutal-black border-[3px] border-brutal-black"
  };

  return (
    <span className={`inline-flex items-center border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${styles[normalized]}`}>
      {normalized}
    </span>
  );
}
