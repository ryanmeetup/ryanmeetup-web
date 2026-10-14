import Image from "next/image";
import type { ImageProps } from "next/image";

export type ThemedImageProps = ImageProps & {
  /** Shown in dark mode instead of `src`. Omit when one image suits both. */
  darkSrc?: ImageProps["src"];
};

// Swaps by CSS rather than `useTheme()`: the server can't know the theme, so
// picking a src in render ships the wrong image and breaks hydration.
const ThemedImage = ({
  darkSrc,
  className,
  alt,
  ...props
}: ThemedImageProps) => {
  if (!darkSrc) {
    return <Image alt={alt} className={className} {...props} />;
  }

  return (
    <>
      <Image
        alt={alt}
        className={`dark:hidden ${className ?? ""}`}
        {...props}
      />
      <Image
        {...props}
        alt={alt}
        src={darkSrc}
        className={`hidden dark:block ${className ?? ""}`}
      />
    </>
  );
};

export { ThemedImage };
