import { Button } from "@ryanmeetup/ui";
import { FiArrowRight } from "react-icons/fi";
import type { CollectionSummary } from "@/lib/types";

export function CollectionLink({
  collection,
  total,
}: {
  collection: Pick<CollectionSummary, "handle" | "title">;
  total?: number;
}) {
  const label = total === undefined
    ? "Shop collection"
    : `Shop all ${total} item${total === 1 ? "" : "s"}`;

  return (
    <Button.Link
      href={`/collections/${collection.handle}`}
      aria-label={`${label}: ${collection.title}`}
      variant="ghost"
      size="md"
      className="min-h-11 !w-full !px-0 !normal-case !tracking-normal underline-offset-4 hover:underline focus-visible:underline focus-visible:!ring-black/40 sm:!w-auto dark:focus-visible:!ring-white/40"
      rightIcon={<FiArrowRight aria-hidden className="h-4 w-4" />}
    >
      {label}
    </Button.Link>
  );
}
