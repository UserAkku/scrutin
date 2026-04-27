import { CategoryCard } from "@/components/audit/CategoryCard";

export function CategoryGrid({
  scores,
  counts
}: {
  scores: Record<string, number>;
  counts: Record<string, number>;
}) {
  const labels = [
    ["performance", "Performance"],
    ["seo", "SEO"],
    ["security", "Security"],
    ["ux", "UX / UI"],
    ["accessibility", "Accessibility"],
    ["technical", "Technical"]
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {labels.map(([key, label]) => (
        <CategoryCard
          key={key}
          title={label}
          score={scores[key] ?? 0}
          issueCount={counts[key] ?? 0}
        />
      ))}
    </div>
  );
}
