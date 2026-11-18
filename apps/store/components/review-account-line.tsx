"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Text } from "@ryanmeetup/ui";
import { FiUser } from "react-icons/fi";
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
    <div className="space-y-1">
      <p className="flex min-w-0 items-center gap-1.5 text-xs text-black/70 dark:text-white/70 lg:justify-end">
        <FiUser className="size-3.5 shrink-0" aria-hidden />
        <span className="sr-only">Signed in as</span>
        <span className="min-w-0 truncate" title={account.email ?? undefined}>{account.email ?? "Your store account"}</span>
        <span aria-hidden>·</span>
        {/* An inline text action: the shared Button's padding would break the line's baseline. */}
        <button
          type="button"
          disabled={pending}
          onClick={() => void signOut()}
          className="shrink-0 rounded-sm underline decoration-black/30 underline-offset-2 transition hover:text-black hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 disabled:cursor-wait disabled:opacity-60 dark:decoration-white/30 dark:hover:text-white dark:focus-visible:ring-white/30"
        >
          {pending ? "Signing out…" : "Sign out"}
        </button>
      </p>
      {failed && <Text className="text-xs" role="alert">Couldn&apos;t sign you out. Please try again.</Text>}
    </div>
  );
}
