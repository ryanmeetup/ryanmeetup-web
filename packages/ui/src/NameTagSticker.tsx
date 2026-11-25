import Image from "next/image";
import clsx from "clsx";
import nameTag from "./assets/ryan-name-tag.png";

export type NameTagStickerProps = {
  /** Width and spacing; the sticker keeps its own aspect ratio and tilt. */
  className?: string;
  /** Rendered widths, so the optimizer serves a small file. */
  sizes?: string;
};

/**
 * The photographed "HELLO my name is Ryan" sticker, slapped on at a tilt.
 * Decorative, so it stays out of the accessibility tree. For a tag with
 * custom text, use the drawn `NameTag` instead.
 */
export function NameTagSticker({ className, sizes = "112px" }: NameTagStickerProps) {
  return (
    <Image
      src={nameTag}
      alt=""
      sizes={sizes}
      className={clsx(
        "pointer-events-none h-auto -rotate-6 select-none drop-shadow-lg",
        className,
      )}
    />
  );
}
