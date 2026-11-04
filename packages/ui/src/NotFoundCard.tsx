import Link from "next/link";
import type { ReactNode } from "react";
import { FiArrowRight, FiHome } from "react-icons/fi";
import { Button } from "./Button";
import { Card } from "./Card";
import { Heading } from "./Heading";
import { Kicker } from "./Kicker";
import { Pill } from "./Pill";
import { Text } from "./Text";

export type NotFoundLink = {
  href: string;
  label: string;
};

export type NotFoundCardProps = {
  title: ReactNode;
  description: ReactNode;
  primaryAction: NotFoundLink;
  secondaryAction?: NotFoundLink;
  helpText?: ReactNode;
  helpLink?: NotFoundLink;
  className?: string;
};

/** App-owned copy and destinations with the shared Ryan name-tag treatment. */
export function NotFoundCard({
  title,
  description,
  primaryAction,
  secondaryAction,
  helpText,
  helpLink,
  className,
}: NotFoundCardProps) {
  return (
    <Card size="none" className={`mx-auto w-full max-w-6xl overflow-hidden !rounded-3xl ${className ?? ""}`}>
      <div className="grid items-center gap-10 px-6 py-10 sm:gap-12 sm:p-12 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] xl:gap-16 xl:p-14">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <Pill variant="code">404</Pill>
            <Kicker>Page not found</Kicker>
          </div>
          <Heading size="h1" className="mt-4 text-4xl leading-[1.05] sm:text-5xl 2xl:text-6xl">
            {title}
          </Heading>
          <Text className="mt-5 max-w-md text-lg">{description}</Text>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button.Link
              href={primaryAction.href}
              size="md"
              rightIcon={<FiArrowRight aria-hidden />}
              className="!w-full sm:!w-auto"
            >
              {primaryAction.label}
            </Button.Link>
            {secondaryAction && (
              <Button.Link
                href={secondaryAction.href}
                variant="secondary"
                size="md"
                leftIcon={<FiHome aria-hidden />}
                className="!w-full sm:!w-auto"
              >
                {secondaryAction.label}
              </Button.Link>
            )}
          </div>
        </div>

        <div aria-hidden="true" className="pointer-events-none mx-auto w-full max-w-xs px-3 py-4 sm:max-w-sm xl:px-0">
          <div className="-rotate-6 overflow-hidden rounded-2xl border-4 border-nametag bg-nametag text-center shadow-xl">
            <div className="pb-3 pt-4 text-white">
              <span className="block text-4xl font-bold leading-none tracking-[0.15em] sm:text-5xl">HELLO</span>
              <span className="mt-1 block text-sm font-semibold tracking-[0.15em]">MY NAME IS</span>
            </div>
            <div className="bg-white px-4 py-5 font-cooper text-8xl leading-none tracking-wider text-black sm:py-6 sm:text-9xl">404</div>
            <div className="h-5" />
          </div>
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
