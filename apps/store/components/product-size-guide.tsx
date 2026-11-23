"use client";

import { useState } from "react";
import { LuRuler } from "react-icons/lu";
import { Button, Modal } from "@ryanmeetup/ui";

/** Sits beside the Size label; the negative margin keeps the tap target without growing the row. */
export function ProductSizeGuide({ html, title }: { html: string; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span className="-my-2 flex shrink-0">
        <Button size="sm" variant="link" leftIcon={<LuRuler />} aria-haspopup="dialog" onClick={() => setOpen(true)}>Size guide</Button>
      </span>
      <Modal open={open} setIsOpen={setOpen} title="Size guide" description={title} size="lg" dismissOnOutsideClick>
        <p className="mb-4 text-sm text-black/70 sm:hidden dark:text-white/70">Scroll sideways to see every measurement.</p>
        {/* The same Shopify-authored tables remain in Product details. */}
        <div role="region" aria-label="Size measurements" tabIndex={0} className="rich-text overflow-x-auto rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/40 [&_table]:table [&_table]:max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
      </Modal>
    </>
  );
}
