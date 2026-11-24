"use client";

import { useId, useState } from "react";
import { Text, Textarea } from "@ryanmeetup/ui";
import { maxCartNoteLength } from "@/lib/cart-action";
import { useCart } from "./cart-provider";

/**
 * The order note, shared by the drawer and the cart page. It saves when the
 * field loses focus, and checkout waits for a save still pending. Shopify shows
 * it on the order; nothing here promises it reaches the package.
 */
export function CartNote({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const { note, noteChanged, saveNote, setNote } = useCart();
  const id = useId();
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  async function save() {
    if (!noteChanged) return;
    setStatus("saving");
    try {
      await saveNote();
      setStatus("saved");
    } catch {
      // The cart shows the error; the text stays in the field to try again.
      setStatus("idle");
    }
  }

  return (
    <div className={className}>
      <Textarea
        id={`${id}-note`}
        name="note"
        label="Note for Ryan"
        rows={compact ? 2 : 3}
        resizable={false}
        maxLength={maxCartNoteLength}
        placeholder="Anything Ryan should know about this order..."
        value={note}
        aria-describedby={`${id}-status`}
        onChange={(event) => {
          setNote(event.target.value);
          setStatus("idle");
        }}
        onBlur={() => void save()}
      />
      <Text id={`${id}-status`} aria-live="polite" className="mt-2 text-xs text-black/70 dark:text-white/70">
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved. Ryan sees it with your order." : "Ryan sees it with your order."}
      </Text>
    </div>
  );
}
