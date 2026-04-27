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
    critical: "bg-danger text-background border-danger",
    medium: "bg-warning text-black border-warning",
    low: "bg-background text-foreground border-black"
  };

  return (
    <span className={`inline-flex items-center border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${styles[normalized]}`}>
      {normalized}
    </span>
  );
}
