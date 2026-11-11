import { Tooltip } from "@ryanmeetup/ui";
import type { Category } from "@/lib/resources/resource-types";

export function TaskCategoryBadge({
  category,
  tags = [],
}: {
  category: Category;
  tags?: string[];
}) {
  const tagSummary = tags.length > 0 ? tags.join(", ") : null;

  const badge = (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-black/70 sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[10px] sm:tracking-caps-tight dark:text-white/75"
      aria-label={`${category.name} category; ${tagSummary ? `tags: ${tagSummary}` : "no tags selected"}`}
      style={{
        borderColor: `${category.color}66`,
        backgroundColor: `${category.color}22`,
      }}
    >
      <i
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: category.color }}
      />
      <span aria-hidden="true">{category.name}</span>
    </span>
  );

  return (
    <Tooltip
      content={
        <span className="block max-w-56">
          <span className="block text-[10px] font-semibold uppercase tracking-caps-tight opacity-65">
            Tags
          </span>
          <span className="mt-1 block font-medium">
            {tagSummary ?? "No tags selected"}
          </span>
        </span>
      }
    >
      {badge}
    </Tooltip>
  );
}
