"use client";

import { useState } from "react";
import { Button, ConfirmationDialog } from "@ryanmeetup/ui";
import { FiTrash2 } from "react-icons/fi";
import { useCart } from "./cart-provider";

/** Empties the whole cart, after the shopper confirms it. */
export function EmptyCartButton({ className = "" }: { className?: string }) {
  const { cart, clearCart, loading } = useCart();
  const [confirming, setConfirming] = useState(false);
  const count = cart?.totalQuantity ?? 0;

  return (
    <>
      <Button variant="secondary" size="md" fullWidth className={`sm:w-auto ${className}`} leftIcon={<FiTrash2 aria-hidden />} disabled={loading} onClick={() => setConfirming(true)}>
        Empty cart
      </Button>
      <ConfirmationDialog
        open={confirming}
        setOpen={setConfirming}
        title="Empty your cart?"
        description={`This removes ${count === 1 ? "the 1 item" : `all ${count} items`} from your cart. You can always add them back.`}
        confirmLabel="Empty cart"
        destructive
        onConfirm={() => {
          clearCart();
          setConfirming(false);
        }}
      />
    </>
  );
}
