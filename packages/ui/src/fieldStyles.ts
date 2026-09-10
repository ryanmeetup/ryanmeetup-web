const fieldLabelBaseClasses =
  "inline-flex items-center gap-1 text-sm font-semibold";
const fieldLabelMutedClasses = "text-black dark:text-white";

const getFieldLabelClasses = (muted = true) =>
  `${fieldLabelBaseClasses} ${muted ? fieldLabelMutedClasses : ""}`.trim();

const fieldControlBaseClasses =
  "w-full rounded-lg border border-black/20 bg-white px-4 py-2.5 text-sm text-black shadow-sm transition placeholder:text-black/70 focus:border-black/40 focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/20 dark:bg-white/10 dark:text-white dark:placeholder:text-white/70 dark:focus:border-white/50 dark:focus:ring-white/20";

const fieldSelectButtonClasses =
  "inline-flex w-full items-center justify-between gap-2 rounded-lg border border-black/20 bg-white px-4 py-2.5 text-sm font-semibold text-black shadow-sm transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 dark:focus-visible:ring-white/30";

export {
  fieldControlBaseClasses,
  fieldSelectButtonClasses,
  getFieldLabelClasses,
};
