import { Button } from "@ryanmeetup/ui";
import { FiArrowRight } from "react-icons/fi";
import type { CollectionSummary } from "@/lib/types";
import { getCollectionPath } from "@/lib/catalog-collections";

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
      href={getCollectionPath(collection.handle)}
      aria-label={`${label}: ${collection.title}`}
      variant="link"
      size="md"
      fullWidth
      className="min-h-11 sm:w-auto"
      rightIcon={<FiArrowRight aria-hidden className="h-4 w-4" />}
    >
      {label}
    </Button.Link>
  );
}
