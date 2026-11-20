"use client";

import Marquee from "react-fast-marquee";
import { LogoCard } from "./LogoCard";
import type { LogoCardProps, LogoCardVariant } from "./LogoCard";

export type LogoMarqueeItem = Omit<LogoCardProps, "className"> & {
  key?: string;
};
export type LogoMarqueeProps = {
  items: LogoMarqueeItem[];
  speed?: number;
  direction?: "left" | "right";
  itemClassName?: string;
  itemVariant?: LogoCardVariant;
  wrapperClassName?: string;
  /** Repeat the logos until they fill the row, for short lists on wide screens. */
  autoFill?: boolean;
};

const LogoMarquee = ({
  items,
  speed = 50,
  direction = "left",
  itemClassName,
  itemVariant,
  wrapperClassName,
  autoFill = false,
}: LogoMarqueeProps) => (
  <Marquee
    speed={speed}
    gradient={false}
    direction={direction}
    autoFill={autoFill}
    // The library has no reduced-motion option, so pause its scroll track.
    className={`motion-reduce:[&_.rfm-marquee]:[animation-play-state:paused] ${wrapperClassName ?? ""}`}
  >
    {items.map(({ key, ...item }, index) => (
      <div key={key ?? `${item.alt}-${index}`} className="py-4">
        <LogoCard variant={itemVariant} {...item} className={itemClassName} />
      </div>
    ))}
  </Marquee>
);

export { LogoMarquee };
