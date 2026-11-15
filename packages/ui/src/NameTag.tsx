import clsx from "clsx";
import type { ReactNode } from "react";

export type NameTagSize = "sm" | "lg";

export type NameTagProps = {
  /** What's written on the tag, e.g. "RYAN" or "404". */
  name: ReactNode;
  size?: NameTagSize;
  className?: string;
};

const sizes: Record<NameTagSize, { tag: string; hello: string; label: string; header: string; name: string; footer: string }> = {
  sm: {
    tag: "grid aspect-[7/4] w-28 grid-rows-[auto_minmax(0,1fr)_auto] rounded-lg border-2 shadow-lg sm:w-36",
    header: "py-0.5",
    hello: "text-sm sm:text-lg",
    label: "text-[0.4rem] leading-none sm:text-[0.5rem]",
    name: "flex items-center justify-center px-2 text-2xl sm:text-3xl",
    footer: "h-1",
  },
  lg: {
    tag: "w-full rounded-2xl border-4 shadow-xl",
    header: "pb-3 pt-4",
    hello: "text-4xl sm:text-5xl",
    label: "mt-1 text-sm",
    name: "px-4 py-5 text-8xl tracking-wider sm:py-6 sm:text-9xl",
    footer: "h-5",
  },
};

/** The decorative "HELLO my name is" sticker. Hidden from assistive tech; put the real text nearby. */
export function NameTag({ name, size = "lg", className }: NameTagProps) {
  const s = sizes[size];
  return (
    <div
      aria-hidden="true"
      className={clsx(
        "pointer-events-none -rotate-6 select-none overflow-hidden border-nametag bg-nametag text-center",
        s.tag,
        className,
      )}
    >
      <div className={clsx("text-white", s.header)}>
        <span className={clsx("block font-bold leading-none tracking-caps-tight", s.hello)}>HELLO</span>
        <span className={clsx("block font-semibold tracking-caps-tight", s.label)}>MY NAME IS</span>
      </div>
      <div className={clsx("bg-white font-cooper leading-none text-black", s.name)}>{name}</div>
      <div className={s.footer} />
    </div>
  );
}
