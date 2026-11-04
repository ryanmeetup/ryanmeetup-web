/** Marks a markdown in words as well as color. A deeper red than the nametag red keeps small white text readable. */
export function SaleBadge({ className = "" }: { className?: string }) {
  return <span className={`inline-flex items-center rounded-full bg-red-700 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white ${className}`}>Sale</span>;
}
