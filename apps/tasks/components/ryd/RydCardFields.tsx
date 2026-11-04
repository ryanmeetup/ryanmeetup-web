"use client";

import { Button, Input } from "@ryanmeetup/ui";
import { FiAlertTriangle, FiGift } from "react-icons/fi";
import {
  RYD_CARD_LIMITS,
  rydCardProblems,
  type RydCard,
  type RydCardHint,
} from "@/lib/ryd/card";

/** "Location and Ryan since", naming the fields as their labels do. */
function listLabels(labels: string[]) {
  return labels.length < 2
    ? (labels[0] ?? "")
    : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

/**
 * The card as fulfillment will print it. Every line is required to verify;
 * an unfinished card can still be saved. Frozen once fulfillment has it.
 */
export function RydCardFields({
  card,
  hint,
  saved,
  disabled,
  locked,
  onChange,
}: {
  card: RydCard;
  hint: RydCardHint;
  /** False while the lines are still the export's draft. */
  saved: boolean;
  disabled: boolean;
  /** Fulfillment has it: the card is shown, not edited. */
  locked: boolean;
  onChange: (card: RydCard) => void;
}) {
  const problems = rydCardProblems(card);
  const set = (field: keyof RydCard) => (value: string) =>
    onChange({ ...card, [field]: value });
  const suggestion =
    hint.yearSuggestion && !card.ryanSince.trim() ? hint.yearSuggestion : null;

  return (
    <div className="space-y-3">
      {!saved && hint.nameFrom === "billing" && !locked && (
        <p className="flex items-start gap-2 text-sm text-black/70 dark:text-white/70">
          <FiGift aria-hidden className="mt-0.5 shrink-0" />
          The export had no card details, so the name is the buyer&apos;s.
          Change it if this is a gift.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <Input
          label="First name"
          name="card-first-name"
          value={card.firstName}
          maxLength={RYD_CARD_LIMITS.firstName}
          onChange={(event) => set("firstName")(event.target.value)}
          disabled={disabled || locked}
          required
        />
        <Input
          label="Last name"
          name="card-last-name"
          value={card.lastName}
          maxLength={RYD_CARD_LIMITS.lastName}
          onChange={(event) => set("lastName")(event.target.value)}
          disabled={disabled || locked}
          required
        />
      </div>
      <Input
        label="Location"
        name="card-location"
        value={card.location}
        maxLength={RYD_CARD_LIMITS.location}
        placeholder="e.g. Brooklyn, NY"
        onChange={(event) => set("location")(event.target.value)}
        disabled={disabled || locked}
        required
      />
      <Input
        label="Ryan since"
        name="card-ryan-since"
        value={card.ryanSince}
        inputMode="numeric"
        maxLength={4}
        placeholder="Year, e.g. 1999"
        onChange={(event) =>
          set("ryanSince")(event.target.value.replace(/\D/g, ""))
        }
        disabled={disabled || locked}
        required
      />
      {hint.birthday && (
        <p className="text-sm text-black/70 dark:text-white/70">
          Birthday as entered: {hint.birthday}
        </p>
      )}
      {suggestion && !locked && (
        <Button
          type="button"
          size="xs"
          variant="secondary"
          className="w-full sm:w-auto"
          disabled={disabled}
          onClick={() => set("ryanSince")(suggestion)}
        >
          Use {suggestion}
        </Button>
      )}
      {problems.length > 0 && !locked && (
        <p
          role="status"
          className="flex items-start gap-2 text-sm text-black/70 dark:text-white/70"
        >
          <FiAlertTriangle aria-hidden className="mt-0.5 shrink-0" />
          Add {listLabels(problems)} to verify. Every line prints exactly as
          approved.
        </p>
      )}
    </div>
  );
}
