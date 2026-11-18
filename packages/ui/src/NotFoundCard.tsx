import Link from "next/link";
import type { ReactNode } from "react";
import { FiArrowRight, FiHome } from "react-icons/fi";
import { Button } from "./Button";
import { Card } from "./Card";
import { Heading } from "./Heading";
import { Kicker } from "./Kicker";
import { NameTag } from "./NameTag";
import { Pill } from "./Pill";
import { Text } from "./Text";

export type NotFoundLink = {
  href: string;
  label: string;
};

/** A card action: a link, or a button for something like retrying. */
export type NotFoundAction = (NotFoundLink | { label: string; onClick: () => void }) & {
  /** Replaces the default arrow (primary) or home (secondary) icon. */
  icon?: ReactNode;
};

export type NotFoundCardProps = {
  title: ReactNode;
  description: ReactNode;
  primaryAction: NotFoundAction;
  secondaryAction?: NotFoundAction;
  helpText?: ReactNode;
  helpLink?: NotFoundLink;
  /** The badge beside the label. Defaults to "404". */
  code?: ReactNode;
  /** The label beside the badge. Defaults to "Page not found". */
  kicker?: ReactNode;
  /** What's written on the name tag; keep it about four characters. Defaults to "404". */
  tagName?: ReactNode;
  className?: string;
};

function CardAction({ action, primary }: { action: NotFoundAction; primary: boolean }) {
  const shared = {
    size: "md" as const,
    variant: primary ? ("primary" as const) : ("secondary" as const),
    className: "!w-full sm:!w-auto",
    ...(primary
      ? { rightIcon: action.icon ?? <FiArrowRight aria-hidden /> }
      : { leftIcon: action.icon ?? <FiHome aria-hidden /> }),
  };
  return "href" in action ? (
    <Button.Link href={action.href} {...shared}>
      {action.label}
    </Button.Link>
  ) : (
    <Button type="button" onClick={action.onClick} {...shared}>
      {action.label}
    </Button>
  );
}

/**
 * App-owned copy and destinations with the shared Ryan name-tag treatment.
 * Error pages reuse it by overriding the badge, label, and tag.
 */
export function NotFoundCard({
  title,
  description,
  primaryAction,
  secondaryAction,
  helpText,
  helpLink,
  code = "404",
  kicker = "Page not found",
  tagName = "404",
  className,
}: NotFoundCardProps) {
  return (
    <Card size="none" className={`mx-auto w-full max-w-6xl overflow-hidden !rounded-3xl ${className ?? ""}`}>
      <div className="grid items-center gap-10 px-6 py-10 sm:gap-12 sm:p-12 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] xl:gap-16 xl:p-14">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <Pill variant="code">{code}</Pill>
            <Kicker>{kicker}</Kicker>
          </div>
          <Heading size="h1" className="mt-4 text-4xl leading-[1.05] sm:text-5xl 2xl:text-6xl">
            {title}
          </Heading>
          <Text className="mt-5 max-w-md text-lg">{description}</Text>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <CardAction action={primaryAction} primary />
            {secondaryAction && <CardAction action={secondaryAction} primary={false} />}
          </div>
        </div>

        <div className="mx-auto w-full max-w-xs px-3 py-4 sm:max-w-sm xl:px-0">
          <NameTag name={tagName} />
        </div>
      </div>

      {(helpText || helpLink) && (
        <div className="border-t border-black/10 px-6 py-5 sm:px-12 xl:px-14 dark:border-white/10">
          <Text className="text-sm">
            {helpText ?? "Still need a hand?"}
            {helpLink && <>{" "}
              <Link href={helpLink.href} className="rounded-sm font-semibold text-black underline decoration-black/30 underline-offset-4 hover:decoration-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 dark:text-white dark:decoration-white/30 dark:hover:decoration-white dark:focus-visible:ring-white/40">
                {helpLink.label}
              </Link>.
            </>}
          </Text>
        </div>
      )}
    </Card>
  );
}
