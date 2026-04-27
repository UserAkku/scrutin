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
    medium: "bg-warning text-foreground border-warning",
    low: "bg-background text-foreground border-foreground"
  };

  return (
    <span className={`inline-flex items-center border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${styles[normalized]}`}>
      {normalized}
    </span>
  );
}
