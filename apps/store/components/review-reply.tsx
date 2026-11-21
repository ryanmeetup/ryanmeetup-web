import type { PublicReviewReply } from "@ryanmeetup/reviews";
import { ReviewReplyContent } from "@ryanmeetup/reviews/ui";

/** The public response belongs to the store; private staff identities are never displayed. */
export function ReviewReply({ reply }: { reply: PublicReviewReply }) {
  return (
    <ReviewReplyContent official label="Reply from Ryan Meetup" body={reply.body} className="mt-4" metadata={
      <time className="whitespace-nowrap text-xs text-black/70 dark:text-white/70" dateTime={reply.publishedAt}>
          {new Date(reply.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
      </time>
    } />
  );
}
