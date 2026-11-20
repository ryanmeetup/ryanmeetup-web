"use client";

import { Button, Modal, Text } from "@ryanmeetup/ui";
import { reviewSignInRel, reviewSignInUrl, signInExplanation } from "@/lib/review-sign-in";

/**
 * Says what signing in does before the shopper leaves for Shopify. The store
 * can't know which account Shopify remembers on this device until Shopify
 * sends them back, so this explains it rather than naming one.
 */
export function SignInDialog({ open, setOpen, returnTo }: { open: boolean; setOpen: (open: boolean) => void; returnTo: string }) {
  return (
    <Modal
      open={open}
      setIsOpen={setOpen}
      title={signInExplanation.title}
      size="md"
      bodyClassName="space-y-3"
      actions={
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
          <Button type="button" variant="secondary" size="md" className="w-full sm:w-auto" onClick={() => setOpen(false)}>Cancel</Button>
          <Button.Link href={reviewSignInUrl(returnTo)} rel={reviewSignInRel} prefetch={false} size="md" className="w-full sm:w-auto">Continue to Shopify</Button.Link>
        </div>
      }
    >
      <Text>{signInExplanation.body}</Text>
      <Text className="text-sm">{signInExplanation.newHere}</Text>
    </Modal>
  );
}
