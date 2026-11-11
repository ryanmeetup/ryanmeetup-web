const statusLabels: Record<string, string> = {
  bounced: "Bounced",
  canceled: "Canceled",
  clicked: "Clicked",
  complained: "Complained",
  delivered: "Delivered",
  delivery_delayed: "Delayed",
  failed: "Failed",
  opened: "Opened",
  queued: "Queued",
  scheduled: "Scheduled",
  sent: "Sent",
  suppressed: "Suppressed",
};

const statusStyles: Record<string, string> = {
  bounced:
    "border-red-500/30 bg-red-500/10 text-red-800 dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-200",
  canceled:
    "border-slate-500/25 bg-slate-500/10 text-slate-700 dark:border-slate-400/25 dark:bg-slate-400/10 dark:text-slate-200",
  clicked:
    "border-violet-500/30 bg-violet-500/10 text-violet-800 dark:border-violet-400/30 dark:bg-violet-500/15 dark:text-violet-200",
  complained:
    "border-red-500/30 bg-red-500/10 text-red-800 dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-200",
  delivered:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200",
  delivery_delayed:
    "border-amber-500/35 bg-amber-500/15 text-amber-900 dark:border-amber-400/35 dark:bg-amber-500/15 dark:text-amber-100",
  failed:
    "border-red-500/30 bg-red-500/10 text-red-800 dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-200",
  opened:
    "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-200",
  queued:
    "border-blue-500/30 bg-blue-500/10 text-blue-800 dark:border-blue-400/30 dark:bg-blue-500/15 dark:text-blue-200",
  scheduled:
    "border-blue-500/30 bg-blue-500/10 text-blue-800 dark:border-blue-400/30 dark:bg-blue-500/15 dark:text-blue-200",
  sent: "border-blue-500/30 bg-blue-500/10 text-blue-800 dark:border-blue-400/30 dark:bg-blue-500/15 dark:text-blue-200",
  suppressed:
    "border-slate-500/25 bg-slate-500/10 text-slate-700 dark:border-slate-400/25 dark:bg-slate-400/10 dark:text-slate-200",
};

const fallbackStyle =
  "border-black/15 bg-black/[0.05] text-black/70 dark:border-white/15 dark:bg-white/10 dark:text-white/70";

export const emailStatusLabel = (status: string) =>
  statusLabels[status] ?? status.replaceAll("_", " ");

export function EmailStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-caps-tight ${statusStyles[status] ?? fallbackStyle}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {emailStatusLabel(status)}
    </span>
  );
}
