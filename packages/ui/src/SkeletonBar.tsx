/**
 * A pulsing stand-in for text or an avatar while its data loads. Size comes
 * from `className`; the corner shape is a prop rather than a class so a
 * `rounded-full` never has to out-order the default `rounded` in the CSS.
 */
export function SkeletonBar({
  className = "",
  round = false,
}: {
  className?: string;
  round?: boolean;
}) {
  return (
    <span
      className={`block animate-pulse bg-black/10 motion-reduce:animate-none dark:bg-white/10 ${round ? "rounded-full" : "rounded"} ${className}`}
    />
  );
}
