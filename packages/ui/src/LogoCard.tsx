import Link from "next/link";
import { ThemedImage } from "./ThemedImage";

export type LogoCardVariant = "card" | "plain";

export type LogoCardProps = {
  src: string;
  /** Shown in dark mode instead of `src`. */
  darkSrc?: string;
  alt: string;
  href: string;
  className?: string;
  imageClassName?: string;
  variant?: LogoCardVariant;
  width?: number;
  height?: number;
  sizes?: string;
};

const variantStyles: Record<LogoCardVariant, string> = {
  card: "rounded-2xl border border-black/10 bg-white hover:-translate-y-1 hover:border-black/30 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/30 dark:hover:bg-white/10",
  plain: "hover:scale-105",
};

const LogoCard = ({
  src,
  darkSrc,
  alt,
  href,
  className,
  imageClassName,
  variant = "card",
  width = 360,
  height = 180,
  sizes = "(max-width: 640px) 200px, 360px",
}: LogoCardProps) => (
  <Link
    href={href}
    className={`group flex items-center justify-center transition ${variantStyles[variant]} ${className ?? ""}`}
  >
    <ThemedImage
      src={src}
      darkSrc={darkSrc}
      alt={alt}
      width={width}
      height={height}
      className={`w-auto object-contain ${imageClassName ?? ""}`}
      sizes={sizes}
    />
  </Link>
);

export { LogoCard };
