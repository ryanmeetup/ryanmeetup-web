"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { FiPackage } from "react-icons/fi";
import { getKnownSwatch } from "@/lib/product-colors";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/40";

/**
 * The product thumbnail both My reviews sections lead with. It repeats the
 * title link beside it, so it stays out of the tab order and the a11y tree.
 * An image that fails to load falls back to the same placeholder as a missing one.
 */
export function ReviewItemThumbnail({ href, image }: { href?: string | null; image: { url: string } | null | undefined }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const picture = image && image.url !== failedUrl
    ? <Image src={image.url} alt="" width={112} height={112} sizes="(min-width: 640px) 112px, 80px" className="size-20 rounded-lg object-cover sm:size-28" onError={() => setFailedUrl(image.url)} />
    : <span className="flex size-20 items-center justify-center rounded-lg bg-black/5 sm:size-28 dark:bg-white/10"><FiPackage className="size-5 text-black/60 dark:text-white/60" /></span>;
  return href
    ? <Link href={href} className={`shrink-0 rounded-lg ${focusRing}`} tabIndex={-1} aria-hidden>{picture}</Link>
    : <span className="shrink-0" aria-hidden>{picture}</span>;
}

/** The product title, linked to its page when it's still on the storefront. */
export function ReviewItemTitle({ href, children }: { href?: string | null; children: ReactNode }) {
  return href ? <Link href={href} className={`rounded-sm hover:underline ${focusRing}`}>{children}</Link> : <>{children}</>;
}

export type ReviewItemRow = { label: string; value: ReactNode };

/** Variant options and order facts, one labelled line each. */
export function ReviewItemDetails({ rows }: { rows: ReviewItemRow[] }) {
  if (!rows.length) return null;
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-xs font-semibold uppercase tracking-caps-tight text-black/60 dark:text-white/60">{row.label}</dt>
          <dd className="min-w-0 text-sm text-black/80 wrap-anywhere dark:text-white/80">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A variant option's value: colours get a swatch dot, sizes read as code. */
function OptionValue({ name, value }: { name: string | null; value: string }) {
  if (name && /^colou?r$/i.test(name.trim())) {
    const swatch = getKnownSwatch(value);
    return (
      <span className="inline-flex items-center gap-1.5">
        {swatch && <span aria-hidden style={{ backgroundColor: swatch }} className="size-3 shrink-0 rounded-full border border-black/20 dark:border-white/40" />}
        {value}
      </span>
    );
  }
  return name && /^size$/i.test(name.trim()) ? <span className="font-mono">{value}</span> : <>{value}</>;
}

/** One labelled row per variant option, as both My Reviews sections list them. */
export function variantRows(options: { name: string | null; value: string }[]): ReviewItemRow[] {
  return options.map((option) => ({ label: option.name ?? "Variant", value: <OptionValue {...option} /> }));
}

export const reviewItemDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
