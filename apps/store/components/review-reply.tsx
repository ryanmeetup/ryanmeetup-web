import type { PublicReviewReply } from "@ryanmeetup/reviews";
import { Heading, Text } from "@ryanmeetup/ui";

/** The public response belongs to the store; private staff identities are never displayed. */
export function ReviewReply({ reply }: { reply: PublicReviewReply }) {
  return (
    <section aria-label="Reply from Ryan Meetup" className="mt-4 space-y-2 border-t border-black/10 pt-4 dark:border-white/10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Heading size="h4" variant="normal" className="text-sm font-semibold">Reply from Ryan Meetup</Heading>
        <time className="whitespace-nowrap text-xs text-black/70 dark:text-white/70" dateTime={reply.publishedAt}>
          {new Date(reply.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
        </time>
      </div>
      <Text className="whitespace-pre-wrap text-sm wrap-anywhere">{reply.body}</Text>
    </section>
  );
}
