"use client";

import { useState } from "react";
import { Button, ConfirmationDialog, IconButton } from "@ryanmeetup/ui";
import { FiTrash2 } from "react-icons/fi";
import { useCart } from "./cart-provider";

/** Empties the whole cart, after the shopper confirms it. `iconOnly` fits it beside a panel's close button. */
export function EmptyCartButton({ className = "", iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const { cart, clearCart, loading } = useCart();
  const [confirming, setConfirming] = useState(false);
  const count = cart?.totalQuantity ?? 0;

  return (
    <>
      {iconOnly ? (
        <IconButton label="Empty cart" variant="danger" tooltipPlacement="bottom" className={className} disabled={loading} onClick={() => setConfirming(true)}>
          <FiTrash2 className="h-4 w-4" aria-hidden />
        </IconButton>
      ) : (
        <Button variant="secondary" size="md" fullWidth className={`sm:w-auto ${className}`} leftIcon={<FiTrash2 aria-hidden />} disabled={loading} onClick={() => setConfirming(true)}>
          Empty cart
        </Button>
      )}
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
