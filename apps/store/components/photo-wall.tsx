"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export type WallPhoto = {
  src: string;
  alt: string;
  /** CSS object-position for the photo's focal point, e.g. "50% 40%". */
  objectPosition?: string;
};

export type WallTile = {
  /** Shown in order; the first is what loads with the page. */
  photos: WallPhoto[];
  /** Grid placement for the tile, phone first. */
  className: string;
  sizes: string;
};

// One tile changes at a time, round-robin, so the wall shifts gently instead of all at once.
const STEP_MS = 2500;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A grid of photo tiles that each crossfade through their own photos. Pointing at or
 * focusing inside the wall (including whatever sits over it) pauses it, and reduced motion
 * keeps every tile on its first photo.
 */
export function PhotoWall({ tiles, className, wrapperClassName, children }: { tiles: WallTile[]; className?: string; wrapperClassName?: string; children?: ReactNode }) {
  const [active, setActive] = useState(() => tiles.map(() => 0));
  // How far each tile has got, so later photos load just before they're needed, not with the page.
  const [reached, setReached] = useState(() => tiles.map(() => 0));
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const cycling = tiles.flatMap((tile, index) => (tile.photos.length > 1 ? [index] : []));
    if (!cycling.length || paused || prefersReducedMotion()) return undefined;
    let turn = 0;
    const timer = window.setInterval(() => {
      const tile = cycling[turn % cycling.length];
      turn += 1;
      setActive((current) => current.map((photo, index) => (index === tile ? (photo + 1) % tiles[index].photos.length : photo)));
      setReached((current) => current.map((count, index) => (index === tile ? Math.min(count + 1, tiles[index].photos.length - 1) : count)));
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [tiles, paused]);

  return (
    <div
      className={`relative ${wrapperClassName ?? ""}`}
      // Only a real mouse pauses on hover: a tap fires an enter with no leave, which would stop
      // the wall for good on a phone.
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setPaused(true); }}
      onPointerLeave={(event) => { if (event.pointerType === "mouse") setPaused(false); }}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <div className={className}>
        {tiles.map(({ photos, className: tileClassName, sizes }, tileIndex) => (
          <div key={photos[0].src} className={`relative overflow-hidden ${tileClassName}`}>
            {photos.map(({ src, alt, objectPosition }, photoIndex) => {
              // Mount the photo on screen and the one after it, so the next fade has something loaded.
              if (photoIndex > reached[tileIndex] + 1) return null;
              const shown = photoIndex === active[tileIndex];
              return (
                <Image
                  key={src}
                  src={src}
                  alt={shown ? alt : ""}
                  aria-hidden={!shown || undefined}
                  fill
                  sizes={sizes}
                  preload={tileIndex === 0 && photoIndex === 0}
                  className={`object-cover transition-opacity duration-1000 motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`}
                  style={objectPosition ? { objectPosition } : undefined}
                />
              );
            })}
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}
