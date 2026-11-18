"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Text } from "@ryanmeetup/ui";
import type { ReviewAccount } from "@/lib/custom-review-access";

/** Who is signed in for reviews, with a way out. Visible only to that buyer. */
export function ReviewAccountLine({ account }: { account: ReviewAccount }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const pending = signingOut || refreshing;

  async function signOut() {
    setSigningOut(true);
    setFailed(false);
    try {
      const response = await fetch("/api/reviews/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign-out failed");
      startTransition(() => router.refresh());
    } catch {
      setFailed(true);
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 lg:justify-end">
      <Text className="min-w-0 text-sm wrap-anywhere">
        Signed in as <span className="font-semibold">{account.email ?? "your store account"}</span>
      </Text>
      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => void signOut()}>
        {pending ? "Signing out…" : "Sign out"}
      </Button>
      {failed && <Text className="w-full text-sm" role="alert">Couldn&apos;t sign you out. Please try again.</Text>}
    </div>
  );
}
