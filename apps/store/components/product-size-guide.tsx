"use client";

import { useMemo, useState } from "react";
import { LuRuler } from "react-icons/lu";
import { Button, FilterChip, Modal } from "@ryanmeetup/ui";
import { getSizeGuideTables } from "@/lib/product-guidance";

type Unit = "inches" | "centimeters";
const units: { value: Unit; label: string }[] = [{ value: "inches", label: "Inches" }, { value: "centimeters", label: "Centimeters" }];

/** Countries that still measure clothing in inches; everyone else opens on centimetres. */
function preferredUnit(): Unit {
  const region = (() => {
    try { return new Intl.Locale(navigator.language).maximize().region; } catch { return undefined; }
  })();
  return !region || ["US", "LR", "MM"].includes(region) ? "inches" : "centimeters";
}

/** Sits beside the Size label; the negative margin keeps the tap target without growing the row. */
export function ProductSizeGuide({ html }: { html: string }) {
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState<Unit>("inches");
  const tables = useMemo(() => getSizeGuideTables(html), [html]);
  const shown = (unit === "centimeters" && tables.centimeters) || tables.inches || tables.centimeters || html;

  function openGuide() {
    setUnit(preferredUnit());
    setOpen(true);
  }

  return (
    <>
      <span className="-my-2 flex shrink-0">
        <Button size="sm" variant="link" leftIcon={<LuRuler />} aria-haspopup="dialog" onClick={openGuide}>Size guide</Button>
      </span>
      <Modal open={open} setIsOpen={setOpen} title="Size guide" size="fit" dismissOnOutsideClick>
        {tables.inches && tables.centimeters && (
          <div role="group" aria-label="Units" className="mb-4 flex gap-2">
            {units.map(({ value, label }) => (
              <FilterChip key={value} active={unit === value} onClick={() => setUnit(value)}>{label}</FilterChip>
            ))}
          </div>
        )}
        <p className="mb-4 text-sm text-black/70 sm:hidden dark:text-white/70">Scroll sideways to see every measurement.</p>
        {/* The same Shopify-authored tables remain in Product details. */}
        <div role="region" aria-label="Size measurements" tabIndex={0} className="rich-text overflow-x-auto rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/40 [&_table]:table [&_table]:max-w-none" dangerouslySetInnerHTML={{ __html: shown }} />
      </Modal>
    </>
  );
}
