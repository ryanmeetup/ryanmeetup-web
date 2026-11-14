import { Button, Card, Kicker, Text } from "@ryanmeetup/ui";
import type { ReactNode } from "react";

export type PartnershipPerk = {
  /** Short name for the perk. Omit it when the sentence stands on its own. */
  label?: string;
  text: string;
};

export type PartnershipPerksAction = {
  href: string;
  label: string;
  icon?: ReactNode;
};

export type PartnershipPerksProps = {
  perks: PartnershipPerk[];
  /** The label above the perk grid, such as "Sponsor opportunities may include". */
  intro: string;
  /** Secondary link to the full sponsorship details page. */
  details?: PartnershipPerksAction;
  /** Primary call to action, normally the sponsorship contact form. */
  contact: PartnershipPerksAction;
};

const PerkList = ({
  perks,
  className,
}: {
  perks: PartnershipPerk[];
  className: string;
}) => (
  <ul className={className}>
    {perks.map((perk) => (
      <li key={perk.label ?? perk.text}>
        <Card variant="solid" size="sm" className="h-full space-y-1">
          {perk.label && (
            <p className="text-sm font-semibold text-black dark:text-white">
              {perk.label}
            </p>
          )}
          <Text className="text-sm text-black/70 dark:text-white/70">
            {perk.text}
          </Text>
        </Card>
      </li>
    ))}
  </ul>
);

/**
 * What a sponsor can expect, followed by the next steps. Below `sm` the list
 * folds behind a disclosure so the calls to action stay near the top of the
 * page; from `sm` up it is a grid.
 */
const PartnershipPerks = ({
  perks,
  intro,
  details,
  contact,
}: PartnershipPerksProps) => (
  <>
    <div className="sm:hidden">
      <details className="details-reveal group">
        <summary className="mx-auto inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-black/20 bg-white/90 px-4 py-2 text-xs font-semibold text-black/80 shadow-sm transition hover:border-black/40 hover:bg-black/5 dark:border-white/20 dark:bg-white/10 dark:text-white/80 dark:hover:border-white/40 dark:hover:bg-white/10">
          View partnership perks
          <span
            aria-hidden
            className="text-xs leading-none transition-transform duration-200 group-open:rotate-180"
          >
            ▼
          </span>
        </summary>
        <Card variant="soft" size="md" className="mt-4 text-left">
          <PerkList perks={perks} className="grid gap-3" />
        </Card>
      </details>
    </div>

    <Card
      variant="soft"
      size="md"
      className="mx-auto hidden w-full space-y-4 text-left sm:block"
    >
      <Kicker>{intro}</Kicker>
      <PerkList
        perks={perks}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      />
    </Card>

    <div className={`grid gap-3 ${details ? "sm:grid-cols-2" : ""}`}>
      {details && (
        <Button.Link
          href={details.href}
          leftIcon={details.icon}
          variant="secondary"
          size="md"
          fullWidth
          newTab={false}
        >
          {details.label}
        </Button.Link>
      )}
      <Button.Link
        href={contact.href}
        leftIcon={contact.icon}
        variant="primary"
        size="md"
        fullWidth
        newTab={false}
      >
        {contact.label}
      </Button.Link>
    </div>
  </>
);

export { PartnershipPerks };
