"use client";

import clsx from "clsx";
import { Fragment } from "react";
import type { ReactNode } from "react";
import Marquee from "react-fast-marquee";

export type TextMarqueeProps = {
  /** Each phrase in the run, in reading order. */
  items: string[];
  /** Drawn between phrases and after the last, so the loop never runs two together. */
  separator?: ReactNode;
  speed?: number;
  direction?: "left" | "right";
  /** The band itself: background, text color, and vertical padding. */
  className?: string;
  itemClassName?: string;
  /**
   * A purely decorative band (a repeated name, a chant) hides from assistive tech entirely.
   * Otherwise screen readers get the phrases once, as a list, instead of the moving copies.
   */
  decorative?: boolean;
};

/** A full-width band of phrases scrolling on a loop, like a ticker. */
const TextMarquee = ({
  items,
  separator = "·",
  speed = 40,
  direction = "left",
  className,
  itemClassName,
  decorative = false,
}: TextMarqueeProps) => (
  <div className={clsx("overflow-hidden", className)}>
    {!decorative && (
      <ul className="sr-only">
        {/* Phrases may repeat on purpose, and the run never reorders, so position is the identity. */}
        {items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
      </ul>
    )}
    {/* Reduced motion swaps the scroll for the phrases stacked once, so none sit off screen. */}
    <ul aria-hidden className={clsx("hidden flex-col items-center gap-1.5 px-4 text-center leading-tight text-balance motion-reduce:flex", itemClassName)}>
      {items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
    </ul>
    <div className="motion-reduce:hidden">
      <Marquee speed={speed} direction={direction} gradient={false} autoFill pauseOnHover>
        <span aria-hidden className={clsx("flex items-center whitespace-nowrap", itemClassName)}>
          {items.map((item, index) => (
            <Fragment key={`${index}-${item}`}>
              <span>{item}</span>
              <span className="px-[0.75em] opacity-70">{separator}</span>
            </Fragment>
          ))}
        </span>
      </Marquee>
    </div>
  </div>
);

export { TextMarquee };
