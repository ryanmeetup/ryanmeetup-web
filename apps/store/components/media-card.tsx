import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Card } from "@ryanmeetup/ui";

/**
 * The store's one card shell: a square image above a Cooper title, the whole of it a
 * single link. Product cards and the home page's collection tiles both use it so the
 * two read as the same object.
 */
export function MediaCard({
  href,
  linkProps,
  media,
  badges,
  mediaOverlay,
  kicker,
  title,
  children,
  after,
}: {
  href: string;
  linkProps?: Omit<ComponentProps<typeof Link>, "href" | "className" | "children">;
  /** The image or fallback, filling the square frame. */
  media: ReactNode;
  /** Positioned inside the frame and inside the link. */
  badges?: ReactNode;
  /** Positioned over the frame but outside the link, for controls that must not navigate. */
  mediaOverlay?: ReactNode;
  /** A short read-only label above the title, such as an earned highlight. */
  kicker?: ReactNode;
  title: ReactNode;
  /** Extra body content under the title, still inside the link. */
  children?: ReactNode;
  /** Rendered after the link inside the card, for sibling controls. */
  after?: ReactNode;
}) {
  return (
    <Card size="none" hover className="relative flex h-full flex-col overflow-hidden bg-white/65 dark:bg-white/5">
      <div className="relative flex flex-1 flex-col">
        <Link
          href={href}
          {...linkProps}
          className="group flex flex-1 flex-col rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/40 dark:focus-visible:ring-white/40"
        >
          <div className="relative aspect-square overflow-hidden bg-black/5 dark:bg-white/5">
            {media}
            {badges}
          </div>
          <div className="flex flex-1 flex-col gap-2 p-3 sm:p-5">
            {kicker}
            <h3 className="flex items-center gap-2 font-cooper text-base leading-tight tracking-wide text-black sm:text-xl dark:text-white">{title}</h3>
            {children}
          </div>
        </Link>
        {mediaOverlay && <div className="pointer-events-none absolute inset-x-0 top-0 aspect-square">{mediaOverlay}</div>}
      </div>
      {after}
    </Card>
  );
}
