import type { ReactNode } from "react";

export type AvatarProps = {
  className?: string;
  /**
   * A saturated background picked from the name, with heavier initials. The
   * same name always gets the same colour, so it stays stable across renders.
   */
  colorful?: boolean;
  /**
   * Glyph shown in place of initials when there is no image, for actors that
   * are not people — automation, a system account, an unclaimed seat.
   */
  icon?: ReactNode;
  name?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  src?: string | null;
};

const sizeClasses = {
  xs: "h-4 w-4 text-[7px]",
  sm: "h-6 w-6 text-[9px]",
  md: "h-8 w-8 text-[9px]",
  lg: "h-16 w-16 text-lg",
};

/** Each passes 4.5:1 contrast with white initials. */
const colorfulBackgrounds = ["#b91c1c", "#c2410c", "#a16207", "#15803d", "#0f766e", "#1d4ed8", "#6d28d9", "#be185d"];

/** Colourful initials run a step larger so the heavier weight stays legible. */
const colorfulSizeClasses = {
  xs: "h-4 w-4 text-[8px]",
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-16 w-16 text-xl",
};

function colorFor(name?: string | null) {
  let hash = 0;
  for (const character of name || "?") hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return colorfulBackgrounds[hash % colorfulBackgrounds.length];
}

function initials(name?: string | null) {
  return (name || "?")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const Avatar = ({ className, colorful = false, icon, name, size = "md", src }: AvatarProps) => (
  <span
    aria-label={name || "Teammate"}
    role="img"
    style={src ? { backgroundImage: `url(${JSON.stringify(src)})` } : colorful ? { backgroundColor: colorFor(name) } : undefined}
    className={`inline-grid shrink-0 place-items-center rounded-full border bg-cover bg-center text-white ${colorful
      ? `border-black/10 font-black dark:border-white/15 ${colorfulSizeClasses[size]}`
      : `border-white/30 bg-black font-bold dark:border-black/25 dark:bg-white dark:text-black ${sizeClasses[size]}`} ${className ?? ""}`}
  >
    {!src && <span aria-hidden>{icon ?? initials(name)}</span>}
  </span>
);

export { Avatar };
