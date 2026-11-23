import { Button, Heading, Text } from "@ryanmeetup/ui";
import { FiLogIn } from "react-icons/fi";
import { reviewSignInRel, reviewSignInUrl } from "@/lib/review-sign-in";

/** A signed-out visitor on a private review page: sign in, then come straight back to `returnTo`. */
export function ReviewSignInPrompt({ title, returnTo }: { title: string; returnTo: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/20 p-8 text-center dark:border-white/20 sm:p-10">
      <FiLogIn aria-hidden className="mx-auto size-6 text-black/60 dark:text-white/60" />
      <Heading size="h2" className="mt-3 text-xl">{title}</Heading>
      <Text className="mx-auto mt-2 max-w-md">Use the email you ordered with, and we&apos;ll bring you right back here.</Text>
      <Button.Link href={reviewSignInUrl(returnTo)} rel={reviewSignInRel} prefetch={false} size="md" className="mt-6 w-full sm:w-auto">Sign in</Button.Link>
    </div>
  );
}
