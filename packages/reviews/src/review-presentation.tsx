import type { ReactNode } from "react";
import { Avatar, Heading, Text } from "@ryanmeetup/ui";
import type { HeadingProps } from "@ryanmeetup/ui";
import { FiUser } from "react-icons/fi";
import { HiMiniCheckBadge } from "react-icons/hi2";
import { ANONYMOUS_REVIEWER_NAME } from "./content";

export type ReviewAuthorProps = {
  name: string;
  label?: string;
  detail?: ReactNode;
  className?: string;
};

export function ReviewAuthor({ name, label, detail, className = "" }: ReviewAuthorProps) {
  return <div className={`flex min-w-0 items-center gap-2 ${className}`}>
    <span aria-hidden className="contents">{/* Anonymous stays neutral so it never reads as a coloured person. */}
    <Avatar colorful muted={name === ANONYMOUS_REVIEWER_NAME} name={name} icon={name === ANONYMOUS_REVIEWER_NAME ? <FiUser /> : undefined} /></span>
    <div className="min-w-0">
      {label && <Text className="text-xs">{label}</Text>}
      {/* The name is the anchor of the byline, so it keeps full contrast; label and detail stay secondary. */}
      <p className="text-sm font-semibold text-black wrap-anywhere dark:text-white">{name}</p>
      {detail && <Text className="text-xs">{detail}</Text>}
    </div>
  </div>;
}

export type ReviewContentProps = {
  title: string | null;
  body: string;
  heading?: HeadingProps["size"];
  variant?: HeadingProps["variant"];
  titleClassName?: string;
  bodyClassName?: string;
  className?: string;
};

/** Review text is always escaped, preserves line breaks, and wraps long words. */
export function ReviewContent({ title, body, heading = "h3", variant = "normal", titleClassName = "text-base font-semibold", bodyClassName = "", className = "space-y-2" }: ReviewContentProps) {
  return <div className={`min-w-0 ${className}`}>
    {title && <Heading size={heading} variant={variant} className={`wrap-anywhere ${titleClassName}`}>{title}</Heading>}
    <Text className={`whitespace-pre-wrap wrap-anywhere ${bodyClassName}`}>{body}</Text>
  </div>;
}

export type ReviewReplyContentProps = {
  label: string;
  body?: string;
  heading?: HeadingProps["size"];
  metadata?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Showcases the reply as Ryan Meetup's own: the RYAN avatar, an Official reply badge, and a tinted panel. */
  official?: boolean;
};

/** The store's profile picture: the RYAN wordmark in Cooper on a white disc, as in the site header. */
export function RyanMeetupAvatar({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`inline-grid size-12 shrink-0 place-items-center rounded-full bg-white font-cooper text-xs leading-none text-black ring-1 ring-black/15 dark:ring-white/25 ${className}`}>RYAN</span>;
}

export function OfficialReplyBadge({ className = "" }: { className?: string }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-black py-0.5 pl-1.5 pr-2 text-xs font-semibold text-white dark:bg-white dark:text-black ${className}`}>
    <HiMiniCheckBadge aria-hidden className="size-4 shrink-0" />Official reply
  </span>;
}

/** Apps supply public attribution or staff-only controls without sharing identities. */
export function ReviewReplyContent({ label, body, heading = "h4", metadata, actions, children, className = "", official = false }: ReviewReplyContentProps) {
  if (official) return <section aria-label={label} className={`space-y-3 rounded-xl border border-black/10 bg-black/5 p-4 dark:border-white/10 dark:bg-white/5 ${className}`}>
    <div className="flex items-start gap-3">
      <RyanMeetupAvatar />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Heading size={heading} variant="normal" className="text-sm font-semibold">{label}</Heading>
          <OfficialReplyBadge />
        </div>
        {metadata}
      </div>
    </div>
    {body !== undefined && <Text className="whitespace-pre-wrap text-sm wrap-anywhere">{body}</Text>}
    {children}
    {/* Below the text, so staff controls never squeeze the byline on narrow cards. */}
    {actions && <div className="flex justify-end">{actions}</div>}
  </section>;
  return <section aria-label={label} className={`space-y-2 border-t border-black/10 pt-4 dark:border-white/10 ${className}`}>
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <Heading size={heading} variant="normal" className="text-sm font-semibold">{label}</Heading>
      {actions ?? metadata}
    </div>
    {body !== undefined && <Text className="whitespace-pre-wrap text-sm wrap-anywhere">{body}</Text>}
    {actions && metadata}
    {children}
  </section>;
}
