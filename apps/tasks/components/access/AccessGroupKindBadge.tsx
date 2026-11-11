import { FiLayers, FiUsers } from "react-icons/fi";

export function AccessGroupKindBadge({ kind }: { kind: "tier" | "team" }) {
  if (kind === "tier") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-violet-500/25 bg-violet-500/10 px-2 py-1 font-sans text-[10px] leading-none font-semibold uppercase tracking-caps-tight text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/15 dark:text-violet-200">
        <FiLayers aria-hidden className="text-xs" />
        Tier
      </span>
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-1 font-sans text-[10px] leading-none font-semibold uppercase tracking-caps-tight text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/15 dark:text-sky-200">
      <FiUsers aria-hidden className="text-xs" />
      Team
    </span>
  );
}
