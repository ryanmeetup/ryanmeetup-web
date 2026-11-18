"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, DropdownSelect, ErrorCallout, Kicker, Text } from "@ryanmeetup/ui";
import type { ReviewPreviewState } from "@/lib/review-provider";

export function ReviewModeSwitch({ preview }: { preview: ReviewPreviewState }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState("");
  const pending = saving || refreshing;
  const label = preview.choice === "custom-sample" ? "custom reviews with a sample buyer" : preview.provider === "judgeme" ? "Judge.me" : preview.provider === "custom" ? "custom reviews" : "an unavailable review mode";

  async function changeMode(provider: string) {
    if (pending) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/reviews/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (!response.ok) throw new Error("Could not switch review mode. Please try again.");
      startTransition(() => router.refresh());
    } catch {
      setError("Could not switch review mode. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside aria-label="Review testing" className="mb-8" aria-busy={pending}>
      <Card variant="outline" className="space-y-3">
        <Kicker>Preview only</Kicker>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <DropdownSelect
            label="Review mode"
            variant="compact"
            className="w-full sm:w-auto"
            value={preview.choice}
            disabled={pending}
            onChange={changeMode}
            options={[
              { value: "default", label: "Environment default" },
              { value: "judgeme", label: "Judge.me" },
              { value: "custom", label: "Custom reviews" },
              { value: "custom-sample", label: "Custom reviews, sample buyer" },
            ]}
          />
          <Text className="text-sm" role="status" aria-live="polite">{pending ? "Switching review mode…" : `Using ${label}. Only this browser is affected.`}</Text>
        </div>
        <Text className="text-sm">{preview.choice === "custom-sample" ? "The sample buyer can try the review form. Nothing is saved." : "Custom reviews are in progress; submissions are currently closed in that mode."}</Text>
        {error && <ErrorCallout>{error}</ErrorCallout>}
      </Card>
    </aside>
  );
}
