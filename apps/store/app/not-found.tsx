import { Button, EmptyState } from "@ryanmeetup/ui";

export default function NotFound() {
  return (
    <main className="store-container min-h-[62vh] py-20">
      <EmptyState className="mx-auto max-w-xl" message="That aisle does not exist in the Ryan General Store." />
      <div className="mx-auto mt-6 max-w-xs"><Button.Link href="/collections/all" size="md" fullWidth>Browse collections</Button.Link></div>
    </main>
  );
}
